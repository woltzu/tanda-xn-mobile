import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useTripDashboard } from '../hooks/useTripOrganizer';
import InstallmentScheduleView from '../components/InstallmentScheduleView';
import { TripShareSheet } from '../components/TripShareSheet';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Types ---
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
  docs_complete: number;
  docs_total: number;
  docs_missing_count: number;
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
  void loading; // hook-result for future loading skeleton; intentionally unused

  // Map hook's TripDashboard (camelCase) to screen's DashboardData (snake_case)
  const data: DashboardData = dashboard ? {
    trip_name: dashboard.trip?.name ?? 'Untitled Trip',
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
    docs_complete: 0,
    docs_total: 0,
    docs_missing_count: 0,
  } : {
    trip_name: 'Loading...',
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
    docs_complete: 0,
    docs_total: 0,
    docs_missing_count: 0,
  };

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
    { key: 'share',        icon: 'share-social-outline', label: t('trip.dashboard_action_share'), onPress: () => setShareSheetOpen(true), color: '#7C3AED' },
  ];

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
              <TouchableOpacity
                onPress={() => navigation.navigate('CreateTripWizard', { tripId, mode: 'edit' })}
                style={styles.heroBtn}
              >
                <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
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
          onPress={() => navigation.navigate('TripPublicPage', {
            tripId,
            slug: dashboard?.trip?.slug,
          })}
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

        {/* Payment Schedule (organizer view: no per-row status badges) */}
        <View style={styles.scheduleWrap}>
          <Text style={styles.sectionTitle}>{t("final_polish.organizertripdashboard_payment_schedule")}</Text>
          <InstallmentScheduleView
            schedule={dashboard?.trip?.installmentSchedule}
            showStatus={false}
          />
        </View>

        {/* Documents Progress */}
        <View style={styles.card}>
          <ProgressBar
            label={t('trip.dashboard_docs_progress')}
            current={data.docs_complete}
            total={data.docs_total}
            color={GOLD}
          />
        </View>

        {/* Alert Banner */}
        {data.docs_missing_count > 0 && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>
              {'\u26A0'} {data.docs_missing_count} participant{data.docs_missing_count > 1 ? 's' : ''} missing docs
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t("final_polish.organizertripdashboard_quick_actions")}</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.key}
              icon={action.icon}
              label={action.label}
              color={action.color}
              onPress={
                action.onPress
                  ? action.onPress
                  : () => navigation.navigate(action.route!, { tripId })
              }
            />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Publish-trip Bucket B.3 — multi-channel share sheet. */}
      <TripShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        slug={dashboard?.trip?.slug ?? ''}
        tripName={data.trip_name}
        destination={data.destination}
        startDate={data.start_date || null}
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
  // Alert
  alertBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.small,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
  },
  alertText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: '#92400E',
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
});
