import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useMyTripStatus, usePublicTrip } from "../hooks/useTripOrganizer";
import { useAuth } from "../context/AuthContext";

const GOLD = "#E8A842";
const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;
const GREEN = "#10B981";
const GREEN_BG = "#ECFDF5";
const GOLD_BG = "rgba(232,168,66,0.1)";
const RED = "#DC2626";
const RED_BG = "#FEF2F2";

// ── Types ──────────────────────────────────────────────────────────────────────
type TripStatus = "confirmed" | "pending" | "waitlist";

interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  completed: boolean;
  actionLabel?: string;
  actionScreen?: string;
  actionParams?: Record<string, string>;
  urgent?: boolean;
}

interface TripStatusData {
  id: string;
  name: string;
  destination: string;
  dates: string;
  status: TripStatus;
  totalCost: number;
  totalPaid: number;
  alertMessage?: string;
  checklist: ChecklistItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TripStatus, { label: string; bgColor: string; textColor: string; icon: string }> = {
  confirmed: { label: "Confirmed", bgColor: GREEN_BG, textColor: GREEN, icon: "checkmark-circle" },
  pending: { label: "Pending", bgColor: GOLD_BG, textColor: GOLD, icon: "time" },
  waitlist: { label: "Waitlist", bgColor: "rgba(0,198,174,0.1)", textColor: TEAL, icon: "hourglass" },
};

// ── Component ──────────────────────────────────────────────────────────────────
const MyTripStatusScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const tripId: string = route.params?.tripId ?? '';

  // Publish-trip Bucket A.5 — real data wiring. The previous version
  // read `(hookResult as any)?.data` which never matched the hook's
  // actual `{participant, payments, submissions, loading}` shape, so
  // every render fell through to the MOCK_STATUS fallback even when
  // a user had really joined. The fallback is now gone entirely.
  const { user } = useAuth();
  const myStatus = useMyTripStatus(tripId, user?.id ?? '');
  const publicTrip = usePublicTrip('', tripId);

