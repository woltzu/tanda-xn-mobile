import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useOrganizerTrips } from '../hooks/useTripOrganizer';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Types ---
type TripStatus = 'draft' | 'published' | 'closed' | 'cancelled';
type FilterTab = 'all' | 'draft' | 'published' | 'past';

interface OrganizerTrip {
  id: string;
  trip_name: string;
  destination: string;
  cover_image_url?: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  confirmed_count: number;
  max_participants: number;
  total_collected: number;
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'past', label: 'Past' },
];

const STATUS_COLORS: Record<TripStatus, { bg: string; text: string }> = {
  draft: { bg: '#E5E7EB', text: '#6B7280' },
  published: { bg: 'rgba(0,198,174,0.15)', text: TEAL },
  closed: { bg: 'rgba(10,35,66,0.12)', text: NAVY },
  cancelled: { bg: '#FEE2E2', text: '#DC2626' },
};

const formatDateRange = (start: string, end: string): string => {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} — ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  } catch {
    return `${start} — ${end}`;
  }
};

// --- Components ---

const StatusPill: React.FC<{ status: TripStatus }> = ({ status }) => {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: color.bg }]}>
      <Text style={[styles.statusPillText, { color: color.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

const GradientPlaceholder: React.FC = () => (
  <View style={styles.placeholderCover}>
    <Ionicons name="image-outline" size={28} color="#CBD5E1" />
  </View>
);

const TripCard: React.FC<{ trip: OrganizerTrip; onPress: () => void }> = ({ trip, onPress }) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
    {trip.cover_image_url ? (
      <Image source={{ uri: trip.cover_image_url }} style={styles.coverImage} />
    ) : (
      <GradientPlaceholder />
    )}
    <View style={styles.cardBody}>
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tripName} numberOfLines={1}>{trip.trip_name}</Text>
          <Text style={styles.destination} numberOfLines={1}>{trip.destination}</Text>
        </View>
        <StatusPill status={trip.status} />
      </View>
      <Text style={styles.dateRange}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
      <View style={styles.cardBottomRow}>
        <Text style={styles.statText}>
          👥 {trip.confirmed_count}/{trip.max_participants} confirmed
        </Text>
        <Text style={styles.statText}>
          💰 ${trip.total_collected.toLocaleString()} collected
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

const EmptyState: React.FC<{ onCreatePress: () => void }> = ({ onCreatePress }) => (
  <View style={styles.emptyState}>
    <Ionicons name="airplane-outline" size={64} color="#CBD5E1" />
    <Text style={styles.emptyTitle}>No trips yet</Text>
    <Text style={styles.emptySubtitle}>Create your first trip and start organizing</Text>
    <TouchableOpacity style={styles.emptyCta} activeOpacity={0.7} onPress={onCreatePress}>
      <Text style={styles.emptyCtaText}>Create a Trip</Text>
    </TouchableOpacity>
  </View>
);

// --- Screen ---

const OrganizerTripListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { trips, loading, refresh } = useOrganizerTrips();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTrips = (trips ?? []).filter((t: OrganizerTrip) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'past') return t.status === 'closed' || t.status === 'cancelled';
    return t.status === activeFilter;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh?.();
    setRefreshing(false);
  }, [refresh]);

  const navigateToCreate = () => navigation.navigate('CreateTripWizard');
  const navigateToDashboard = (tripId: string) =>
    navigation.navigate('OrganizerTripDashboard', { tripId });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity onPress={navigateToCreate} style={styles.headerBtn}>
          <Ionicons name="add-circle" size={28} color={TEAL} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.filterTab}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === tab.key && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {activeFilter === tab.key && <View style={styles.filterTabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trip List */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => navigateToDashboard(item.id)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
        ListEmptyComponent={!loading ? <EmptyState onCreatePress={navigateToCreate} /> : null}
      />
    </SafeAreaView>
  );
};

export default OrganizerTripListScreen;

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
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
  },
  filterTab: {
    marginRight: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: NAVY,
    fontWeight: typography.semibold,
  },
  filterTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  coverImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  placeholderCover: {
    width: '100%',
    height: 140,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tripName: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  destination: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  statusPillText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },
  dateRange: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: spacing.xxl,
    backgroundColor: TEAL,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.button,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
  },
});
