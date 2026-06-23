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
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTypedNavigation } from '../hooks/useTypedNavigation';
import { Routes } from '../lib/routes';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useParticipantManager } from '../hooks/useTripOrganizer';
import { useEventTracker } from '../hooks/useEventTracker';
import { supabase } from '../lib/supabase';
import type { TripParticipant } from '../services/TripOrganizerEngine';

// View-trip-dashboard B.2 — HelpSheet topics + B.6 — sort options.
type HelpTopic = 'tabs' | 'payment_statuses' | 'what_tap_does' | 'cancellations';
type SortKey = 'name_asc' | 'name_desc' | 'registered_newest' | 'registered_oldest';
const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: 'registered_newest', labelKey: 'participant_manager.sort_registered_newest' },
  { key: 'registered_oldest', labelKey: 'participant_manager.sort_registered_oldest' },
  { key: 'name_asc',          labelKey: 'participant_manager.sort_name_asc' },
  { key: 'name_desc',         labelKey: 'participant_manager.sort_name_desc' },
];

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
  // B.2 — HelpSheet open state. B.6 — search query (raw input) + sort key
  // + small popover for picking sort. Search filters on the resolved
  // display name; sort orders by name or registration date.
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('registered_newest');
  const [sortOpen, setSortOpen] = useState(false);

  // C.3 — telemetry. Viewed one-shot, tab switches, row taps, search
  // (debounced to avoid one event per keystroke).
  const { track } = useEventTracker();
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    if (!tripId) return;
    viewedFiredRef.current = true;
    track({
      eventType: 'participant_manager.viewed',
      eventCategory: 'cross_border',
      eventAction: 'view',
      eventLabel: 'participant_manager',
      eventValue: { trip_id: tripId },
    });
  }, [tripId, track]);

  // Debounced search-used event. Fires 600ms after the last keystroke
  // with the query length (not the query string — keeps PII out).
  useEffect(() => {
    if (!searchQuery) return;
    const tid = setTimeout(() => {
      track({
        eventType: 'participant_manager.search_used',
        eventCategory: 'cross_border',
        eventAction: 'search',
        eventLabel: 'participant_manager_search',
        eventValue: { trip_id: tripId, query_length: searchQuery.length },
      });
    }, 600);
    return () => clearTimeout(tid);
  }, [searchQuery, tripId, track]);

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

  // B.6 — combine status filter + name search + sort. Name search is
  // case-insensitive substring on the resolved display name. Sort runs
  // last so it sees the search-filtered slice and stays cheap.
  const filteredParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = allParticipants.filter((p) => p.status === activeFilter);
    const searched = q
      ? base.filter((p) => {
          const name = (nameMap[p.userId] ?? '').toLowerCase();
          return name.includes(q);
        })
      : base;
    const cmpName = (a: TripParticipant, b: TripParticipant) =>
      (nameMap[a.userId] ?? '').localeCompare(nameMap[b.userId] ?? '', undefined, {
        sensitivity: 'base',
      });
    const cmpRegistered = (a: TripParticipant, b: TripParticipant) => {
      const at = new Date(a.joinedAt).getTime() || 0;
      const bt = new Date(b.joinedAt).getTime() || 0;
      return at - bt;
    };
    const sorted = [...searched];
    switch (sortKey) {
      case 'name_asc':            sorted.sort(cmpName); break;
      case 'name_desc':           sorted.sort((a, b) => -cmpName(a, b)); break;
      case 'registered_oldest':   sorted.sort(cmpRegistered); break;
      case 'registered_newest':
      default:                    sorted.sort((a, b) => -cmpRegistered(a, b)); break;
    }
    return sorted;
  }, [allParticipants, activeFilter, searchQuery, sortKey, nameMap]);

  const navigateToDetail = useCallback(
    (participantId: string) => {
      track({
        eventType: 'participant_manager.participant_row_tapped',
        eventCategory: 'cross_border',
        eventAction: 'tap',
        eventLabel: 'participant_row',
        eventValue: { trip_id: tripId, participant_id: participantId },
      });
      navigation.navigate(Routes.ParticipantDetail, { tripId, participantId });
    },
    [navigation, tripId, track],
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
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('participant_manager.help_open_a11y')}
        >
          <Ionicons name="help-circle-outline" size={24} color={NAVY} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs — 4 tabs at flex:1 each. A.4 added cancelled. */}
      <View style={styles.filterContainer}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, isActive && { borderBottomColor: tab.color }]}
              onPress={() => {
                setActiveFilter(tab.key);
                track({
                  eventType: 'participant_manager.tab_switched',
                  eventCategory: 'cross_border',
                  eventAction: 'tap',
                  eventLabel: tab.key,
                  eventValue: { trip_id: tripId },
                });
              }}
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

      {/* B.6 — search box + sort selector. Compact row so we don't
          push the list down too far. The clear-button appears once the
          user types something. */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={GRAY} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('participant_manager.search_placeholder')}
            placeholderTextColor={GRAY}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={GRAY} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSortOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('participant_manager.sort_open_a11y')}
        >
          <Ionicons name="swap-vertical" size={16} color={NAVY} />
        </TouchableOpacity>
      </View>

      {/* Participant List */}
      <FlatList
        data={filteredParticipants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ParticipantRow participant={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading ? <EmptyFilterState /> : null}
        keyboardShouldPersistTaps="handled"
      />

      {/* B.2 — HelpSheet (4 topics: tabs, payment statuses, what tap
          does, cancellations). */}
      <ManagerHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* B.6 — sort options popover. */}
      <SortSheet
        visible={sortOpen}
        current={sortKey}
        onSelect={(k) => {
          setSortKey(k);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </SafeAreaView>
  );
};

