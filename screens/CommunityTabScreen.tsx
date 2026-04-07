// ============================================================================
// COMMUNITY TAB SCREEN — "The Living Village"
// ============================================================================
// The emotional heart of TandaXn. Combines all 6 community sections into one
// scrollable view: Community Pills, New Arrivals, Gatherings, Your Elders,
// Near You, and Community Memory.
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useCommunity } from '../context/CommunityContext';
import { useElder } from '../context/ElderContext';
import {
  useArrivals,
  useGatherings,
  useCommunityMemory,
  useNearYou,
} from '../hooks/useCommunityFeatures';

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const COLORS = {
  navy: '#0A2342',
  teal: '#00C6AE',
  gold: '#E8A842',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  textDark: '#1F2937',
  subtitle: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  orange: '#F59E0B',
  pink: '#EC4899',
};

const AVATAR_GRADIENTS = [
  ['#00C6AE', '#0A2342'],
  ['#E8A842', '#0A2342'],
  ['#8B5CF6', '#3B82F6'],
  ['#EC4899', '#F59E0B'],
  ['#10B981', '#3B82F6'],
  ['#F59E0B', '#EF4444'],
];

// ============================================================================
// HELPERS
// ============================================================================

const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getGradientColor = (index: number): string => {
  const colors = [COLORS.teal, COLORS.gold, COLORS.purple, COLORS.blue, COLORS.pink, COLORS.orange];
  return colors[index % colors.length];
};

const timeAgo = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
};

const formatEventDate = (dateStr?: string | null): { day: string; month: string } => {
  if (!dateStr) return { day: '--', month: '---' };
  const date = new Date(dateStr);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleString('en', { month: 'short' }).toUpperCase(),
  };
};

const getEventEmoji = (eventType?: string): string => {
  switch (eventType) {
    case 'community': return '🎉';
    case 'circle': return '🤝';
    case 'elder_session': return '🧓';
    case 'service': return '🛠';
    default: return '📅';
  }
};

