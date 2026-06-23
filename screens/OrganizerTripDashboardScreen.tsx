import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Platform,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from "react-i18next";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useTripDashboard } from '../hooks/useTripOrganizer';
import { useEventTracker } from '../hooks/useEventTracker';
import InstallmentScheduleView from '../components/InstallmentScheduleView';
import { TripShareSheet } from '../components/TripShareSheet';

// View-trip-dashboard B.1 — HelpSheet topics. B.4 — coach mark
// AsyncStorage key (versioned suffix for future re-prompts).
type HelpTopic = 'stats' | 'lifecycle' | 'quick_actions' | 'editing';
const HELP_TOPICS: HelpTopic[] = ['stats', 'lifecycle', 'quick_actions', 'editing'];
const DASHBOARD_COACH_KEY = '@tandaxn_trip_dashboard_coach_seen_v1';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Types ---
// View-trip-dashboard A.7 — `docs_complete`/`docs_total`/`docs_missing_count`
// were hardcoded to 0 (the hook doesn't expose docs aggregates). Dropped
// the fields entirely along with the dead progress bar + alert banner so
// the dashboard doesn't lie about state it can't compute.
interface DashboardData {
  trip_name: string;
  destination: string;
  cover_image_url?: string;
  start_date: string;
  end_date: string;
  status: string;
  confirmed_count: number;
  pending_count: number;
  waitlist_count: number;
  total_collected: number;
  total_target: number;
}

// Publish-trip Bucket B.3 — quick actions can either navigate to a route
// (keep the existing tiles) or run an inline onPress (the new Share tile
// has no route to navigate to). The `onPress` field overrides `route`
// when present.
interface QuickAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  color: string;
}

// --- Sub-components ---

