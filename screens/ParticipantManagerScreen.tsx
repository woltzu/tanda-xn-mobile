// ══════════════════════════════════════════════════════════════════════════════
// screens/ParticipantManagerScreen.tsx — Roster of trip participants
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { tripId: string }
//
// View-trip-dashboard Bucket A fixes:
//   A.4 — added a 4th `cancelled` filter tab. Cancelled rows used to be
//         invisible (the 3-tab filter implicitly hid them). Default tab
//         stays `confirmed`.
//   A.5 — fixed field access. The old local `Participant` interface
//         declared snake_case fields (`first_name`, `last_name`,
//         `payment_status`, `doc_status`) that don't exist on the
//         engine's `TripParticipant`. The screen literally rendered
//         "undefined undefined" for names and "undefined · undefined"
//         for the sub-text. Now reads `paymentStatus` + the boolean
//         `documentsComplete` (exposed by mapParticipant in this
//         bucket's engine edit), and resolves display names via a
//         bulk profile lookup (one query for the whole roster).
//
//         Also wires the badge styling + i18n: each payment_status
//         and document status maps to a colored chip via the
//         `participant_manager.status_*` namespace.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTypedNavigation } from '../hooks/useTypedNavigation';
import { Routes } from '../lib/routes';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useParticipantManager } from '../hooks/useTripOrganizer';
import { supabase } from '../lib/supabase';
import type { TripParticipant } from '../services/TripOrganizerEngine';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const GREEN = '#047857';
const RED = '#DC2626';
const BLUE = '#2563EB';
const GRAY = '#6B7280';
const BG = '#F5F7FA';

// --- Types ---
type FilterTab = 'confirmed' | 'pending' | 'waitlist' | 'cancelled';

// Status filter config — each tab maps directly to a TripParticipant.status
// value. View-trip-dashboard A.4 added `cancelled` as the 4th tab.
const FILTER_TABS: { key: FilterTab; labelKey: string; color: string }[] = [
  { key: 'confirmed', labelKey: 'participant_manager.status_confirmed', color: GREEN },
  { key: 'pending',   labelKey: 'participant_manager.status_pending',   color: GOLD },
  { key: 'waitlist',  labelKey: 'participant_manager.status_waitlist',  color: TEAL },
  { key: 'cancelled', labelKey: 'participant_manager.status_cancelled', color: RED },
];

// Status-pill config keyed by FilterTab (which mirrors participant.status).
const STATUS_PILL: Record<FilterTab, { color: string; bg: string; labelKey: string; avatarBg: string }> = {
  confirmed: {
    color: GREEN,
    bg: '#ECFDF5',
    labelKey: 'participant_manager.status_confirmed',
    avatarBg: '#D1FAE5',
  },
  pending: {
    color: '#92400E',
    bg: '#FFF7ED',
    labelKey: 'participant_manager.status_pending',
    avatarBg: '#FEF3C7',
  },
  waitlist: {
    color: TEAL,
    bg: 'rgba(0,198,174,0.1)',
    labelKey: 'participant_manager.status_waitlist',
    avatarBg: 'rgba(0,198,174,0.15)',
  },
  cancelled: {
    color: RED,
    bg: '#FEE2E2',
    labelKey: 'participant_manager.status_cancelled',
    avatarBg: '#FECACA',
  },
};

// Payment-status chip config — covers every value the engine's
// PaymentStatus union can hold + 'refunded' as a safety net (the
// trip_payments path can produce refunded; trip_participants only
// stores unpaid/deposit_paid/partial/paid_in_full but we map all five
// so a future schema change doesn't render raw snake_case).
const PAYMENT_BADGE: Record<string, { labelKey: string; color: string; bg: string }> = {
  unpaid:       { labelKey: 'participant_manager.payment_unpaid',       color: RED,   bg: '#FEE2E2' },
  deposit_paid: { labelKey: 'participant_manager.payment_deposit_paid', color: BLUE,  bg: '#DBEAFE' },
  partial:      { labelKey: 'participant_manager.payment_partial',      color: GOLD,  bg: '#FEF3C7' },
  paid_in_full: { labelKey: 'participant_manager.payment_paid_in_full', color: GREEN, bg: '#D1FAE5' },
  refunded:     { labelKey: 'participant_manager.payment_refunded',     color: GRAY,  bg: '#F3F4F6' },
};

// --- Helpers ---
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase() || '?';
};