export default ParticipantManagerScreen;

// ─── B.2 — HelpSheet (4 topics: tabs / payment statuses / what tap
//          does / cancellations). Same modal pattern as the
//          ParticipantDetail and InsurancePool HelpSheets.
// ──────────────────────────────────────────────────────────────────────
const MANAGER_HELP_TOPICS: HelpTopic[] = [
  'tabs',
  'payment_statuses',
  'what_tap_does',
  'cancellations',
];

function ManagerHelpSheet({
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
            {t('participant_manager.help_sheet_title')}
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {MANAGER_HELP_TOPICS.map((key, idx) => (
              <View
                key={key}
                style={[
                  sheetStyles.helpItem,
                  idx === MANAGER_HELP_TOPICS.length - 1 && sheetStyles.helpItemLast,
                ]}
              >
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`participant_manager.help_${key}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`participant_manager.help_${key}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>
              {t('participant_manager.help_close')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── B.6 — SortSheet. Tiny picker with the 4 sort options. Each row
//          highlights the currently-selected key with a checkmark.
// ──────────────────────────────────────────────────────────────────────
function SortSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>
            {t('participant_manager.sort_sheet_title')}
          </Text>
          {SORT_OPTIONS.map((opt, idx) => {
            const active = opt.key === current;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  sheetStyles.sortRow,
                  idx === SORT_OPTIONS.length - 1 && sheetStyles.sortRowLast,
                ]}
                onPress={() => onSelect(opt.key)}
              >
                <Text
                  style={[
                    sheetStyles.sortRowText,
                    active && { color: TEAL, fontWeight: '700' },
                  ]}
                >
                  {t(opt.labelKey)}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={TEAL} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>
              {t('participant_manager.help_close')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Shared sheet styles (matches InsurancePoolScreen pattern). ──────
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
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortRowLast: { borderBottomWidth: 0 },
  sortRowText: {
    fontSize: 14,
    color: NAVY,
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

  // B.6 — search + sort row, sits above the FlatList.
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: NAVY,
    padding: 0,
  },
  sortBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
