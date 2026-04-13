import React, { useState, useCallback } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useParticipantManager } from '../hooks/useTripOrganizer';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Types ---
type ParticipantStatus = 'confirmed' | 'pending' | 'waitlist';
type FilterTab = 'confirmed' | 'pending' | 'waitlist';

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  status: ParticipantStatus;
  payment_status: string;
  doc_status: string;
}

const STATUS_CONFIG: Record<ParticipantStatus, { color: string; bg: string; label: string; avatarBg: string }> = {
  confirmed: {
    color: '#047857',
    bg: '#ECFDF5',
    label: 'Confirmed',
    avatarBg: '#D1FAE5',
  },
  pending: {
    color: '#92400E',
    bg: '#FFF7ED',
    label: 'Pending',
    avatarBg: '#FEF3C7',
  },
  waitlist: {
    color: TEAL,
    bg: 'rgba(0,198,174,0.1)',
    label: 'Waitlist',
    avatarBg: 'rgba(0,198,174,0.15)',
  },
};

const FILTER_TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: 'confirmed', label: 'Confirmed', color: '#047857' },
  { key: 'pending', label: 'Pending', color: GOLD },
  { key: 'waitlist', label: 'Waitlist', color: TEAL },
];

// --- Helpers ---

const getInitials = (first: string, last: string): string => {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;
};

// --- Sub-components ---

const AvatarCircle: React.FC<{ first: string; last: string; status: ParticipantStatus }> = ({
  first, last, status,
}) => {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.avatar, { backgroundColor: config.avatarBg }]}>
      <Text style={[styles.avatarText, { color: config.color }]}>
        {getInitials(first, last)}
      </Text>
    </View>
  );
};

const StatusBadge: React.FC<{ status: ParticipantStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const ParticipantRow: React.FC<{
  participant: Participant;
  onPress: () => void;
}> = ({ participant, onPress }) => (
  <TouchableOpacity style={styles.participantRow} activeOpacity={0.7} onPress={onPress}>
    <AvatarCircle
      first={participant.first_name}
      last={participant.last_name}
      status={participant.status}
    />
    <View style={styles.participantInfo}>
      <Text style={styles.participantName}>
        {participant.first_name} {participant.last_name}
      </Text>
      <Text style={styles.participantSub}>
        {participant.payment_status} {'\u00B7'} {participant.doc_status}
      </Text>
    </View>
    <StatusBadge status={participant.status} />
  </TouchableOpacity>
);

const EmptyFilterState: React.FC<{ filter: FilterTab }> = ({ filter }) => (
  <View style={styles.emptyState}>
    <Ionicons name="people-outline" size={48} color="#CBD5E1" />
    <Text style={styles.emptyTitle}>
      No {STATUS_CONFIG[filter].label.toLowerCase()} participants
    </Text>
    <Text style={styles.emptySubtitle}>
      {filter === 'confirmed'
        ? 'Participants will appear here once they confirm and pay.'
        : filter === 'pending'
        ? 'No one is pending approval right now.'
        : 'The waitlist is empty.'}
    </Text>
  </View>
);

// --- Screen ---

const ParticipantManagerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId: string = route.params?.tripId ?? '';
  const { participants, loading } = useParticipantManager(tripId);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('confirmed');

  const allParticipants: Participant[] = participants ?? [];

  const filteredParticipants = allParticipants.filter(
    (p) => p.status === activeFilter
  );

  const counts: Record<FilterTab, number> = {
    confirmed: allParticipants.filter((p) => p.status === 'confirmed').length,
    pending: allParticipants.filter((p) => p.status === 'pending').length,
    waitlist: allParticipants.filter((p) => p.status === 'waitlist').length,
  };

  const navigateToDetail = useCallback(
    (participantId: string) => {
      navigation.navigate('ParticipantDetail', { tripId, participantId });
    },
    [navigation, tripId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Participants</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{allParticipants.length}</Text>
          </View>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Filter Tabs */}
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
              >
                {tab.label}
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
        renderItem={({ item }) => (
          <ParticipantRow
            participant={item}
            onPress={() => navigateToDetail(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? <EmptyFilterState filter={activeFilter} /> : null
        }
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
  headerBtn: {
    padding: spacing.xs,
    width: 36,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  // Filters
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
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  filterTabText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  filterCount: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 6,
  },
  filterCountText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },
  // List
  listContent: {
    paddingVertical: spacing.sm,
    paddingBottom: 100,
  },
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
  participantInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  participantName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  participantSub: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
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
