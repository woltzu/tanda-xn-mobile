// ══════════════════════════════════════════════════════════════════════════════
// screens/EventsScreen.tsx — Upcoming Events list (DB-backed).
// ══════════════════════════════════════════════════════════════════════════════
//
// Lists upcoming events from the `community_events` table, ordered by
// event_datetime ASC. Pull-to-refresh + header "+" button to navigate to
// CreateEventScreen. Tapping Details opens a bottom-sheet showing every
// field present on the row.
//
// Browse-events Bucket A (2026-06-20):
//   • A.1+A.2 — SectionList with Today / This week / Later groups.
//   • A.3    — route.params.eventId auto-opens the bottom sheet for the
//               event referenced by a deep link / notification.
//   • A.4    — "Age range" label is now i18n.
//   • A.5    — Initial load shows three skeleton cards instead of a
//               centred spinner.
//   • A.7    — Card date uses the compact "Sat 20 Jun" format; the long
//               weekday/year form is preserved in the sheet.
//
// Migration: 137_community_events.sql.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
  RefreshControl,
  Linking,
  SectionList,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { colors } from "../theme/tokens";
import {
  useUpcomingEvents,
  fetchEventById,
  formatEventDate,
  formatEventDateCompact,
  formatEventTime,
  isEventFree,
  type CommunityEventRow,
} from "../hooks/useEvents";
import ReportButton from "../components/ReportButton";

// ==========================================================================
// Helpers
// ==========================================================================

type SectionKey = "today" | "this_week" | "later";
type EventSection = {
  key: SectionKey;
  titleKey: string;
  data: CommunityEventRow[];
};

// Bucket A.1 — bucket every event into one of three time windows. Today
// = same calendar date as `now` (local timezone). This week = tomorrow
// through the end of Sunday (ISO week ending). Later = everything past
// that. Sections with no events are dropped before rendering so the
// list never renders an empty header.
function groupEventsByBucket(events: CommunityEventRow[]): EventSection[] {
  const now = new Date();

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // End-of-week = upcoming Sunday at 23:59:59. JS day index: 0=Sunday,
  // so daysUntilSunday = (7 - now.getDay()) % 7 — 0 means today already
  // is Sunday, in which case Today and This week share the boundary.
  const weekEnd = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7;
  weekEnd.setDate(weekEnd.getDate() + daysUntilSunday);
  weekEnd.setHours(23, 59, 59, 999);

  const today: CommunityEventRow[] = [];
  const thisWeek: CommunityEventRow[] = [];
  const later: CommunityEventRow[] = [];

  for (const ev of events) {
    const dt = new Date(ev.event_datetime);
    if (dt <= todayEnd) today.push(ev);
    else if (dt <= weekEnd) thisWeek.push(ev);
    else later.push(ev);
  }

  return [
    { key: "today", titleKey: "events_screen.section_today", data: today },
    {
      key: "this_week",
      titleKey: "events_screen.section_this_week",
      data: thisWeek,
    },
    { key: "later", titleKey: "events_screen.section_later", data: later },
  ].filter((s) => s.data.length > 0);
}

// ==========================================================================
// Screen
// ==========================================================================

type EventsRouteParams = { eventId?: string };
type EventsRoute = RouteProp<Record<string, EventsRouteParams | undefined>>;

