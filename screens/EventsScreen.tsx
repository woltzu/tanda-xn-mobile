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
//   • SectionList with Today / This week / Later groups.
//   • route.params.eventId auto-opens the bottom sheet (deep-link).
//   • "Age range" label is i18n.
//   • Cold-load skeleton (3 cards).
//   • Compact "Sat 20 Jun" date on cards; long form in the sheet.
//
// Browse-events Bucket B (2026-06-20):
//   • Search bar (title + location, 300 ms debounce, client-side).
//   • Filter chip row: All / Free / Paid / This week + category chips.
//   • Card category chip is tappable — sets/clears the category filter
//     and scrolls the list to the top.
//   • HelpSheet (4 topics) wired to a (?) header button.
//   • First-visit coach mark gated by @tandaxn_events_browse_coach_seen_v1.
//   • "Show past events" toggle in the list footer; useUpcomingEvents
//     gained a `showPast` flag that flips gte/lte + order.
//
// Migration: 137_community_events.sql.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation, type TFunction } from "react-i18next";
import { useRoute, type RouteProp } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  EVENT_CATEGORIES,
  type CommunityEventRow,
  type EventCategory,
} from "../hooks/useEvents";
import ReportButton from "../components/ReportButton";

// ==========================================================================
// Bucket B — local types & constants
// ==========================================================================

type PriceTimeFilter = "all" | "free" | "paid" | "this_week";
const PRICE_TIME_FILTERS: PriceTimeFilter[] = [
  "all",
  "free",
  "paid",
  "this_week",
];

// Bucket B.3 — HelpSheet topics. Four anchors: provenance / pricing
// model / how the category filter works / how to post.
type HelpTopic =
  | "where_from"
  | "why_free"
  | "sort_by_category"
  | "can_i_post";
const HELP_TOPICS: HelpTopic[] = [
  "where_from",
  "why_free",
  "sort_by_category",
  "can_i_post",
];

const COACH_MARK_KEY = "@tandaxn_events_browse_coach_seen_v1";
const SEARCH_DEBOUNCE_MS = 300;

// ==========================================================================
// Helpers
// ==========================================================================

type SectionKey = "today" | "this_week" | "later" | "past";
type EventSection = {
  key: SectionKey;
  titleKey: string;
  data: CommunityEventRow[];
};

// Bucket A.1 — bucket every event into one of three time windows. Today
// = same calendar date as `now` (local timezone). This week = tomorrow
// through the end of Sunday (ISO week ending). Later = everything past
// that. Sections with no events are dropped before rendering so the
// list never renders an empty header. Bucket B.6 — when showPast, the
// hook returns past events and we render everything under a single
// "Past events" section ordered most-recent-first.
function groupEventsByBucket(
  events: CommunityEventRow[],
  showPast: boolean,
): EventSection[] {
  if (showPast) {
    if (events.length === 0) return [];
    return [
      {
        key: "past",
        titleKey: "events_screen.section_past",
        data: events,
      },
    ];
  }

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

// Bucket B.1 — client-side predicate for the price/time filter chips.
function matchesPriceTimeFilter(
  ev: CommunityEventRow,
  filter: PriceTimeFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "free":
      return isEventFree(ev);
    case "paid":
      return !isEventFree(ev);
    case "this_week": {
      const now = new Date();
      const weekEnd = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7;
      weekEnd.setDate(weekEnd.getDate() + daysUntilSunday);
      weekEnd.setHours(23, 59, 59, 999);
      const dt = new Date(ev.event_datetime);
      return dt <= weekEnd;
    }
  }
}

