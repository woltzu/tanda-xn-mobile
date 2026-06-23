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
import { useMyTripStatus, usePublicTrip, useItineraryBuilder } from "../hooks/useTripOrganizer";
import { useAuth } from "../context/AuthContext";
import InstallmentScheduleView from "../components/InstallmentScheduleView";

const GOLD = "#E8A842";
const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;
const GREEN = "#10B981";
const GREEN_BG = "#ECFDF5";
const GOLD_BG = "rgba(232,168,66,0.1)";
const RED = "#DC2626";
const RED_BG = "#FEF2F2";

// ── Types ──────────────────────────────────────────────────────────────────────
// Member-trip-status Bucket A.6 — added `cancelled` so the screen can
// branch into a dedicated cancelled banner state instead of silently
// rendering "pending" copy + a checklist asking for money on a trip the
// user has been removed from.
type TripStatus = "confirmed" | "pending" | "waitlist" | "cancelled";

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
// Member-trip-status Bucket A.8 — labelKey resolves to t() at render
// time. `cancelled` now has its own entry instead of being mapped to
// pending. Icon stays generic; the cancelled-state screen renders its
// own banner with explicit copy.
const STATUS_CONFIG: Record<TripStatus, { labelKey: string; bgColor: string; textColor: string; icon: string }> = {
  confirmed: { labelKey: "my_trip_status.status_confirmed", bgColor: GREEN_BG, textColor: GREEN, icon: "checkmark-circle" },
  pending:   { labelKey: "my_trip_status.status_pending",   bgColor: GOLD_BG,  textColor: GOLD,  icon: "time" },
  waitlist:  { labelKey: "my_trip_status.status_waitlist",  bgColor: "rgba(0,198,174,0.1)", textColor: TEAL, icon: "hourglass" },
  cancelled: { labelKey: "my_trip_status.status_cancelled", bgColor: RED_BG,   textColor: RED,   icon: "close-circle" },
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
  // A.7 — useMyTripStatus now subscribes to participant + payment realtime.
  const myStatus = useMyTripStatus(tripId, user?.id ?? '');
  const publicTrip = usePublicTrip('', tripId);
  // A.4 — fetch itinerary days + activities. read-only for participants.
  const itinerary = useItineraryBuilder(tripId);

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

  // Map participant.status → screen TripStatus union. A.6 splits
  // cancelled out so it can short-circuit to its own dedicated render
  // (no checklist, no payment progress, no "pay your deposit" nudge).
  const participantStatus: TripStatus =
    participant.status === 'confirmed' ? 'confirmed'
    : participant.status === 'waitlist' ? 'waitlist'
    : participant.status === 'cancelled' ? 'cancelled'
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

  // ── A.6 — Cancelled fast-path ─────────────────────────────────────────
  // Migration 243 (View-trip-dashboard C.1) actively cancels participants
  // via the 48h auto-release cron — this branch now has live traffic.
  // Render a focused screen: header + cancelled banner + minimal hero. No
  // checklist, no payment CTAs, no installment schedule.
  if (participantStatus === 'cancelled') {
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={22} color={RED} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelledBannerTitle}>
                {t("my_trip_status.cancelled_banner_title")}
              </Text>
              <Text style={styles.cancelledBannerBody}>
                {t("my_trip_status.cancelled_banner_body")}
              </Text>
              {participant.cancellationReason ? (
                <Text style={styles.cancelledBannerReason}>
                  {t("my_trip_status.cancelled_reason", {
                    reason: participant.cancellationReason,
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.miniHero}>
            <LinearGradient colors={[NAVY, "#143A6B"]} style={styles.miniHeroGradient}>
              <Text style={styles.miniHeroName}>{tripName || t('my_trips.untitled_trip')}</Text>
              <View style={styles.miniHeroMeta}>
                {destination ? (
                  <View style={styles.miniHeroMetaItem}>
                    <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.miniHeroMetaText}>{destination}</Text>
                  </View>
                ) : null}
                {formatDateRange() ? (
                  <View style={styles.miniHeroMetaItem}>
                    <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.miniHeroMetaText}>{formatDateRange()}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.statusPill, { backgroundColor: RED_BG }]}>
                <Text style={[styles.statusPillText, { color: RED }]}>
                  {t("my_trip_status.status_cancelled")}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
  // Join-trip Bucket A.5 — the deposit row was previously a status badge
  // with no actionScreen, so an unpaid participant had no path from
  // MyTripStatus to TripPayment. Wire it to TripPayment with
  // paymentType='deposit' when the participant is unpaid; the screen
  // resolves the deposit amount from the trip itself.
  const isUnpaid = participant.paymentStatus === 'unpaid';
  const isDepositPaid = participant.paymentStatus === 'deposit_paid' || participant.paymentStatus === 'partial';
  const isPaidInFull = participant.paymentStatus === 'paid_in_full' || (totalCost > 0 && totalPaid >= totalCost);

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
          isPaidInFull || isDepositPaid
            ? `$${totalPaid.toLocaleString()}`
            : t('my_trip_status.checklist_deposit_pending'),
        completed: isPaidInFull || isDepositPaid,
        actionLabel: isUnpaid ? t('my_trip_status.checklist_action_pay') : undefined,
        actionScreen: isUnpaid ? 'TripPayment' : undefined,
        actionParams: isUnpaid
          ? { participantId: participant.id, paymentType: 'deposit' }
          : undefined,
        urgent: isUnpaid,
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
          isPaidInFull
            ? t('my_trip_status.checklist_paid_in_full')
            : `$${Math.max(0, totalCost - totalPaid).toLocaleString()} ${t('my_trip_status.checklist_remaining')}`,
        completed: isPaidInFull,
        actionLabel: isPaidInFull ? undefined : t('my_trip_status.checklist_action_pay'),
        actionScreen: isPaidInFull ? undefined : 'TripPayment',
        actionParams: { participantId: participant.id, paymentType: 'full' },
      },
    ],
  };

  const statusCfg = STATUS_CONFIG[data.status];

  // Join-trip Bucket B.3 — payment status chip config. Derives from the
  // canonical participant.paymentStatus and falls back to "pending" when
  // unpaid + still pending registration. We treat any pending trip_payment
  // row with a due_date in the past as overdue so the chip can flag it.
  const hasOverdue = payments.some(
    (p) =>
      p.status === "pending" &&
      // mapPayment exposes `paidAt` and `createdAt`; we treat
      // (createdAt + 1 day) as a placeholder due-window stand-in if the
      // engine ever stamps a real due_date we should switch to it.
      false, // disabled until trip_payments carries a real per-row due_date
  );
  const paymentChipConfig = (() => {
    if (isPaidInFull) {
      return {
        label: t("my_trip_status.payment_status_paid_in_full"),
        bgColor: GREEN_BG,
        textColor: GREEN,
        icon: "checkmark-circle",
      };
    }
    if (hasOverdue) {
      return {
        label: t("my_trip_status.payment_status_overdue"),
        bgColor: RED_BG,
        textColor: RED,
        icon: "alert-circle",
      };
    }
    if (isDepositPaid) {
      return {
        label: t("my_trip_status.payment_status_deposit_paid"),
        bgColor: GOLD_BG,
        textColor: GOLD,
        icon: "checkmark-done",
      };
    }
    return {
      label: t("my_trip_status.payment_status_pending"),
      bgColor: GOLD_BG,
      textColor: GOLD,
      icon: "time-outline",
    };
  })();

  // Find the next pending payment row to surface its due date in the
  // header. Sort by paidAt (proxy for ordering when due_date is unset)
  // and pick the earliest pending. If none, just don't show the line.
  const nextFinalDueIso: string | null = (() => {
    const pending = payments
      .filter((p) => p.status === "pending" && p.type !== "deposit")
      .sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
    return pending.length > 0 ? pending[0].paidAt ?? null : null;
  })();

  const formatDueDate = (iso: string | null): string => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  // payments are now rendered in the history list (B.5) below; no longer dead.

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

        {/* ── Status Banner — A.8 i18n template ────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bgColor }]}>
          <Ionicons name={statusCfg.icon as any} size={20} color={statusCfg.textColor} />
          <Text style={[styles.statusBannerText, { color: statusCfg.textColor }]}>
            {t('my_trip_status.registration_status', { status: t(statusCfg.labelKey) })}
          </Text>
        </View>

        {/* Join-trip Bucket A.5 — explicit "pay your deposit" nudge for
            anyone still unpaid. Without this, a freshly-registered user
            sees "Registration Pending" and no instruction to do anything;
            the checklist deposit row also points to TripPayment, but a
            dedicated banner makes the next step unmissable. */}
        {isUnpaid && (
          <TouchableOpacity
            style={styles.depositBanner}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('TripPayment', {
                tripId: data.id,
                participantId: participant.id,
                paymentType: 'deposit',
              })
            }
          >
            <Ionicons name="card-outline" size={20} color={GOLD} />
            <View style={{ flex: 1 }}>
              <Text style={styles.depositBannerText}>
                {t('trip_payment.deposit_confirmation_banner')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={GOLD} />
          </TouchableOpacity>
        )}

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
                {t(statusCfg.labelKey)}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Payment Progress ────────────────────────────────────────── */}
        {/* Join-trip Bucket B.3 — added an explicit status chip + final-due
            line. The chip reflects participant.paymentStatus, the line
            shows the next installment's due date if one is pending. */}
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
              {t('my_trip_status.payment_summary', {
                paid: `$${data.totalPaid.toLocaleString()}`,
                total: `$${data.totalCost.toLocaleString()}`,
              })}
            </Text>
          </View>
          <View style={styles.paymentChipRow}>
            <View
              style={[
                styles.paymentChip,
                paymentChipConfig.bgColor && { backgroundColor: paymentChipConfig.bgColor },
              ]}
            >
              <Ionicons
                name={paymentChipConfig.icon as any}
                size={12}
                color={paymentChipConfig.textColor}
              />
              <Text style={[styles.paymentChipText, { color: paymentChipConfig.textColor }]}>
                {paymentChipConfig.label}
              </Text>
            </View>
            {nextFinalDueIso && (
              <Text style={styles.finalDueText}>
                {t('my_trip_status.payment_status_final_due', {
                  date: formatDueDate(nextFinalDueIso),
                })}
              </Text>
            )}
          </View>
        </View>

        {/* ── A.5 — Installment schedule ──────────────────────────────
            Reuses the same component the organizer dashboard renders.
            showStatus=true so each installment row reports paid /
            upcoming / overdue based on the participant's trip_payments
            history. The component handles its own empty state. */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            {t('my_trip_status.payment_schedule_title')}
          </Text>
          <InstallmentScheduleView
            schedule={trip?.installmentSchedule}
            payments={payments as any}
            showStatus
          />
        </View>

        {/* ── A.4 — Itinerary ─────────────────────────────────────────
            Read-only render of trip_days + trip_activities for
            participants. Hidden when itinerary is still loading; falls
            back to an empty-state line when the organizer hasn't added
            anything yet. */}
        {!itinerary.loading && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>
              {t('my_trip_status.itinerary_title')}
            </Text>
            {itinerary.days.length === 0 ? (
              <View style={styles.itineraryEmpty}>
                <Ionicons name="map-outline" size={32} color={colors.textSecondary} />
                <Text style={styles.itineraryEmptyText}>
                  {t('my_trip_status.itinerary_empty')}
                </Text>
              </View>
            ) : (
              <View style={styles.itineraryList}>
                {itinerary.days.map((day, idx) => (
                  <View key={day.id} style={[styles.itineraryDay, idx > 0 && styles.itineraryDayBorder]}>
                    <Text style={styles.itineraryDayTitle}>
                      {t('my_trip_status.itinerary_day', { number: idx + 1 })}
                      {day.title ? ` — ${day.title}` : ''}
                    </Text>
                    {day.activities.length === 0 ? (
                      <Text style={styles.itineraryActivityMuted}>
                        {t('my_trip_status.itinerary_day_empty')}
                      </Text>
                    ) : (
                      day.activities.map((act) => (
                        <View key={act.id} style={styles.itineraryActivityRow}>
                          <View style={styles.itineraryActivityBullet} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itineraryActivityTitle}>
                              {act.title}
                            </Text>
                            <Text style={styles.itineraryActivityMeta}>
                              {[act.startTime, act.location].filter(Boolean).join(' · ') || act.categoryTag}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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

        {/* ── Payment History — Join-trip Bucket B.5 ─────────────────────
            Real participant.payments list, now possible after the A.1
            engine fix (trip_participant_id column). Renders compactly:
            date, type, amount, paid/pending tag. */}
        <View style={styles.paymentHistorySection}>
          <Text style={styles.paymentHistoryHeader}>
            {t("my_trip_status.payment_history_title")}
          </Text>
          {payments.length === 0 ? (
            <Text style={styles.paymentHistoryEmpty}>
              {t("my_trip_status.payment_history_empty")}
            </Text>
          ) : (
            payments.map((p, i) => {
              const typeKey =
                p.type === "deposit"
                  ? "my_trip_status.payment_type_deposit"
                  : p.type === "installment"
                  ? "my_trip_status.payment_type_installment"
                  : "my_trip_status.payment_type_full";
              const isPending = p.status === "pending";
              return (
                <View
                  key={p.id}
                  style={[
                    styles.paymentHistoryRow,
                    i === 0 && styles.paymentHistoryRowFirst,
                  ]}
                >
                  <Text style={styles.paymentHistoryDate}>
                    {formatDueDate(p.paidAt ?? p.createdAt ?? null)}
                  </Text>
                  <Text style={styles.paymentHistoryType}>{t(typeKey)}</Text>
                  <Text style={styles.paymentHistoryAmount}>
                    ${(p.amountCents || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text
                    style={
                      isPending
                        ? styles.paymentHistoryStatusPending
                        : styles.paymentHistoryStatusPaid
                    }
                  >
                    {isPending
                      ? t("my_trip_status.payment_history_status_pending")
                      : t("my_trip_status.payment_history_status_paid")}
                  </Text>
                </View>
              );
            })
          )}
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

  // Join-trip Bucket A.5 — deposit nudge banner.
  depositBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: GOLD_BG,
    borderRadius: radius.small,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  depositBannerText: {
    fontSize: typography.body,
    color: GOLD,
    fontWeight: typography.semibold,
    flex: 1,
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

  // Join-trip Bucket B.3 — payment chip + due-date line.
  paymentChipRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  paymentChipText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
  },
  finalDueText: {
    fontSize: typography.label,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  // Join-trip Bucket B.5 — participant payment history.
  paymentHistorySection: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentHistoryHeader: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 8,
  },
  paymentHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  paymentHistoryRowFirst: {
    borderTopWidth: 0,
  },
  paymentHistoryDate: {
    fontSize: typography.label,
    color: colors.textSecondary,
    width: 90,
  },
  paymentHistoryType: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
    flex: 1,
  },
  paymentHistoryAmount: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
    marginRight: 8,
  },
  paymentHistoryStatusPaid: {
    fontSize: typography.label,
    color: GREEN,
    fontWeight: typography.bold,
  },
  paymentHistoryStatusPending: {
    fontSize: typography.label,
    color: GOLD,
    fontWeight: typography.bold,
  },
  paymentHistoryEmpty: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: 8,
    textAlign: "center",
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

  // ── A.6 — cancelled banner ─────────────────────────────────────────
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: RED_BG,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  },
  cancelledBannerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: RED,
    marginBottom: 4,
  },
  cancelledBannerBody: {
    fontSize: typography.body,
    color: NAVY,
    lineHeight: 20,
  },
  cancelledBannerReason: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // ── A.4 — itinerary section ────────────────────────────────────────
  itineraryEmpty: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  itineraryEmptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  itineraryList: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itineraryDay: {
    padding: 16,
  },
  itineraryDayBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itineraryDayTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 10,
  },
  itineraryActivityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  itineraryActivityBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
    marginTop: 8,
  },
  itineraryActivityTitle: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.semibold,
  },
  itineraryActivityMeta: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itineraryActivityMuted: {
    fontSize: typography.label,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