const getMemoryIcon = (memoryType?: string): { icon: string; color: string } => {
  switch (memoryType) {
    case 'circle_completion': return { icon: 'checkmark-circle', color: COLORS.success };
    case 'elder_elevation': return { icon: 'star', color: COLORS.gold };
    case 'milestone_story': return { icon: 'flag', color: COLORS.purple };
    case 'gathering_recap': return { icon: 'people', color: COLORS.blue };
    case 'provider_milestone': return { icon: 'storefront', color: COLORS.orange };
    case 'member_count': return { icon: 'trending-up', color: COLORS.teal };
    case 'community_founding': return { icon: 'home', color: COLORS.navy };
    case 'payout_milestone': return { icon: 'cash', color: COLORS.success };
    default: return { icon: 'bookmark', color: COLORS.subtitle };
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const CommunityTabScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { myCommunities, isLoading: communitiesLoading } = useCommunity();
  const { elderProfile } = useElder();

  // Selected community pill
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>(
    myCommunities?.[0]?.id || ''
  );

  // Welcome sent tracking
  const [welcomeSent, setWelcomeSent] = useState<Record<string, boolean>>({});

  // Hello sent tracking
  const [helloSent, setHelloSent] = useState<Record<string, boolean>>({});

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Update selectedCommunityId when communities load
  React.useEffect(() => {
    if (myCommunities?.length && !selectedCommunityId) {
      setSelectedCommunityId(myCommunities[0].id);
    }
  }, [myCommunities, selectedCommunityId]);

  // Hooks wired to selected community
  const {
    arrivals,
    stats: arrivalStats,
    loading: arrivalsLoading,
    sendWelcome,
    refresh: refreshArrivals,
  } = useArrivals(selectedCommunityId);

  const {
    gatherings,
    upcoming: upcomingGatherings,
    loading: gatheringsLoading,
    refresh: refreshGatherings,
  } = useGatherings(selectedCommunityId);

  const {
    memories,
    loading: memoriesLoading,
    refresh: refreshMemories,
  } = useCommunityMemory(selectedCommunityId);

  const selectedCommunity = myCommunities?.find((c) => c.id === selectedCommunityId);
  const userCity = selectedCommunity?.region || 'New York';

  const {
    profiles: nearYouProfiles,
    loading: nearYouLoading,
    sayHello,
    refresh: refreshNearYou,
  } = useNearYou(userCity);

  // Mock community elders (from getCommunityMembers filtered by role)
  const [communityElders] = useState([
    {
      id: 'e1',
      name: 'Mama Adele',
      domain: 'Financial Guidance',
      honorScore: 94,
      available: true,
      tier: 'Grand' as const,
    },
    {
      id: 'e2',
      name: 'Uncle Kofi',
      domain: 'Dispute Mediation',
      honorScore: 88,
      available: true,
      tier: 'Senior' as const,
    },
    {
      id: 'e3',
      name: 'Sister Fatou',
      domain: 'Newcomer Support',
      honorScore: 82,
      available: false,
      tier: 'Junior' as const,
    },
  ]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshArrivals(),
      refreshGatherings(),
      refreshMemories(),
      refreshNearYou(),
    ]);
    setRefreshing(false);
  }, [refreshArrivals, refreshGatherings, refreshMemories, refreshNearYou]);

  // Welcome handler
  const handleSendWelcome = useCallback(
    async (arrivalId: string, recipientUserId: string) => {
      try {
        await sendWelcome(arrivalId, recipientUserId, 'Welcome to the community! We are glad you are here.');
        setWelcomeSent((prev) => ({ ...prev, [arrivalId]: true }));
      } catch (err) {
        console.error('Failed to send welcome:', err);
      }
    },
    [sendWelcome]
  );

  // Say hello handler
  const handleSayHello = useCallback(
    async (userId: string, firstName: string) => {
      try {
        await sayHello(userId, `Hey ${firstName}! Great to see someone nearby.`);
        setHelloSent((prev) => ({ ...prev, [userId]: true }));
      } catch (err) {
        console.error('Failed to say hello:', err);
      }
    },
    [sayHello]
  );

  const userInitials = getInitials(user?.name);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION HEADER
  // ──────────────────────────────────────────────────────────────────────────

  const renderSectionHeader = (title: string, linkText: string, onPress: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.sectionLink}>{linkText}</Text>
      </TouchableOpacity>
    </View>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ──────────────────────────────────────────────────────────────────────────

  const renderEmptyState = (icon: string, message: string) => (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={32} color={COLORS.subtitle} style={{ opacity: 0.5 }} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // AVATAR CIRCLE
  // ──────────────────────────────────────────────────────────────────────────

  const renderAvatar = (name: string | null | undefined, index: number, size: number = 40) => {
    const bgColor = getGradientColor(index);
    return (
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{getInitials(name)}</Text>
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. COMMUNITY PILLS
  // ──────────────────────────────────────────────────────────────────────────

  const renderCommunityPills = () => (
    <View style={styles.pillsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsScroll}
      >
        {myCommunities?.map((community) => {
          const isActive = community.id === selectedCommunityId;
          return (
            <TouchableOpacity
              key={community.id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setSelectedCommunityId(community.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.pillFlag}>{community.icon || '🌍'}</Text>
              <Text style={[styles.pillName, isActive && styles.pillNameActive]} numberOfLines={1}>
                {community.name}
              </Text>
              <View style={[styles.pillBadge, isActive && styles.pillBadgeActive]}>
                <Text style={[styles.pillBadgeText, isActive && styles.pillBadgeTextActive]}>
                  {community.members || 0}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.pill, styles.pillJoin]}
          onPress={() => navigation.navigate('CommunityBrowser')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={COLORS.teal} />
          <Text style={styles.pillJoinText}>Join more</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 2. NEW ARRIVALS
  // ──────────────────────────────────────────────────────────────────────────

  const renderNewArrivals = () => {
    const hasArrivals = arrivals?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader('New Arrivals', 'See All', () =>
          navigation.navigate('NewArrivals', { communityId: selectedCommunityId })
        )}

        {!hasArrivals && !arrivalsLoading && renderEmptyState(
          'people-outline',
          'No new arrivals yet \u2014 the village is growing'
        )}

        {hasArrivals && (
          <View style={styles.card}>
            {/* Summary banner */}
            <View style={styles.arrivalBanner}>
              <Text style={styles.arrivalBannerFlag}>
                {selectedCommunity?.icon || '🌍'}
              </Text>
              <View style={styles.arrivalBannerInfo}>
                <Text style={styles.arrivalBannerTitle}>
                  From {selectedCommunity?.countryOfOrigin || 'around the world'}
                </Text>
                <Text style={styles.arrivalBannerSub}>
                  In {userCity} this week
                </Text>
              </View>
              <View style={styles.arrivalCountBadge}>
                <Text style={styles.arrivalCountText}>{arrivalStats?.thisWeek || arrivals.length}</Text>
              </View>
            </View>

            {/* Arrival rows */}
            {arrivals.slice(0, 4).map((arrival, index) => (
              <View key={arrival.id} style={[styles.arrivalRow, index === 0 && { borderTopWidth: 0 }]}>
                {renderAvatar(arrival.firstName, index)}
                <View style={styles.arrivalInfo}>
                  <Text style={styles.arrivalName}>{arrival.firstName}</Text>
                  <Text style={styles.arrivalDetail} numberOfLines={1}>
                    {arrival.originCity || 'Unknown'} {'\u2192'} {arrival.currentNeighborhood || arrival.currentCity || userCity}
                  </Text>
                </View>
                <Text style={styles.arrivalTime}>{timeAgo(arrival.createdAt)}</Text>
                <TouchableOpacity
                  style={[
                    styles.welcomeBtn,
                    welcomeSent[arrival.id] && styles.welcomeBtnSent,
                  ]}
                  onPress={() => handleSendWelcome(arrival.id, arrival.userId)}
                  disabled={welcomeSent[arrival.id]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.welcomeBtnText,
                      welcomeSent[arrival.id] && styles.welcomeBtnTextSent,
                    ]}
                  >
                    {welcomeSent[arrival.id] ? 'Sent \u2713' : 'Welcome'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. GATHERINGS
  // ──────────────────────────────────────────────────────────────────────────

  const renderGatherings = () => {
    const displayGatherings = upcomingGatherings?.length ? upcomingGatherings : gatherings;
    const hasGatherings = displayGatherings?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Gatherings', 'All Events', () =>
          navigation.navigate('Gatherings', { communityId: selectedCommunityId })
        )}

        {!hasGatherings && !gatheringsLoading && renderEmptyState(
          'calendar-outline',
          'No gatherings yet \u2014 be the one who brings everyone together'
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gatheringsScroll}
        >
          {displayGatherings?.slice(0, 6).map((gathering, index) => {
            const { day, month } = formatEventDate(gathering.startsAt);
            const emoji = getEventEmoji(gathering.eventType);

            return (
              <TouchableOpacity
                key={gathering.id}
                style={styles.gatheringCard}
                onPress={() => navigation.navigate('Gatherings', { gatheringId: gathering.id })}
                activeOpacity={0.8}
              >
                {/* Emoji thumbnail */}
                <View style={[styles.gatheringEmoji, { backgroundColor: getGradientColor(index) + '20' }]}>
                  <Text style={styles.gatheringEmojiText}>{emoji}</Text>
                </View>

                {/* Date chip */}
                <View style={styles.dateChip}>
                  <Text style={styles.dateChipDay}>{day}</Text>
                  <Text style={styles.dateChipMonth}>{month}</Text>
                </View>

                {/* Info */}
                <Text style={styles.gatheringTitle} numberOfLines={2}>
                  {gathering.title}
                </Text>
                <Text style={styles.gatheringHost} numberOfLines={1}>
                  {gathering.organizerFirstName || 'Community'}
                </Text>

                {/* Going count with face stack */}
                <View style={styles.goingRow}>
                  <View style={styles.faceStack}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.faceDot,
                          { backgroundColor: getGradientColor(i + index), marginLeft: i > 0 ? -6 : 0 },
                        ]}
                      >
                        <Text style={styles.faceDotText}>
                          {String.fromCharCode(65 + i)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.goingCount}>
                    {gathering.rsvpCount || 0} going
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Host a Gathering dashed card */}
          <TouchableOpacity
            style={styles.hostCard}
            onPress={() => navigation.navigate('CreateGathering', { communityId: selectedCommunityId })}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={32} color={COLORS.teal} />
            <Text style={styles.hostCardText}>Host a{'\n'}Gathering</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. YOUR ELDERS
  // ──────────────────────────────────────────────────────────────────────────

  const renderYourElders = () => {
    const hasElders = communityElders?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Your Elders', 'Full Council', () =>
          navigation.navigate('ElderDashboard')
        )}

        {!hasElders && renderEmptyState(
          'shield-outline',
          'No elders yet \u2014 every village needs its wise ones'
        )}

        {hasElders && (
          <View style={styles.card}>
            {communityElders.map((elder, index) => (
              <TouchableOpacity
                key={elder.id}
                style={[styles.elderRow, index === 0 && { borderTopWidth: 0 }]}
                onPress={() => navigation.navigate('ElderDashboard')}
                activeOpacity={0.7}
              >
                {/* Avatar with crown */}
                <View style={styles.elderAvatarWrap}>
                  {renderAvatar(elder.name, index + 3, 44)}
                  <Text style={styles.elderCrown}>👑</Text>
                </View>

                {/* Info */}
                <View style={styles.elderInfo}>
                  <Text style={styles.elderName}>{elder.name}</Text>
                  <Text style={styles.elderDomain}>{elder.domain}</Text>
                </View>

                {/* Honor score */}
                <View style={styles.elderScoreWrap}>
                  <Ionicons name="shield-checkmark" size={14} color={COLORS.gold} />
                  <Text style={styles.elderScore}>{elder.honorScore}</Text>
                </View>

                {/* Availability dot */}
                <View
                  style={[
                    styles.availabilityDot,
                    { backgroundColor: elder.available ? COLORS.success : COLORS.subtitle },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. NEAR YOU
  // ──────────────────────────────────────────────────────────────────────────

  const renderNearYou = () => {
    const hasProfiles = nearYouProfiles?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader(
          'Near You',
          hasProfiles ? `${nearYouProfiles.length} nearby` : 'Explore',
          () => navigation.navigate('NearYou', { city: userCity })
        )}

        {!hasProfiles && !nearYouLoading && renderEmptyState(
          'location-outline',
          'No one nearby yet \u2014 your neighbors are on their way home'
        )}

        {hasProfiles && (
          <View style={styles.nearYouGrid}>
            {nearYouProfiles.slice(0, 4).map((profile, index) => {
              const hasShared =
                (profile.sharedCircles?.length ?? 0) > 0 ||
                (profile.sharedCommunities?.length ?? 0) > 0;

              return (
                <View key={profile.id} style={styles.nearYouCard}>
                  {/* Avatar */}
                  <View style={styles.nearYouAvatarWrap}>
                    {renderAvatar(profile.firstName, index + 2, 48)}
                    {profile.originCountryFlag && (
                      <Text style={styles.nearYouFlag}>{profile.originCountryFlag}</Text>
                    )}
                  </View>

                  {/* Name */}
                  <Text style={styles.nearYouName} numberOfLines={1}>
                    {profile.firstName}
                  </Text>

                  {/* Context */}
                  <Text style={styles.nearYouContext} numberOfLines={1}>
                    {profile.neighborhood || profile.city}
                  </Text>

                  {/* Shared context badge */}
                  {hasShared && (
                    <View style={styles.sharedBadge}>
                      <Ionicons name="link" size={10} color={COLORS.teal} />
                      <Text style={styles.sharedBadgeText}>Same circle</Text>
                    </View>
                  )}

                  {/* Say hello button */}
                  <TouchableOpacity
                    style={[
                      styles.helloBtn,
                      helloSent[profile.userId] && styles.helloBtnSent,
                    ]}
                    onPress={() => handleSayHello(profile.userId, profile.firstName)}
                    disabled={helloSent[profile.userId]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.helloBtnText,
                        helloSent[profile.userId] && styles.helloBtnTextSent,
                      ]}
                    >
                      {helloSent[profile.userId] ? 'Sent \u2713' : 'Say hello'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. COMMUNITY MEMORY
  // ──────────────────────────────────────────────────────────────────────────

  const renderCommunityMemory = () => {
    const hasMemories = memories?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader('Community Memory', 'Full Archive', () =>
          navigation.navigate('CommunityMemory', { communityId: selectedCommunityId })
        )}

        {!hasMemories && !memoriesLoading && renderEmptyState(
          'time-outline',
          'No memories yet \u2014 every milestone will be remembered here'
        )}

        {hasMemories && (
          <View style={styles.card}>
            {/* Memory header */}
            <View style={styles.memoryHeader}>
              <Text style={styles.memoryTitle}>
                {selectedCommunity?.name || 'Community'} \u2014 {new Date().getFullYear()}
              </Text>
              <Text style={styles.memorySub}>
                Every milestone lives here forever
              </Text>
            </View>

            {/* Timeline rows */}
            {memories.slice(0, 5).map((memory, index) => {
              const { icon, color } = getMemoryIcon(memory.memoryType);
              const eventDate = memory.eventDate
                ? new Date(memory.eventDate).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <View key={memory.id} style={styles.timelineRow}>
                  {/* Icon with colored bg */}
                  <View style={[styles.timelineIcon, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon as any} size={16} color={color} />
                  </View>

                  {/* Content */}
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineText}>
                      {memory.attributedName ? (
                        <>
                          <Text style={styles.timelineBold}>{memory.attributedName}</Text>
                          {' \u2014 '}
                        </>
                      ) : null}
                      {memory.title}
                    </Text>
                    {eventDate ? (
                      <Text style={styles.timelineDate}>{eventDate}</Text>
                    ) : null}
                  </View>

                  {/* Timeline connector */}
                  {index < Math.min(memories.length, 5) - 1 && (
                    <View style={styles.timelineConnector} />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Community</Text>
          <Text style={styles.topBarSubtitle}>Your village, your people</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.topBarIcon}
            onPress={() => navigation.navigate('CommunityBrowser')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="search-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarAvatar}
            onPress={() => navigation.navigate('ProfileMain')}
            activeOpacity={0.7}
          >
            <Text style={styles.topBarAvatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
            colors={[COLORS.teal]}
          />
        }
      >
        {/* 1. Community Pills */}
        {renderCommunityPills()}

        {/* 2. New Arrivals */}
        {renderNewArrivals()}

        {/* 3. Gatherings */}
        {renderGatherings()}

        {/* 4. Your Elders */}
        {renderYourElders()}

        {/* 5. Near You */}
        {renderNearYou()}

        {/* 6. Community Memory */}
        {renderCommunityMemory()}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // ── Top Bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.navy,
  },
  topBarSubtitle: {
    fontSize: 13,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarIcon: {
    padding: 4,
  },
  topBarAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ── Pills ────────────────────────────────────────────────────────────────
  pillsContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  pillActive: {
    backgroundColor: COLORS.teal + '15',
    borderColor: COLORS.teal,
  },
  pillFlag: {
    fontSize: 16,
  },
  pillName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
    maxWidth: 100,
  },
  pillNameActive: {
    color: COLORS.teal,
  },
  pillBadge: {
    backgroundColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  pillBadgeActive: {
    backgroundColor: COLORS.teal,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.subtitle,
  },
  pillBadgeTextActive: {
    color: COLORS.white,
  },
  pillJoin: {
    borderStyle: 'dashed',
    borderColor: COLORS.teal,
    backgroundColor: COLORS.white,
  },
  pillJoinText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.teal,
  },

  // ── Section ──────────────────────────────────────────────────────────────
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.teal,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Empty State ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Avatar ───────────────────────────────────────────────────────────────
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Arrivals ─────────────────────────────────────────────────────────────
  arrivalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  arrivalBannerFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  arrivalBannerInfo: {
    flex: 1,
  },
  arrivalBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  arrivalBannerSub: {
    fontSize: 13,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  arrivalCountBadge: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  arrivalCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  arrivalInfo: {
    flex: 1,
  },
  arrivalName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  arrivalDetail: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  arrivalTime: {
    fontSize: 11,
    color: COLORS.subtitle,
    marginRight: 8,
  },
  welcomeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.teal,
  },
  welcomeBtnSent: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  welcomeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  welcomeBtnTextSent: {
    color: COLORS.success,
  },

  // ── Gatherings ───────────────────────────────────────────────────────────
  gatheringsScroll: {
    paddingRight: 16,
    gap: 12,
  },
  gatheringCard: {
    width: 170,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  gatheringEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gatheringEmojiText: {
    fontSize: 22,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  dateChipDay: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.navy,
  },
  dateChipMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subtitle,
  },
  gatheringTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
    lineHeight: 18,
  },
  gatheringHost: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginBottom: 10,
  },
  goingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  faceStack: {
    flexDirection: 'row',
  },
  faceDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  faceDotText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.white,
  },
  goingCount: {
    fontSize: 11,
    color: COLORS.subtitle,
    fontWeight: '500',
  },
  hostCard: {
    width: 130,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.teal,
    gap: 8,
  },
  hostCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.teal,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Elders ───────────────────────────────────────────────────────────────
  elderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  elderAvatarWrap: {
    position: 'relative',
  },
  elderCrown: {
    position: 'absolute',
    top: -6,
    right: -4,
    fontSize: 14,
  },
  elderInfo: {
    flex: 1,
  },
  elderName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  elderDomain: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  elderScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  elderScore: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gold,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 4,
  },

  // ── Near You ─────────────────────────────────────────────────────────────
  nearYouGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nearYouCard: {
    width: '47%' as any,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  nearYouAvatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  nearYouFlag: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    fontSize: 14,
  },
  nearYouName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  nearYouContext: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginBottom: 6,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.teal + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.teal,
  },
  helloBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.navy,
    marginTop: 4,
  },
  helloBtnSent: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  helloBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  helloBtnTextSent: {
    color: COLORS.success,
  },

  // ── Community Memory ─────────────────────────────────────────────────────
  memoryHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  memorySub: {
    fontSize: 13,
    color: COLORS.subtitle,
    marginTop: 3,
    fontStyle: 'italic',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    position: 'relative',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineText: {
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
  },
  timelineBold: {
    fontWeight: '700',
  },
  timelineDate: {
    fontSize: 11,
    color: COLORS.subtitle,
    marginTop: 3,
  },
  timelineConnector: {
    position: 'absolute',
    left: 15,
    top: 34,
    width: 2,
    height: 14,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
});

export default CommunityTabScreen;