const StatBox: React.FC<{ label: string; value: number; color: string; bgColor: string }> = ({
  label, value, color, bgColor,
}) => (
  <View style={[styles.statBox, { backgroundColor: bgColor }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ProgressBar: React.FC<{
  label: string;
  current: number;
  total: number;
  color: string;
  prefix?: string;
}> = ({ label, current, total, color, prefix }) => {
  const { t } = useTranslation();

  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {prefix}{current.toLocaleString()} / {prefix}{total.toLocaleString()}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
    </View>
  );
};

const QuickActionCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// --- Screen ---

const OrganizerTripDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const tripId: string = route.params?.tripId ?? '';
  const { dashboard, loading } = useTripDashboard(tripId);

  // Publish-trip Bucket B.3 — share sheet wired to the new "Share" quick
  // action. Same multi-channel sheet that ships on the publish-success
  // screen and the public page; the dashboard is the third surface.
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // View-trip-dashboard A.6 — render a skeleton while the first fetch is
  // in flight. The hook returns `loading=true, dashboard=null` on cold
  // load; once data lands `loading` flips back to false. We gate on
  // `loading && !dashboard` so that subsequent refreshes don't blank
  // the screen.
  const showSkeleton = loading && !dashboard;

  // B.1 — HelpSheet state. B.4 — first-visit coach mark on the quick
  // actions row; AsyncStorage-gated + auto-dismiss after 4s.
  const [helpOpen, setHelpOpen] = useState(false);
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);

  // View-trip-dashboard C.3 — telemetry. One-shot viewed event on cold
  // mount (gated on tripId so we don't fire for missing-route cases).
  const { track } = useEventTracker();
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    if (!tripId) return;
    viewedFiredRef.current = true;
    track({
      eventType: 'trip_dashboard.viewed',
      eventCategory: 'cross_border',
      eventAction: 'view',
      eventLabel: 'organizer_trip_dashboard',
      eventValue: { trip_id: tripId },
    });
  }, [tripId, track]);

  // Map hook's TripDashboard (camelCase) to screen's DashboardData (snake_case)
  const data: DashboardData = dashboard ? {
    trip_name: dashboard.trip?.name ?? t('trip_dashboard.untitled_trip'),
    destination: dashboard.trip?.destination ?? '',
    cover_image_url: dashboard.trip?.coverPhotoUrl ?? undefined,
    start_date: dashboard.trip?.startDate ?? '',
    end_date: dashboard.trip?.endDate ?? '',
    status: dashboard.trip?.status ?? 'draft',
    confirmed_count: dashboard.stats?.confirmed ?? 0,
    pending_count: dashboard.stats?.pending ?? 0,
    waitlist_count: dashboard.stats?.waitlist ?? 0,
    total_collected: dashboard.paymentSummary?.totalCollected ?? 0,
    total_target: dashboard.paymentSummary?.totalExpected ?? 0,
  } : {
    trip_name: '',
    destination: '',
    cover_image_url: undefined,
    start_date: '',
    end_date: '',
    status: 'draft',
    confirmed_count: 0,
    pending_count: 0,
    waitlist_count: 0,
    total_collected: 0,
    total_target: 0,
  };

  // View-trip-dashboard A.8 — empty-state gate. Shown when the trip has
  // zero seats accounted for across all statuses (i.e. no one has joined
  // and no one is waitlisted). Cancelled rows are intentionally excluded
  // — a cancelled-only roster is functionally empty for the organizer.
  const totalActiveParticipants =
    data.confirmed_count + data.pending_count + data.waitlist_count;
  const showEmptyState = !showSkeleton && totalActiveParticipants === 0;

  // B.4 — coach mark gating. Only show when:
  //   1) data is loaded (not skeleton),
  //   2) at least one participant exists (the coach points at quick
  //      actions which feel relevant only once there's data to act on),
  //   3) AsyncStorage hasn't seen the key yet.
  // Fades in on mount, auto-dismisses at 4s, or on tap.
  useEffect(() => {
    if (coachCheckedRef.current) return;
    if (showSkeleton || showEmptyState) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(DASHBOARD_COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable → silently skip the coach.
      }
    })();
  }, [showSkeleton, showEmptyState, coachOpacity]);

  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(DASHBOARD_COACH_KEY, '1').catch(() => undefined);
  }, [coachOpacity]);

  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // B.5 — revenue card values pulled from dashboard.paymentSummary.
  // Engine extended in this bucket to surface totalRefunded. All values
  // are dollars (engine consistently exposes dollars per A.1 fix).
  const revenueCollected = dashboard?.paymentSummary?.totalCollected ?? 0;
  const revenueExpected = dashboard?.paymentSummary?.totalExpected ?? 0;
  const revenuePending = Math.max(0, revenueExpected - revenueCollected);
  const revenueRefunded = dashboard?.paymentSummary?.totalRefunded ?? 0;
  const hasAnyRevenue = revenueExpected > 0 || revenueCollected > 0 || revenueRefunded > 0;

  const formatDateRange = (): string => {
    try {
      if (!data.start_date || !data.end_date) return '';
      const s = new Date(data.start_date);
      const e = new Date(data.end_date);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString('en-US', opts)} — ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    } catch {
      return '';
    }
  };

  // Publish-trip Bucket A.6 — Messages + Vendors tiles removed (routes
  //   didn't exist; navigation would crash).
  // Publish-trip Bucket B.3 — Share tile added, opens the TripShareSheet.
  // Publish-trip Bucket B.5 — Updates tile points at the new TripUpdates
  //   screen so organizers can post a broadcast even when they aren't on
  //   the itinerary screen.
  const quickActions: QuickAction[] = [
    { key: 'participants', icon: 'people', label: t('trip.dashboard_action_participants'), route: 'ParticipantManager', color: TEAL },
    { key: 'itinerary',    icon: 'map',    label: t('trip.dashboard_action_itinerary'),    route: 'ItineraryBuilder',  color: GOLD },
    { key: 'updates',      icon: 'megaphone-outline', label: t('trip.dashboard_action_updates'), route: 'TripUpdates', color: NAVY },
    { key: 'share',        icon: 'share-social-outline', label: t('trip.dashboard_action_share'), onPress: () => {
        track({
          eventType: 'trip_dashboard.share_opened',
          eventCategory: 'cross_border',
          eventAction: 'open',
          eventLabel: 'trip_dashboard_share',
          eventValue: { trip_id: tripId },
        });
        setShareSheetOpen(true);
      }, color: '#7C3AED' },
  ];

  // View-trip-dashboard A.6 — skeleton state. Mirrors the dashboard's
  // layout shape so the page doesn't visually jump when data lands.
  if (showSkeleton) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Hero placeholder */}
          <View style={[styles.hero, styles.skeletonHero]}>
            <View style={styles.heroHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.heroBtn} />
            </View>
            <View style={[styles.heroContent, { gap: 8 }]}>
              <View style={[styles.skeletonBlock, { width: '70%', height: 24 }]} />
              <View style={[styles.skeletonBlock, { width: '50%', height: 16 }]} />
              <View style={[styles.skeletonBlock, { width: '40%', height: 12 }]} />
            </View>
          </View>
          {/* Stats placeholder */}
          <View style={styles.statRow}>
            <View style={[styles.statBox, styles.skeletonStat]} />
            <View style={[styles.statBox, styles.skeletonStat]} />
            <View style={[styles.statBox, styles.skeletonStat]} />
          </View>
          {/* Cards placeholders */}
          <View style={[styles.card, { height: 86 }]}>
            <View style={[styles.skeletonBlock, { width: '40%', height: 14, marginBottom: 12 }]} />
            <View style={[styles.skeletonBlock, { width: '100%', height: 8 }]} />
          </View>
          <View style={[styles.card, { height: 110 }]}>
            <View style={[styles.skeletonBlock, { width: '50%', height: 14, marginBottom: 12 }]} />
            <View style={[styles.skeletonBlock, { width: '100%', height: 12, marginBottom: 8 }]} />
            <View style={[styles.skeletonBlock, { width: '80%', height: 12 }]} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <ImageBackground
          source={data.cover_image_url ? { uri: data.cover_image_url } : undefined}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay}>
            {/* Header buttons */}
            <View style={styles.heroHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* B.1 — (?) help trigger sits beside the settings icon. */}
                <TouchableOpacity
                  onPress={() => setHelpOpen(true)}
                  style={styles.heroBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('trip_dashboard.help_open_a11y')}
                >
                  <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    track({
                      eventType: 'trip_dashboard.edit_tapped',
                      eventCategory: 'cross_border',
                      eventAction: 'tap',
                      eventLabel: 'edit_trip',
                      eventValue: { trip_id: tripId },
                    });
                    navigation.navigate('CreateTripWizard', { tripId, mode: 'edit' });
                  }}
                  style={styles.heroBtn}
                >
                  <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trip info */}
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{data.trip_name}</Text>
              <Text style={styles.heroSubtitle}>{data.destination}</Text>
              <Text style={styles.heroDate}>{formatDateRange()}</Text>
            </View>
          </View>
        </ImageBackground>

        {/* Status Pills */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: TEAL + '20' }]}>
            <Text style={[styles.statusPillText, { color: TEAL }]}>
              {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* View Public Page link */}
        <TouchableOpacity
          style={styles.viewPublicBtn}
          activeOpacity={0.7}
          onPress={() => {
            track({
              eventType: 'trip_dashboard.public_page_opened',
              eventCategory: 'cross_border',
              eventAction: 'tap',
              eventLabel: 'view_public_page',
              eventValue: { trip_id: tripId },
            });
            navigation.navigate('TripPublicPage', {
              tripId,
              slug: dashboard?.trip?.slug,
            });
          }}
        >
          <Ionicons name="eye-outline" size={18} color={TEAL} />
          <Text style={styles.viewPublicText}>{t("final_polish.organizertripdashboard_view_public_page")}</Text>
          <Ionicons name="arrow-forward" size={16} color={TEAL} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Stat Boxes */}
        <View style={styles.statRow}>
          <StatBox label={t('trip.dashboard_stat_confirmed')} value={data.confirmed_count} color="#047857" bgColor={colors.successBg} />
          <StatBox label={t('trip.dashboard_stat_pending')}   value={data.pending_count}   color={GOLD} bgColor="#FFF7ED" />
          <StatBox label={t('trip.dashboard_stat_waitlist')}  value={data.waitlist_count}  color={TEAL} bgColor="rgba(0,198,174,0.1)" />
        </View>

        {/* View-trip-dashboard A.8 — empty-state card. Shown when no one
            has joined or is waitlisted; opens the existing TripShareSheet
            so the organizer has one obvious next step. */}
        {showEmptyState && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={32} color={TEAL} />
            </View>
            <Text style={styles.emptyTitle}>{t('trip_dashboard.empty_title')}</Text>
            <Text style={styles.emptyBody}>{t('trip_dashboard.empty_body')}</Text>
            <TouchableOpacity
              style={styles.emptyCta}
              activeOpacity={0.85}
              onPress={() => setShareSheetOpen(true)}
            >
              <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>{t('trip_dashboard.empty_cta')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment Progress */}
        <View style={styles.card}>
          <ProgressBar
            label={t('trip.dashboard_payment_progress')}
            current={data.total_collected}
            total={data.total_target}
            color={TEAL}
            prefix="$"
          />
        </View>

        {/* B.5 — Revenue summary card. Engine exposes collected,
            expected, refunded; pending is computed. Empty fallback when
            no payments / no expected total exist. */}
        <View style={styles.card}>
          <Text style={styles.revenueTitle}>
            {t('trip_dashboard.revenue_title')}
          </Text>
          {hasAnyRevenue ? (
            <View>
              <View style={styles.revenueRow}>
                <Text style={styles.revenueLabel}>
                  {t('trip_dashboard.revenue_collected')}
                </Text>
                <Text style={[styles.revenueValue, { color: '#047857' }]}>
                  ${revenueCollected.toFixed(2)}
                </Text>
              </View>
              <View style={styles.revenueRow}>
                <Text style={styles.revenueLabel}>
                  {t('trip_dashboard.revenue_expected')}
                </Text>
                <Text style={styles.revenueValue}>
                  ${revenueExpected.toFixed(2)}
                </Text>
              </View>
              <View style={styles.revenueRow}>
                <Text style={styles.revenueLabel}>
                  {t('trip_dashboard.revenue_pending')}
                </Text>
                <Text style={[styles.revenueValue, { color: GOLD }]}>
                  ${revenuePending.toFixed(2)}
                </Text>
              </View>
              {revenueRefunded > 0 && (
                <View style={styles.revenueRow}>
                  <Text style={styles.revenueLabel}>
                    {t('trip_dashboard.revenue_refunded')}
                  </Text>
                  <Text style={[styles.revenueValue, { color: '#7E22CE' }]}>
                    ${revenueRefunded.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.revenueEmpty}>
              {t('trip_dashboard.revenue_empty')}
            </Text>
          )}
        </View>

        {/* Payment Schedule (organizer view: no per-row status badges) */}
        <View style={styles.scheduleWrap}>
          <Text style={styles.sectionTitle}>{t("final_polish.organizertripdashboard_payment_schedule")}</Text>
          <InstallmentScheduleView
            schedule={dashboard?.trip?.installmentSchedule}
            showStatus={false}
          />
        </View>

        {/* View-trip-dashboard A.7 \u2014 dropped the docs progress bar +
            "X participants missing docs" alert. Both depended on
            data.docs_complete/docs_total which the hook never populates;
            the bar always read 0/0 and the alert never fired. Will be
            reinstated when the dashboard hook starts aggregating
            trip_participant_submissions. */}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t("final_polish.organizertripdashboard_quick_actions")}</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.key}
              icon={action.icon}
              label={action.label}
              color={action.color}
              onPress={() => {
                // C.3 — every quick-action tap goes through here so the
                // event fires uniformly. Share's inner onPress also
                // fires share_opened, which is fine — they're distinct
                // funnels.
                track({
                  eventType: 'trip_dashboard.quick_action_tapped',
                  eventCategory: 'cross_border',
                  eventAction: 'tap',
                  eventLabel: action.key,
                  eventValue: { trip_id: tripId },
                });
                if (action.onPress) {
                  action.onPress();
                } else if (action.route) {
                  navigation.navigate(action.route, { tripId });
                }
              }}
            />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* B.1 — HelpSheet overlay (mounted outside ScrollView). */}
      <DashboardHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* B.4 — coach mark overlay pointing at the quick actions row. */}
      {coachVisible && (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.coachCard}
            onPress={dismissCoach}
            accessibilityRole="button"
          >
            <Ionicons name="sparkles-outline" size={20} color={TEAL} />
            <Text style={styles.coachText}>{t('trip_dashboard.coach_title')}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Publish-trip Bucket B.3 — multi-channel share sheet. */}
      <TripShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        slug={dashboard?.trip?.slug ?? ''}
        tripName={data.trip_name}
        destination={data.destination}
        startDate={data.start_date || null}
        tripId={tripId || null}
      />
    </SafeAreaView>
  );
};