const ParticipantManagerScreen: React.FC = () => {
  const navigation = useTypedNavigation();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const tripId: string = route.params?.tripId ?? '';
  const { participants, loading } = useParticipantManager(tripId);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('confirmed');

  // ── Bulk profile lookup ────────────────────────────────────────────────
  // Engine's getParticipants doesn't join profiles (user_id → auth.users,
  // no FK to public.profiles). Fetch the name map once per participant
  // set and look up on render. Same pattern as ParticipantDetailScreen's
  // one-shot lookup, batched for the list.
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!participants || participants.length === 0) {
      setNameMap({});
      return;
    }
    let cancelled = false;
    const userIds = Array.from(new Set(participants.map((p) => p.userId).filter(Boolean)));
    if (userIds.length === 0) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, display_name')
        .in('id', userIds);
      if (cancelled || error || !data) return;
      const map: Record<string, string> = {};
      for (const row of data) {
        const name =
          (row.full_name as string)?.trim() ||
          (row.display_name as string)?.trim() ||
          '';
        if (name) map[row.id as string] = name;
      }
      setNameMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [participants]);

  const allParticipants: TripParticipant[] = participants ?? [];

  const counts: Record<FilterTab, number> = useMemo(
    () => ({
      confirmed: allParticipants.filter((p) => p.status === 'confirmed').length,
      pending:   allParticipants.filter((p) => p.status === 'pending').length,
      waitlist:  allParticipants.filter((p) => p.status === 'waitlist').length,
      cancelled: allParticipants.filter((p) => p.status === 'cancelled').length,
    }),
    [allParticipants],
  );

  const filteredParticipants = useMemo(
    () => allParticipants.filter((p) => p.status === activeFilter),
    [allParticipants, activeFilter],
  );

  const navigateToDetail = useCallback(
    (participantId: string) => {
      navigation.navigate(Routes.ParticipantDetail, { tripId, participantId });
    },
    [navigation, tripId],
  );

  // ── Sub-components (closure over t + nameMap) ──────────────────────────

  function AvatarCircle({ status, displayName }: { status: FilterTab; displayName: string }) {
    const config = STATUS_PILL[status];
    return (
      <View style={[styles.avatar, { backgroundColor: config.avatarBg }]}>
        <Text style={[styles.avatarText, { color: config.color }]}>{getInitials(displayName)}</Text>
      </View>
    );
  }

  function StatusBadge({ status }: { status: FilterTab }) {
    const config = STATUS_PILL[status];
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusBadgeText, { color: config.color }]}>
          {t(config.labelKey)}
        </Text>
      </View>
    );
  }

  function PaymentBadge({ paymentStatus }: { paymentStatus: string }) {
    const cfg = PAYMENT_BADGE[paymentStatus] ?? {
      labelKey: '',
      color: GRAY,
      bg: '#F3F4F6',
    };
    const label = cfg.labelKey ? t(cfg.labelKey) : paymentStatus;
    return (
      <View style={[styles.subBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.subBadgeText, { color: cfg.color }]}>{label}</Text>
      </View>
    );
  }

  function DocBadge({ done }: { done: boolean }) {
    return done ? (
      <View style={[styles.subBadge, { backgroundColor: '#D1FAE5' }]}>
        <Ionicons name="checkmark" size={11} color={GREEN} />
        <Text style={[styles.subBadgeText, { color: GREEN }]}>
          {t('participant_manager.doc_verified')}
        </Text>
      </View>
    ) : (
      <View style={[styles.subBadge, { backgroundColor: '#FEF3C7' }]}>
        <Text style={[styles.subBadgeText, { color: GOLD }]}>
          {t('participant_manager.doc_pending')}
        </Text>
      </View>
    );
  }

  function ParticipantRow({ participant }: { participant: TripParticipant }) {
    const displayName =
      nameMap[participant.userId]?.trim() ||
      t('participant_manager.unknown_participant');
    const status = (participant.status as FilterTab) ?? 'pending';
    return (
      <TouchableOpacity
        style={styles.participantRow}
        activeOpacity={0.7}
        onPress={() => navigateToDetail(participant.id)}
      >
        <AvatarCircle status={status} displayName={displayName} />
        <View style={styles.participantInfo}>
          <Text style={styles.participantName} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.subBadgesRow}>
            <PaymentBadge paymentStatus={participant.paymentStatus} />
            <DocBadge done={participant.documentsComplete} />
          </View>
        </View>
        <StatusBadge status={status} />
      </TouchableOpacity>
    );
  }

  function EmptyFilterState() {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>
          {t('participant_manager.empty_title', {
            label: t(STATUS_PILL[activeFilter].labelKey).toLowerCase(),
          })}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'confirmed'
            ? t('participant_manager.empty_confirmed')
            : activeFilter === 'pending'
              ? t('participant_manager.empty_pending')
              : activeFilter === 'waitlist'
                ? t('participant_manager.empty_waitlist')
                : t('participant_manager.empty_cancelled')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('participant_manager.header_title')}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{allParticipants.length}</Text>
          </View>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Filter Tabs — 4 tabs at flex:1 each. A.4 added cancelled. */}
      <View style={styles.filterContainer}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, isActive && { borderBottomColor: tab.color }]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive && { color: tab.color, fontWeight: typography.semibold },
                ]}
                numberOfLines={1}
              >
                {t(tab.labelKey)}
              </Text>
              <View
                style={[
                  styles.filterCount,
                  { backgroundColor: isActive ? tab.color + '20' : '#F3F4F6' },
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    { color: isActive ? tab.color : colors.textSecondary },
                  ]}
                >
                  {counts[tab.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Participant List */}
      <FlatList
        data={filteredParticipants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ParticipantRow participant={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading ? <EmptyFilterState /> : null}
      />
    </SafeAreaView>
  );
};

export default ParticipantManagerScreen;

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { padding: spacing.xs, width: 36 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  countBadge: {
    backgroundColor: TEAL,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: typography.label,
    fontWeight: typography.bold,
  },

  // Filter tabs — 4-tab layout. Reduced horizontal padding so the
  // label + count chip both fit on a 360px-wide phone without
  // truncation.
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  filterTabText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  filterCount: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  filterCountText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },

  // List rows
  listContent: { paddingVertical: spacing.sm, paddingBottom: 100 },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },
  participantInfo: { flex: 1, marginLeft: spacing.md, gap: 4 },
  participantName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  subBadgesRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  subBadgeText: {
    fontSize: 11,
    fontWeight: typography.semibold,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