export default function EventsScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const route = useRoute<EventsRoute>();
  const deepLinkEventId = route.params?.eventId ?? null;

  // Shared cache with CommunityTabScreen — both pass `{ limit: 50 }` so a
  // single request hydrates both surfaces. Focus refetch lives inside the
  // hook, so we no longer need a local `useFocusEffect` here.
  const { events, loading, refetch } = useUpcomingEvents({ limit: 50 });

  const sections = useMemo(() => groupEventsByBucket(events), [events]);

  const [selectedEvent, setSelectedEvent] = useState<CommunityEventRow | null>(
    null,
  );
  const [sheetImgFailed, setSheetImgFailed] = useState(false);
  useEffect(() => {
    setSheetImgFailed(false);
  }, [selectedEvent]);

  // Bucket A.3 — deep-link auto-open. When the user lands on this screen
  // with ?eventId=<uuid> (notification tap or in-app link), open the
  // sheet for that event as soon as possible.
  //   1. If the id is already in the loaded list, use that row.
  //   2. Otherwise, fall back to a single-row DB fetch.
  // `handledDeepLinkId` makes the auto-open one-shot per id so that
  // closing the sheet doesn't immediately re-trigger it. If the user
  // arrives via a different id, the new id is handled afresh.
  const handledDeepLinkIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkEventId) return;
    if (handledDeepLinkIdRef.current === deepLinkEventId) return;
    const inList = events.find((e) => e.id === deepLinkEventId);
    if (inList) {
      handledDeepLinkIdRef.current = deepLinkEventId;
      setSelectedEvent(inList);
      return;
    }
    // Wait until list has finished loading before falling back to a
    // direct fetch — otherwise we'd double-fetch the same row.
    if (loading) return;
    let cancelled = false;
    (async () => {
      const fresh = await fetchEventById(deepLinkEventId);
      if (cancelled) return;
      handledDeepLinkIdRef.current = deepLinkEventId;
      if (fresh) setSelectedEvent(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLinkEventId, events, loading]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Buy Ticket: opens the configured URL via Linking.openURL after a strict
  // protocol whitelist (http:// or https://). Anything else gets a single
  // informational Alert. Replaces the previous placeholder-only Alert.
  const handleBuyTicket = async (link?: string) => {
    const url = (link ?? "").trim();
    const safe = /^https?:\/\//i.test(url);
    if (!safe) {
      Alert.alert(
        t("community_events.ticket_invalid_title"),
        t("community_events.ticket_invalid_body"),
      );
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          t("community_events.ticket_invalid_title"),
          t("community_events.ticket_invalid_body"),
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t("community_events.ticket_invalid_title"),
        t("community_events.ticket_invalid_body"),
      );
    }
  };

  const handleCreate = () => navigation.navigate(Routes.CreateEvent);

  // Bucket A.5 — skeleton pulse. One Animated.Value drives every
  // placeholder card's opacity. Runs only during the cold initial load.
  const skeletonPulse = useRef(new Animated.Value(0.5)).current;
  const showSkeleton = loading && events.length === 0;
  useEffect(() => {
    if (!showSkeleton) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showSkeleton, skeletonPulse]);

  // ── Header (reused as the SectionList sticky-ish ListHeader) ────────
  const ListHeader = (
    <LinearGradient
      colors={[colors.primaryNavy, "#143654"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("community_events.header_title")}
        </Text>
        <TouchableOpacity
          onPress={handleCreate}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t("community_events.header_create_a11y")}
        >
          <Ionicons name="add" size={26} color={colors.textWhite} />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerSubtitle}>
        {t("community_events.header_subtitle")}
      </Text>
    </LinearGradient>
  );

  // ── Empty / skeleton / list-body chooser ───────────────────────────
  const renderEmpty = () => {
    if (showSkeleton) {
      return (
        <View style={styles.cardsWrap}>
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} pulse={skeletonPulse} />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <Ionicons
          name="calendar-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>
          {t("community_events.empty_title")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {t("community_events.empty_subtitle")}
        </Text>
        <TouchableOpacity
          style={styles.emptyCreateBtn}
          onPress={handleCreate}
          accessibilityRole="button"
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={colors.textWhite}
          />
          <Text style={styles.emptyCreateBtnText}>
            {t("community_events.empty_create_btn")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      {/* SectionList replaces the prior ScrollView+map. The header is
          rendered as ListHeaderComponent so it scrolls with the list.
          Sections derive from groupEventsByBucket and skip empty
          windows automatically. */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>
              {t(section.titleKey)} · {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.itemWrap}>
            <EventCard
              event={item}
              onDetails={() => setSelectedEvent(item)}
              onBuyTicket={() => handleBuyTicket(item.contact_info?.ticket_link)}
            />
          </View>
        )}
        ListEmptyComponent={renderEmpty}
        stickySectionHeadersEnabled={false}
      />

      {/* ===== DETAILS BOTTOM SHEET ===== */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSelectedEvent(null)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {selectedEvent && (
              <ScrollView
                style={{ maxHeight: "90%" }}
                showsVerticalScrollIndicator={false}
              >
                {/* Flyer banner */}
                {selectedEvent.image_url && !sheetImgFailed ? (
                  <Image
                    source={{ uri: selectedEvent.image_url }}
                    style={styles.sheetBanner}
                    resizeMode="cover"
                    onError={() => setSheetImgFailed(true)}
                    accessible
                    accessibilityLabel={selectedEvent.title}
                  />
                ) : null}

                <Text style={styles.sheetTitle}>{selectedEvent.title}</Text>

                <SheetInfoRow
                  icon="calendar-outline"
                  label={t("community_events.label_when")}
                  value={`${formatEventDate(selectedEvent.event_datetime)} · ${formatEventTime(selectedEvent.event_datetime)}`}
                />

                <SheetInfoRow
                  icon="location-outline"
                  label={t("community_events.label_where")}
                  value={
                    selectedEvent.full_address
                      ? `${selectedEvent.location_name}\n${selectedEvent.full_address}`
                      : selectedEvent.location_name
                  }
                />

                <SheetInfoRow
                  icon="pricetag-outline"
                  label={t("community_events.label_price")}
                  value={
                    isEventFree(selectedEvent)
                      ? t("community_events.label_free")
                      : (selectedEvent.price_description ??
                        `$${selectedEvent.price?.toFixed(2)}`)
                  }
                  valueColor={
                    isEventFree(selectedEvent)
                      ? colors.successText
                      : colors.textPrimary
                  }
                />

                {selectedEvent.age_range && (
                  <SheetInfoRow
                    icon="people-outline"
                    label={t("events_screen.age_range_label")}
                    value={selectedEvent.age_range}
                  />
                )}

                <SheetSection
                  title={t("community_events.modal_details_section_about")}
                >
                  <Text style={styles.sheetBodyText}>
                    {selectedEvent.description}
                  </Text>
                </SheetSection>

                {selectedEvent.prizes && (
                  <SheetSection
                    title={t("community_events.modal_details_section_prizes")}
                  >
                    <Text style={styles.sheetBodyText}>
                      {selectedEvent.prizes}
                    </Text>
                  </SheetSection>
                )}

                {selectedEvent.contact_info &&
                  (selectedEvent.contact_info.phone ||
                    selectedEvent.contact_info.email ||
                    selectedEvent.contact_info.ticket_link) && (
                    <SheetSection
                      title={t(
                        "community_events.modal_details_section_contact",
                      )}
                    >
                      {selectedEvent.contact_info.phone && (
                        <Text style={styles.sheetContactLine}>
                          📞 {selectedEvent.contact_info.phone}
                        </Text>
                      )}
                      {selectedEvent.contact_info.email && (
                        <Text style={styles.sheetContactLine}>
                          ✉️ {selectedEvent.contact_info.email}
                        </Text>
                      )}
                      {selectedEvent.contact_info.ticket_link && (
                        <Text style={styles.sheetContactLine}>
                          🎟 {selectedEvent.contact_info.ticket_link}
                        </Text>
                      )}
                    </SheetSection>
                  )}

                {selectedEvent.presented_by && (
                  <SheetSection
                    title={t(
                      "community_events.modal_details_section_organizer",
                    )}
                  >
                    <Text style={styles.sheetBodyText}>
                      {selectedEvent.presented_by}
                    </Text>
                  </SheetSection>
                )}

                {/* Buy Ticket button only when a ticket link exists. */}
                {selectedEvent.contact_info?.ticket_link && (
                  <TouchableOpacity
                    style={styles.sheetTicketBtn}
                    onPress={() => {
                      setSelectedEvent(null);
                      handleBuyTicket(selectedEvent.contact_info?.ticket_link);
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="ticket-outline"
                      size={16}
                      color={colors.textWhite}
                    />
                    <Text style={styles.sheetTicketBtnText}>
                      {t("community_events.btn_buy_ticket")}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setSelectedEvent(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.sheetCloseBtnText}>
                    {t("community_events.btn_close")}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================================================
// EventCard sub-component
// ==========================================================================

function EventCard({
  event,
  onDetails,
  onBuyTicket,
}: {
  event: CommunityEventRow;
  onDetails: () => void;
  onBuyTicket: () => void;
}) {
  const { t } = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = event.image_url && !imgFailed;
  const free = isEventFree(event);
  const hasTicketButton = !!event.contact_info?.ticket_link;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        {showImage ? (
          <Image
            source={{ uri: event.image_url! }}
            style={styles.cardThumb}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
            accessible
            accessibilityLabel={event.title}
          />
        ) : (
          <View style={styles.cardThumbFallback}>
            <Ionicons
              name="image-outline"
              size={28}
              color={colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.cardTitleCol}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {event.title}
          </Text>
          {/* P2 (migration 158) — category chip. Hidden when the event
              row predates the category column. */}
          {event.category ? (
            <View style={styles.cardCategoryChip}>
              <Text style={styles.cardCategoryChipText}>
                {t(`create_event.category_${event.category}`)}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Moderation P0 (2026-06-13): flag this event. */}
        <ReportButton
          kind="content"
          contentType="event"
          targetId={event.id}
          ownerUserId={event.user_id}
        />
      </View>

      <View style={styles.cardInfoRow}>
        <Ionicons
          name="calendar-outline"
          size={14}
          color={colors.textSecondary}
        />
        <Text style={styles.cardInfoText}>
          {/* Bucket A.7 — compact date on the card; the long form lives
              in the bottom-sheet where horizontal space is plentiful. */}
          {formatEventDateCompact(event.event_datetime)} ·{" "}
          {formatEventTime(event.event_datetime)}
        </Text>
      </View>

      <View style={styles.cardInfoRow}>
        <Ionicons
          name="location-outline"
          size={14}
          color={colors.textSecondary}
        />
        <Text style={styles.cardInfoText} numberOfLines={2}>
          {event.full_address
            ? `${event.location_name}, ${event.full_address}`
            : event.location_name}
        </Text>
      </View>

      <View style={styles.cardInfoRow}>
        <Ionicons
          name="pricetag-outline"
          size={14}
          color={free ? colors.successText : colors.textSecondary}
        />
        <Text
          style={[
            styles.cardInfoText,
            {
              color: free ? colors.successText : colors.textPrimary,
              fontWeight: free ? "700" : "600",
            },
          ]}
        >
          {free
            ? t("community_events.label_free")
            : (event.price_description ?? `$${event.price?.toFixed(2)}`)}
        </Text>
      </View>

      <View style={styles.cardBtnRow}>
        <TouchableOpacity
          style={[
            styles.cardBtnOutline,
            hasTicketButton && styles.cardBtnFlex,
          ]}
          onPress={onDetails}
          accessibilityRole="button"
        >
          <Text style={styles.cardBtnOutlineText}>
            {t("community_events.btn_details")}
          </Text>
        </TouchableOpacity>

        {hasTicketButton && (
          <TouchableOpacity
            style={[styles.cardBtnPrimary, styles.cardBtnFlex]}
            onPress={onBuyTicket}
            accessibilityRole="button"
          >
            <Ionicons
              name="ticket-outline"
              size={14}
              color={colors.textWhite}
            />
            <Text style={styles.cardBtnPrimaryText}>
              {t("community_events.btn_buy_ticket")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ==========================================================================
// EventCardSkeleton — Bucket A.5
// ==========================================================================

function EventCardSkeleton({ pulse }: { pulse: Animated.Value }) {
  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.skeletonThumb} />
        <View style={styles.cardTitleCol}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonChip} />
        </View>
      </View>
      <View style={[styles.cardInfoRow, { marginTop: 12 }]}>
        <View style={styles.skeletonLineNarrow} />
      </View>
      <View style={styles.cardInfoRow}>
        <View style={styles.skeletonLineNarrow} />
      </View>
      <View style={styles.cardInfoRow}>
        <View style={styles.skeletonLineMedium} />
      </View>
      <View style={[styles.cardBtnRow, { marginTop: 14 }]}>
        <View style={styles.skeletonBtn} />
        <View style={styles.skeletonBtn} />
      </View>
    </Animated.View>
  );
}

// ==========================================================================
// Sheet sub-components
// ==========================================================================

function SheetInfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.sheetInfoRow}>
      <Ionicons name={icon} size={16} color={colors.primaryNavy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sheetInfoLabel}>{label}</Text>
        <Text
          style={[
            styles.sheetInfoValue,
            valueColor ? { color: valueColor } : null,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sheetSection}>
      <Text style={styles.sheetSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 2,
  },

  // Bucket A.1 — SectionList section header strip.
  sectionHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: colors.screenBg,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  emptyCreateBtnText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },

  cardsWrap: { padding: 16 },
  itemWrap: { paddingHorizontal: 16, paddingTop: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  cardThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
  },
  cardThumbFallback: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  // P2 — category chip column
  cardTitleCol: { flex: 1, gap: 4 },
  cardCategoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
  },
  cardCategoryChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0A2342",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  cardInfoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  cardBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  cardBtnFlex: { flex: 1 },
  cardBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.primaryNavy,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cardBtnOutlineText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 13,
  },
  cardBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cardBtnPrimaryText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 13,
  },

  // Bucket A.5 skeleton blocks.
  skeletonThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  skeletonChip: {
    width: 80,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  skeletonLineWide: {
    width: "70%",
    height: 16,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  skeletonLineMedium: {
    width: "55%",
    height: 12,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
  },
  skeletonLineNarrow: {
    width: "40%",
    height: 12,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
  },
  skeletonBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetBanner: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.screenBg,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  sheetInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetInfoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sheetInfoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 20,
  },
  sheetSection: { marginTop: 14 },
  sheetSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sheetBodyText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  sheetContactLine: {
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  sheetTicketBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 18,
  },
  sheetTicketBtnText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },
  sheetCloseBtn: {
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
  },
  sheetCloseBtnText: {
    color: colors.textWhite,
    fontWeight: "600",
    fontSize: 14,
  },
});