export default OrganizerTripDashboardScreen;

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollView: {
    flex: 1,
  },
  // Hero
  hero: {
    height: 240,
    backgroundColor: NAVY,
  },
  heroImage: {
    opacity: 0.4,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,35,66,0.65)',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: typography.bold,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: typography.bodyLarge,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  heroDate: {
    fontSize: typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  // Status
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },
  viewPublicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,198,174,0.08)',
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: 'rgba(0,198,174,0.25)',
    gap: 8,
  },
  viewPublicText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: TEAL,
  },
  // Stat boxes
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: typography.bold,
  },
  statLabel: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  // Progress
  progressSection: {},
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  progressValue: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPct: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  // View-trip-dashboard A.6 — skeleton blocks.
  skeletonHero: { backgroundColor: NAVY },
  skeletonBlock: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
  },
  skeletonStat: {
    backgroundColor: '#E5E7EB',
    height: 76,
  },
  // View-trip-dashboard A.8 — empty-state card.
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,198,174,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TEAL,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.button,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  // Quick Actions
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  // Payment Schedule section wrapper — uses the same horizontal padding as
  // other cards so the InstallmentScheduleView block lines up with them.
  scheduleWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  quickAction: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  // B.5 — revenue card rows
  revenueTitle: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: spacing.md,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  revenueLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  revenueValue: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  revenueEmpty: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  // B.4 — coach mark
  coachOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  coachCard: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
});

// ─── B.1 — HelpSheet (4 topics: stats, lifecycle, quick actions,
//          editing after publish). Same modal pattern as the other
//          HelpSheets in this app.
// ───────────────────────────────────────────────────────────────────────
function DashboardHelpSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t('trip_dashboard.help_sheet_title')}
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {HELP_TOPICS.map((key, idx) => (
              <View
                key={key}
                style={[
                  sheetStyles.helpItem,
                  idx === HELP_TOPICS.length - 1 && sheetStyles.helpItemLast,
                ]}
              >
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`trip_dashboard.help_${key}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`trip_dashboard.help_${key}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>
              {t('trip_dashboard.help_close')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    color: NAVY,
    lineHeight: 19,
  },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  helpItemLast: { borderBottomWidth: 0 },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 4,
  },
  closeBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