// Bucket B.2 — case-insensitive substring search over title and
// location_name. Empty query is a no-op (matches everything).
function matchesSearch(ev: CommunityEventRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (ev.title.toLowerCase().includes(q)) return true;
  if (ev.location_name.toLowerCase().includes(q)) return true;
  return false;
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

  // ── Bucket B.6 — past/upcoming toggle. Flips the hook query and the
  // grouping layout (single "Past events" section vs Today/This week
  // /Later). Lives in a single boolean state.
  const [showPast, setShowPast] = useState(false);

  // Shared cache with CommunityTabScreen (when showPast is false). Both
  // pass `{ limit: 50 }` so a single request hydrates both surfaces.
  // Focus refetch lives inside the hook, so we no longer need a local
  // `useFocusEffect` here.
  const { events, loading, refetch } = useUpcomingEvents({
    limit: 50,
    showPast,
  });

  // ── Bucket B.1 + B.2 — filter + search state ────────────────────────
  const [activeFilter, setActiveFilter] = useState<PriceTimeFilter>("all");
  const [activeCategory, setActiveCategory] = useState<EventCategory | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filter + group. The filter runs over the raw `events` array before
  // grouping so a section that ends up empty is dropped (instead of
  // rendering a "Today · 0" header with nothing under it).
  const sections = useMemo(() => {
    const filtered = events.filter(
      (ev) =>
        matchesPriceTimeFilter(ev, activeFilter) &&
        (activeCategory === null || ev.category === activeCategory) &&
        matchesSearch(ev, debouncedSearch),
    );
    return groupEventsByBucket(filtered, showPast);
  }, [events, activeFilter, activeCategory, debouncedSearch, showPast]);

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

  // ── Bucket B.3 — HelpSheet ───────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Bucket B.4 — first-visit coach mark ──────────────────────────────
  // Render path: read AsyncStorage on mount, show banner if unset, hide
  // after 4 s or on tap, and write the marker so the next visit is
  // quiet. Independent of route params so it doesn't accidentally fire
  // on deep-link entry.
  const [coachVisible, setCoachVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && !seen) setCoachVisible(true);
      } catch {
        // AsyncStorage failure → leave coach hidden, treat as "seen".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!coachVisible) return;
    const id = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachVisible]);
  const dismissCoach = useCallback(() => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => undefined);
  }, []);

  // ── Bucket B.5 — card-chip → category filter wiring ─────────────────
  const sectionListRef = useRef<SectionList<CommunityEventRow> | null>(null);
  const handleCategoryChipTap = useCallback(
    (cat: EventCategory) => {
      // Toggling: tapping the active chip clears the filter.
      setActiveCategory((prev) => (prev === cat ? null : cat));
      // Scroll back to top so the user sees the filtered list from
      // the start; using scrollToLocation with an empty section list
      // would throw, so guard.
      requestAnimationFrame(() => {
        try {
          sectionListRef.current?.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            animated: true,
            viewPosition: 0,
          });
        } catch {
          // Empty list / index out of range — silent no-op.
        }
      });
    },
    [],
  );

  // ── Header ──────────────────────────────────────────────────────────
  const ListHeader = (
    <View>
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
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              onPress={() => setHelpOpen(true)}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel={t("events_screen.help_a11y")}
            >
              <Ionicons
                name="help-circle-outline"
                size={22}
                color={colors.textWhite}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel={t("community_events.header_create_a11y")}
            >
              <Ionicons name="add" size={26} color={colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {t("community_events.header_subtitle")}
        </Text>
      </LinearGradient>

      {/* Bucket B.2 — search input. Below header, above chips. */}
      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={16}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t("events_screen.search_placeholder")}
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel={t("events_screen.search_placeholder")}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchInput("")}
            style={styles.searchClearBtn}
            accessibilityRole="button"
            accessibilityLabel={t("events_screen.search_clear_a11y")}
          >
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Bucket B.1 — filter chip strip (price/time + category). Two
          rows so categories don't crowd the price chips on narrow
          screens. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {PRICE_TIME_FILTERS.map((key) => {
          const active = activeFilter === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveFilter(key)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                ]}
              >
                {t(`events_screen.filter_${key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {EVENT_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() =>
                setActiveCategory((prev) => (prev === cat ? null : cat))
              }
              style={[
                styles.chip,
                styles.chipCategory,
                active && styles.chipCategoryActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                ]}
              >
                {t(`create_event.category_${cat}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bucket B.4 — first-visit coach mark, banner under the chips. */}
      {coachVisible && (
        <Pressable
          onPress={dismissCoach}
          style={styles.coachBanner}
          accessibilityRole="button"
          accessibilityHint={t("events_screen.coach_dismiss_a11y")}
        >
          <Ionicons name="bulb-outline" size={16} color={colors.textWhite} />
          <Text style={styles.coachText}>{t("events_screen.coach_tip")}</Text>
          <Ionicons name="close" size={14} color={colors.textWhite} />
        </Pressable>
      )}
    </View>
  );

  // ── Empty / skeleton chooser ────────────────────────────────────────
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
    // When filters / search are active and nothing matches, surface a
    // distinct empty state so the user understands it isn't "no events
    // exist" — it's "no events match your filters".
    const hasActiveFilter =
      activeFilter !== "all" ||
      activeCategory !== null ||
      debouncedSearch.length > 0;
    if (hasActiveFilter) {
      return (
        <View style={styles.centerState}>
          <Ionicons
            name="filter-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>
            {t("events_screen.empty_filtered_title")}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t("events_screen.empty_filtered_subtitle")}
          </Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => {
              setActiveFilter("all");
              setActiveCategory(null);
              setSearchInput("");
            }}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={16} color={colors.textWhite} />
            <Text style={styles.emptyCreateBtnText}>
              {t("events_screen.empty_filtered_reset")}
            </Text>
          </TouchableOpacity>
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
          {showPast
            ? t("events_screen.empty_past_title")
            : t("community_events.empty_title")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {showPast
            ? t("events_screen.empty_past_subtitle")
            : t("community_events.empty_subtitle")}
        </Text>
        {!showPast && (
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
        )}
      </View>
    );
  };

  // ── Bucket B.6 — footer toggle ──────────────────────────────────────
  const ListFooter = (
    <View style={styles.footerWrap}>
      <TouchableOpacity
        style={styles.footerLinkBtn}
        onPress={() => {
          // Clear filters when flipping the timeline so a stale
          // category filter doesn't silently hide the new dataset.
          setActiveFilter("all");
          setActiveCategory(null);
          setSearchInput("");
          setShowPast((p) => !p);
        }}
        accessibilityRole="button"
      >
        <Ionicons
          name={showPast ? "arrow-forward" : "time-outline"}
          size={14}
          color={colors.primaryNavy}
        />
        <Text style={styles.footerLinkText}>
          {showPast
            ? t("events_screen.show_upcoming_events")
            : t("events_screen.show_past_events")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      {/* SectionList replaces the prior ScrollView+map. The header is
          rendered as ListHeaderComponent so it scrolls with the list.
          Sections derive from groupEventsByBucket and skip empty
          windows automatically. */}
      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
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
              isCategoryActive={
                item.category !== null && item.category === activeCategory
              }
              onDetails={() => setSelectedEvent(item)}
              onBuyTicket={() => handleBuyTicket(item.contact_info?.ticket_link)}
              onCategoryTap={handleCategoryChipTap}
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

      {/* Bucket B.3 — HelpSheet */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
    </SafeAreaView>
  );
}

// ==========================================================================
// EventCard sub-component
// ==========================================================================

function EventCard({
  event,
  isCategoryActive,
  onDetails,
  onBuyTicket,
  onCategoryTap,
}: {
  event: CommunityEventRow;
  isCategoryActive: boolean;
  onDetails: () => void;
  onBuyTicket: () => void;
  onCategoryTap: (cat: EventCategory) => void;
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
              row predates the category column. Bucket B.5 — tappable;
              tap sets/clears the screen's active category filter. */}
          {event.category ? (
            <TouchableOpacity
              onPress={() => onCategoryTap(event.category as EventCategory)}
              accessibilityRole="button"
              accessibilityLabel={t(
                "events_screen.category_chip_a11y",
                {
                  category: t(`create_event.category_${event.category}`),
                },
              )}
              style={[
                styles.cardCategoryChip,
                isCategoryActive && styles.cardCategoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.cardCategoryChipText,
                  isCategoryActive && styles.cardCategoryChipTextActive,
                ]}
              >
                {t(`create_event.category_${event.category}`)}
              </Text>
            </TouchableOpacity>
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
// HelpSheet — Bucket B.3 (4 topics)
// ==========================================================================

function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: TFunction;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpBackdrop} onPress={onClose}>
        <Pressable style={styles.helpSheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.helpHeaderRow}>
            <Text style={styles.helpTitle}>
              {t("events_screen.help_sheet_title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("events_screen.help_close")}
            >
              <Ionicons name="close" size={22} color={colors.primaryNavy} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.helpScroll}
          >
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>
                  {t(`events_screen.help_${topic}_title`)}
                </Text>
                <Text style={styles.helpItemBody}>
                  {t(`events_screen.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  // Bucket B.3 — header-right cluster holds the (?) + (+) buttons.
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
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

  // ── Bucket B.2 — search input ──────────────────────────────────────
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { width: 16 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
  },

  // ── Bucket B.1 — chip rows ─────────────────────────────────────────
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryNavy,
    borderColor: colors.primaryNavy,
  },
  chipCategory: {
    backgroundColor: "#F0FDFB",
    borderColor: colors.accentTeal,
  },
  chipCategoryActive: {
    backgroundColor: colors.accentTeal,
    borderColor: colors.accentTeal,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.textWhite,
  },

  // ── Bucket B.4 — coach mark banner ─────────────────────────────────
  coachBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primaryNavy,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  coachText: {
    flex: 1,
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: "600",
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
  // Bucket B.5 — active variant when the chip's category matches the
  // screen's currently-selected category filter.
  cardCategoryChipActive: {
    backgroundColor: colors.accentTeal,
  },
  cardCategoryChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0A2342",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardCategoryChipTextActive: {
    color: colors.textWhite,
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

  // Bucket B.6 — footer toggle.
  footerWrap: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footerLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerLinkText: {
    color: colors.primaryNavy,
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
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

  // Bucket B.3 — HelpSheet
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  helpSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  helpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  helpScroll: { paddingBottom: 8 },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  helpItemBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