  const participant = myStatus.participant;
  const payments = myStatus.payments ?? [];
  const submissions = myStatus.submissions ?? [];
  const trip = publicTrip?.trip;
  const isLoading = myStatus.loading || publicTrip?.loading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  // Empty state — the user is signed in (or not) but no participant row
  // exists for this trip. Nudge them back to the public page where they
  // can hit Join (Bucket A.4 wired that action).
  if (!participant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.my_trip_status")}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="airplane-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('my_trip_status.empty_title')}</Text>
          <Text style={styles.emptyBody}>{t('my_trip_status.empty_body')}</Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => {
              if (tripId) {
                navigation.navigate('TripPublicPage' as never, { tripId } as never);
              } else {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.emptyCtaText}>{t('my_trip_status.empty_cta')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Map participant.status → screen TripStatus union. "cancelled" lands
  // in pending visually for now (rare path; B/C can split).
  const participantStatus: TripStatus =
    participant.status === 'confirmed' ? 'confirmed'
    : participant.status === 'waitlist' ? 'waitlist'
    : 'pending';

  // Derived trip metadata. priceCents is the schema name even though it
  // stores a decimal dollar amount on the live row (per mapTrip).
  const tripName = trip?.name ?? '';
  const destination = trip?.destination ?? '';
  const formatDateRange = (): string => {
    if (!trip?.startDate || !trip?.endDate) return '';
    try {
      const s = new Date(trip.startDate);
      const e = new Date(trip.endDate);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    } catch {
      return '';
    }
  };

  const totalCost = trip?.priceCents ?? 0;
  const totalPaid = participant.totalPaidCents ?? 0;
  const paymentPercent = totalCost > 0
    ? Math.min(100, Math.round((totalPaid / totalCost) * 100))
    : 0;

  // Build the checklist from real data. The previous static checklist
  // (deposit / emergency / waiver / passport / final_payment) was all
  // mock; the live equivalent is derived from:
  //   • participant.paymentStatus → "deposit paid" / "paid in full"
  //   • submissions[] (trip_participant_submissions) → per-field
  //     completion. Unknown fields render generic labels.
  //   • payments[] → "final payment" remaining amount.
  const data: TripStatusData = {
    id: trip?.id ?? tripId,
    name: tripName || 'Untitled Trip',
    destination,
    dates: formatDateRange(),
    status: participantStatus,
    totalCost,
    totalPaid,
    alertMessage: undefined,
    checklist: [
      {
        id: 'deposit',
        label: t('my_trip_status.checklist_deposit'),
        detail:
          participant.paymentStatus === 'deposit_paid'
            || participant.paymentStatus === 'partial'
            || participant.paymentStatus === 'paid_in_full'
              ? `$${totalPaid.toLocaleString()}`
              : t('my_trip_status.checklist_deposit_pending'),
        completed:
          participant.paymentStatus !== 'unpaid'
          && totalPaid > 0,
      },
      ...submissions.map((s): ChecklistItem => ({
        id: s.id,
        label: s.fieldKey,
        detail: s.verified
          ? t('my_trip_status.checklist_submission_verified')
          : t('my_trip_status.checklist_submission_pending'),
        completed: s.verified,
      })),
      {
        id: 'final_payment',
        label: t('my_trip_status.checklist_final_payment'),
        detail:
          totalPaid >= totalCost && totalCost > 0
            ? t('my_trip_status.checklist_paid_in_full')
            : `$${Math.max(0, totalCost - totalPaid).toLocaleString()} ${t('my_trip_status.checklist_remaining')}`,
        completed: totalCost > 0 && totalPaid >= totalCost,
        actionLabel:
          totalPaid >= totalCost
            ? undefined
            : t('my_trip_status.checklist_action_pay'),
        actionScreen:
          totalPaid >= totalCost
            ? undefined
            : 'TripPayment',
        actionParams: { participantId: participant.id },
      },
    ],
  };

  const statusCfg = STATUS_CONFIG[data.status];

  // (unused references kept for compile-friendliness on the legacy mock branch — none now)
  void payments;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.my_trip_status")}</Text>
          <View style={styles.headerBtn} />
        </View>

        {/* ── Status Banner ───────────────────────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bgColor }]}>
          <Ionicons name={statusCfg.icon as any} size={20} color={statusCfg.textColor} />
          <Text style={[styles.statusBannerText, { color: statusCfg.textColor }]}>
            Registration {statusCfg.label}
          </Text>
        </View>

        {/* ── Trip Mini Hero ──────────────────────────────────────────── */}
        <View style={styles.miniHero}>
          <LinearGradient
            colors={[NAVY, "#143A6B"]}
            style={styles.miniHeroGradient}
          >
            <Text style={styles.miniHeroName}>{data.name}</Text>
            <View style={styles.miniHeroMeta}>
              <View style={styles.miniHeroMetaItem}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.miniHeroMetaText}>{data.destination}</Text>
              </View>
              <View style={styles.miniHeroMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.miniHeroMetaText}>{data.dates}</Text>
              </View>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusCfg.bgColor }]}>
              <Text style={[styles.statusPillText, { color: statusCfg.textColor }]}>
                {statusCfg.label}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Payment Progress ────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t("final_polish.mytripstatus_payment_progress")}</Text>
            <Text style={styles.paymentPercent}>{paymentPercent}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${paymentPercent}%` }]} />
          </View>
          <View style={styles.paymentAmountRow}>
            <Text style={styles.paymentPaid}>
              ${data.totalPaid.toLocaleString()}
            </Text>
            <Text style={styles.paymentTotal}>
              / ${data.totalCost.toLocaleString()} paid
            </Text>
          </View>
        </View>

        {/* ── Alert Banner ────────────────────────────────────────────── */}
        {data.alertMessage && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={18} color={RED} />
            <Text style={styles.alertText}>{data.alertMessage}</Text>
          </View>
        )}

        {/* ── Personal Checklist ──────────────────────────────────────── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t("final_polish.mytripstatus_personal_checklist")}</Text>
          <View style={styles.checklistCard}>
            {data.checklist.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checklistRow,
                  index < data.checklist.length - 1 && styles.checklistRowBorder,
                ]}
                activeOpacity={item.actionScreen ? 0.6 : 1}
                onPress={() => {
                  if (item.actionScreen) {
                    navigation.navigate(item.actionScreen, {
                      tripId: data.id,
                      participantId: "me",
                      ...item.actionParams,
                    });
                  }
                }}
              >
                <View style={styles.checklistLeft}>
                  {item.completed ? (
                    <View style={styles.checkDone}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  ) : (
                    <View style={[styles.checkUndone, item.urgent && styles.checkUrgent]} />
                  )}
                  <View style={styles.checklistTextCol}>
                    <Text
                      style={[
                        styles.checklistLabel,
                        item.completed && styles.checklistLabelDone,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.checklistDetail}>{item.detail}</Text>
                  </View>
                </View>
                {!item.completed && item.actionLabel && (
                  <View
                    style={[
                      styles.actionBadge,
                      item.urgent ? styles.actionBadgeUrgent : styles.actionBadgeDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionBadgeText,
                        { color: item.urgent ? RED : GOLD },
                      ]}
                    >
                      {item.actionLabel}
                    </Text>
                  </View>
                )}
                {item.actionScreen && (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyTripStatusScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  // ── Status Banner ──
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.small,
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },

  // ── Mini Hero ──
  miniHero: {
    marginHorizontal: 16,
    borderRadius: radius.card,
    overflow: "hidden",
    marginBottom: 16,
  },
  miniHeroGradient: {
    padding: 20,
  },
  miniHeroName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 10,
  },
  miniHeroMeta: {
    gap: 6,
    marginBottom: 12,
  },
  miniHeroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniHeroMetaText: {
    fontSize: typography.bodySmall,
    color: "rgba(255,255,255,0.8)",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
  },

  // ── Card ──
  card: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  paymentPercent: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: TEAL,
  },

  // ── Progress Bar ──
  progressBar: {
    height: 10,
    backgroundColor: "rgba(0,198,174,0.12)",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 5,
  },
  paymentAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  paymentPaid: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  paymentTotal: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginLeft: 4,
  },

  // ── Alert Banner ──
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: RED_BG,
    borderRadius: radius.small,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  alertText: {
    fontSize: typography.bodySmall,
    color: RED,
    fontWeight: typography.medium,
    flex: 1,
    lineHeight: 18,
  },

  // ── Checklist ──
  sectionContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 12,
  },
  checklistCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  checklistRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checklistLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  checkDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  checkUndone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkUrgent: {
    borderColor: RED,
  },
  checklistTextCol: {
    flex: 1,
  },
  checklistLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: 2,
  },
  checklistLabelDone: {
    color: colors.textSecondary,
  },
  checklistDetail: {
    fontSize: typography.label,
    color: colors.textSecondary,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  actionBadgeUrgent: {
    backgroundColor: RED_BG,
  },
  actionBadgeDefault: {
    backgroundColor: GOLD_BG,
  },
  actionBadgeText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
  },

  // Publish-trip Bucket A.5 — empty state when the user hasn't joined.
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 16,
    backgroundColor: TEAL,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
});
