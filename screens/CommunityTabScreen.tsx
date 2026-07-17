// ============================================================================
// COMMUNITY TAB SCREEN — "The Living Village"
// ============================================================================
// The emotional heart of TandaXn. Combines all 6 community sections into one
// scrollable view: Community Pills, New Arrivals, Gatherings, Your Elders,
// Near You, and Community Memory.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCommunity } from '../context/CommunityContext';
import ScreenHeader from '../components/ScreenHeader';
import { useElder } from '../context/ElderContext';
import {
  useUpcomingEvents,
  formatEventDateCompact,
  formatEventTime,
} from '../hooks/useEvents';
import { Routes } from '../lib/routes';
import {
  useArrivals,
  useGatherings,
  useCommunityMemory,
  useNearYou,
  useDreamFeed,
} from '../hooks/useCommunityFeatures';
import { useFeed } from '../context/FeedContext';
import FeedPostCard from '../components/FeedPostCard';
import { useEventTracker } from '../hooks/useEventTracker';

// Post to Community Bucket B — AsyncStorage gate for the first-visit
// coach mark on the Community section. Versioned so we can re-prompt
// every user if the copy ever shifts.
const COMMUNITY_POST_COACH_KEY = '@tandaxn_community_post_coach_seen_v1';

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

// Gathering-card date chip ({ day: "5", month: "MAY" } shape). Distinct from
// the events teaser's formatEventDate (imported from hooks/useEvents.ts),
// which returns a full sentence ("Monday, May 5, 2026").
const formatGatheringDate = (dateStr?: string | null): { day: string; month: string } => {
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { myCommunities, isLoading: communitiesLoading } = useCommunity();
  const { elderProfile } = useElder();

  // Top-level upcoming-events query — lifted out of renderUpcomingEvents
  // to fix a Rules-of-Hooks violation (hook was being invoked inside a
  // render-time callback). Shares the same cached payload that
  // EventsScreen consumes, so the Community-tab teaser and the full
  // EventsScreen list reuse one network round-trip.
  //
  // Browse-events Bucket C.4 — pick the next event by engagement
  // first, recency second. Migration 224 added view_count; when every
  // event still has the default 0 (a fresh community, or pre-224 rows
  // before anyone has opened the sheet), the secondary sort on
  // event_datetime ASC falls back to the original "next upcoming"
  // behaviour without any branching.
  const { events: upcomingEvents } = useUpcomingEvents({ limit: 50 });
  const teaserOrdered = React.useMemo(() => {
    return [...upcomingEvents].sort((a, b) => {
      const va = a.view_count ?? 0;
      const vb = b.view_count ?? 0;
      if (vb !== va) return vb - va;
      return (
        new Date(a.event_datetime).getTime() -
        new Date(b.event_datetime).getTime()
      );
    });
  }, [upcomingEvents]);
  const nextEvent = teaserOrdered[0] ?? null;

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

  // Bug fix: useDreamFeed lived inside renderDreamFeed as a nested-
  // function call, which violates the Rules of Hooks — even though the
  // function is invoked every render, React can't track hook order when
  // hooks live in nested callbacks. Any conditional wrapping of
  // renderDreamFeed's invocation flipped the hook order between renders
  // and produced "React has detected a change in the order of Hooks
  // called by CommunityTabScreen." Hoist to the top-level hook list
  // alongside useArrivals/useGatherings/useCommunityMemory/useNearYou;
  // renderDreamFeed reads `dream` from closure.
  const { dream: rotatingDream } = useDreamFeed(selectedCommunityId);

  // Post to Community Bucket A — Community section data. Reads from the
  // live feed_posts pipeline (no separate fetch — useFeed already returns
  // every type and shares its cache with DreamFeedScreen). Filtered to
  // type='community' here so the section is scoped to member-authored
  // updates, not auto-posts or dream posts.
  const {
    posts: feedPosts,
    likedPostIds,
    toggleLike,
    refreshFeed,
  } = useFeed();
  const communityPosts = React.useMemo(
    () => feedPosts.filter((p) => p.type === 'community').slice(0, 3),
    [feedPosts],
  );

  // Post to Community Bucket C — telemetry for the Community section.
  // Fires only on tap (no mount event; the Community tab is the home
  // surface and its mount is too noisy for a useful "viewed" count).
  const { track } = useEventTracker();

  // Post to Community Bucket B — first-visit coach mark pointing at the
  // Community section's (+). Same Animated.Value + AsyncStorage gate
  // pattern as Stress / Mood / Credit Profile Bucket B. Auto-dismiss
  // after 4 s or on tap.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COMMUNITY_POST_COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(COMMUNITY_POST_COACH_KEY, '1').catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

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
      refreshFeed(),
    ]);
    setRefreshing(false);
  }, [refreshArrivals, refreshGatherings, refreshMemories, refreshNearYou, refreshFeed]);

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
          <Text style={styles.pillJoinText}>{t('community_tab.pill_join_more')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 2. NEW ARRIVALS
  // ──────────────────────────────────────────────────────────────────────────

  // Compact "Dreams" teaser — pulls a single rotating dream card for the
  // currently selected community via useDreamFeed (hook ships a single item
  // by design, not a list). Empty state offers a direct CreateDreamPost
  // shortcut. Tap either the card or the section link to open the full
  // DreamFeed.
  const renderDreamFeed = () => {
    // `dream` is fetched at the top-level via useDreamFeed(selectedCommunityId)
    // (see hoisted call above). This function is a pure renderer; no hooks.
    const dream = rotatingDream;
    const openFeed = () => navigation.navigate(Routes.DreamFeed as never);
    const openCreate = () =>
      navigation.navigate(Routes.CreateDreamPost as never);

    return (
      <View style={styles.section}>
        {renderSectionHeader(
          t('community_tab.dreams.section_title'),
          t('community_tab.see_all'),
          openFeed,
        )}

        {dream ? (
          <TouchableOpacity
            style={styles.dreamTeaserCard}
            onPress={openFeed}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.dreamTeaserIcon}>
              <Ionicons name="cloud" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dreamTeaserTitle} numberOfLines={1}>
                {dream.goalTitle}
              </Text>
              <Text style={styles.dreamTeaserMeta} numberOfLines={1}>
                {dream.memberOriginCity
                  ? `${dream.memberFirstName} · ${dream.memberOriginCity}`
                  : dream.memberFirstName}
                {dream.progressPhase ? ` · ${dream.progressPhase}` : ''}
              </Text>
              {dream.goalDescription ? (
                <Text style={styles.dreamTeaserBody} numberOfLines={2}>
                  {dream.goalDescription}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.subtitle}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.dreamTeaserCard}
            onPress={openCreate}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('community_tab.dreams.empty_cta')}
          >
            <View style={styles.dreamTeaserIcon}>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dreamTeaserTitle} numberOfLines={1}>
                {t('community_tab.dreams.empty_title')}
              </Text>
              <Text style={styles.dreamTeaserMeta} numberOfLines={1}>
                {t('community_tab.dreams.empty_subtitle')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.subtitle}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Post to Community Bucket A — "Community" section. Shows up to 3 of
  // the most recent member-authored community posts (filtered from
  // useFeed in the parent scope), each rendered as a full FeedPostCard
  // so likes / comments work in place. Header has a (+) shortcut to the
  // composer and a "See all" link into the dedicated CommunityFeed.
  // Empty state CTAs straight into the composer.
  const renderCommunityPosts = () => {
    const openFeed = () => {
      track({
        eventType: 'community.see_all_tapped',
        eventCategory: 'community',
        eventAction: 'tapped',
      });
      navigation.navigate(Routes.CommunityFeed as never);
    };
    const openCreate = () =>
      navigation.navigate(Routes.PostToCommunity as never);
    const openPost = (postId: string) => {
      track({
        eventType: 'community.feed_post_tapped',
        eventCategory: 'community',
        eventAction: 'tapped',
        eventLabel: postId,
      });
      navigation.navigate(Routes.PostDetail as never, { postId } as never);
    };
    const openAuthor = (userId: string) =>
      navigation.navigate('UserDreamProfile' as never, { userId } as never);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('community_tab.section_community_title')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={openCreate}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('community_tab.section_community_create_a11y')}
            >
              <Ionicons name="add-circle" size={22} color={COLORS.teal} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openFeed}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>
                {t('community_tab.section_community_see_all')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {communityPosts.length === 0 ? (
          <TouchableOpacity
            style={styles.dreamTeaserCard}
            onPress={openCreate}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.dreamTeaserIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dreamTeaserTitle} numberOfLines={1}>
                {t('community_tab.section_community_empty_title')}
              </Text>
              <Text style={styles.dreamTeaserMeta} numberOfLines={2}>
                {t('community_tab.section_community_empty')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.subtitle}
            />
          </TouchableOpacity>
        ) : (
          communityPosts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              isLiked={likedPostIds.has(post.id)}
              onLike={() => toggleLike(post.id)}
              onComment={() => openPost(post.id)}
              onPress={() => openPost(post.id)}
              onAuthorPress={openAuthor}
              currentUserId={user?.id}
            />
          ))
        )}
      </View>
    );
  };

  // Browse-events Bucket A.6 — richer teaser. When at least one upcoming
  // event exists, surface enough of it that the user can decide to tap
  // without entering the full list: thumbnail (or category icon), title,
  // category chip + short location line, compact date, and a "+N more"
  // pill when more upcoming events exist beyond the next one. Empty
  // state is unchanged — still a single CreateEvent shortcut.
  const renderUpcomingEvents = () => {
    const handleOpenList = () => navigation.navigate('Events' as never);
    const handleCreate = () =>
      navigation.navigate(Routes.CreateEvent as never);

    if (!nextEvent) {
      return (
        <View style={styles.section}>
          {renderSectionHeader(
            t('community_events.tab_section_title'),
            t('community_events.tab_section_link'),
            handleOpenList,
          )}
          <TouchableOpacity
            style={styles.eventsTeaserCard}
            onPress={handleCreate}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.eventsTeaserIcon}>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="#FFFFFF"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventsTeaserTitle} numberOfLines={1}>
                {t('community_events.teaser_empty_title')}
              </Text>
              <Text style={styles.eventsTeaserSubtitle} numberOfLines={1}>
                {t('community_events.teaser_empty_subtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.subtitle} />
          </TouchableOpacity>
        </View>
      );
    }

    const moreCount = upcomingEvents.length - 1;
    return (
      <View style={styles.section}>
        {renderSectionHeader(
          t('community_events.tab_section_title'),
          t('community_events.tab_section_link'),
          handleOpenList,
        )}
        <TouchableOpacity
          style={styles.eventsTeaserCard}
          onPress={handleOpenList}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {nextEvent.image_url ? (
            <Image
              source={{ uri: nextEvent.image_url }}
              style={styles.eventsTeaserThumb}
              resizeMode="cover"
              accessibilityLabel={nextEvent.title}
            />
          ) : (
            <View style={styles.eventsTeaserIcon}>
              <Ionicons name="calendar" size={20} color="#FFFFFF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.eventsTeaserTitle} numberOfLines={1}>
              {nextEvent.title}
            </Text>
            <Text style={styles.eventsTeaserSubtitle} numberOfLines={1}>
              {formatEventDateCompact(nextEvent.event_datetime)} ·{' '}
              {formatEventTime(nextEvent.event_datetime)}
            </Text>
            <View style={styles.eventsTeaserMetaRow}>
              {nextEvent.category ? (
                <View style={styles.eventsTeaserChip}>
                  <Text style={styles.eventsTeaserChipText}>
                    {t(`create_event.category_${nextEvent.category}`)}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.eventsTeaserLocation} numberOfLines={1}>
                {nextEvent.location_name}
              </Text>
            </View>
          </View>
          {moreCount > 0 ? (
            <View style={styles.eventsTeaserMorePill}>
              <Text style={styles.eventsTeaserMorePillText}>
                {t('community_tab.events_teaser_count_more', {
                  count: moreCount,
                })}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={COLORS.subtitle} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewArrivals = () => {
    const hasArrivals = arrivals?.length > 0;

    return (
      <View style={styles.section}>
        {renderSectionHeader(t('community_tab.section_new_arrivals'), t('community_tab.see_all'), () =>
          navigation.navigate('NewArrivals', { communityId: selectedCommunityId })
        )}

        {!hasArrivals && !arrivalsLoading && renderEmptyState(
          'people-outline',
          t('community_tab.empty_arrivals')
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
                  {t('community_tab.arrival_from', {
                    country:
                      selectedCommunity?.countryOfOrigin ||
                      t('community_tab.arrival_from_unknown'),
                  })}
                </Text>
                <Text style={styles.arrivalBannerSub}>
                  {t('community_tab.arrival_in_city', { city: userCity })}
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
                    {arrival.originCity || t('community_tab.arrival_origin_unknown')} {'\u2192'} {arrival.currentNeighborhood || arrival.currentCity || userCity}
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
                    {welcomeSent[arrival.id] ? t('community_tab.sent_btn') : t('community_tab.welcome_btn')}
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
        {renderSectionHeader(t('community_tab.section_gatherings'), t('community_tab.all_events'), () =>
          navigation.navigate('Gatherings', { communityId: selectedCommunityId })
        )}

        {!hasGatherings && !gatheringsLoading && renderEmptyState(
          'calendar-outline',
          t('community_tab.empty_gatherings')
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gatheringsScroll}
        >
          {displayGatherings?.slice(0, 6).map((gathering, index) => {
            const { day, month } = formatGatheringDate(gathering.startsAt);
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
                  {gathering.organizerFirstName || t('community_tab.gathering_host_default')}
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
                    {t('community_tab.going_count', { count: gathering.rsvpCount || 0 })}
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
            <Text style={styles.hostCardText}>{t('community_tab.host_gathering')}</Text>
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
        {renderSectionHeader(t('community_tab.section_elders'), t('community_tab.full_council'), () =>
          navigation.navigate('ElderDashboard')
        )}

        {!hasElders && renderEmptyState(
          'shield-outline',
          t('community_tab.empty_elders')
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
          t('community_tab.section_near_you'),
          hasProfiles
            ? t('community_tab.nearby_count', { count: nearYouProfiles.length })
            : t('community_tab.explore'),
          () => navigation.navigate('NearYou', { city: userCity })
        )}

        {!hasProfiles && !nearYouLoading && renderEmptyState(
          'location-outline',
          t('community_tab.empty_near_you')
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
                      <Text style={styles.sharedBadgeText}>{t('community_tab.shared_badge')}</Text>
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
                      {helloSent[profile.userId] ? t('community_tab.sent_btn') : t('community_tab.say_hello')}
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
        {renderSectionHeader(t('community_tab.section_memory'), t('community_tab.full_archive'), () =>
          navigation.navigate('CommunityMemory', { communityId: selectedCommunityId })
        )}

        {!hasMemories && !memoriesLoading && renderEmptyState(
          'time-outline',
          t('community_tab.empty_memory')
        )}

        {hasMemories && (
          <View style={styles.card}>
            {/* Memory header */}
            <View style={styles.memoryHeader}>
              <Text style={styles.memoryTitle}>
                {selectedCommunity?.name || t('community_tab.memory_default_name')} \u2014 {new Date().getFullYear()}
              </Text>
              <Text style={styles.memorySub}>
                {t('community_tab.memory_subtitle')}
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
      {/* Top Bar — migrated to shared ScreenHeader (navy gradient) for
          consistency with the rest of the app. Right slot preserves the
          two prior tap targets: search (opens CommunityBrowser) and the
          user-initials avatar chip (opens ProfileMain). Icon + avatar
          restyled for contrast on the navy background. Any floating
          overlays mounted by a parent (e.g. the Xn home badge) sit
          above this and are unaffected. */}
      <ScreenHeader
        title={t('community_tab.header')}
        subtitle={t('community_tab.subtitle')}
        showBack={false}
        rightElement={
          <View style={styles.topBarRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CommunityBrowser')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Search communities"
            >
              <Ionicons name="search-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarAvatarOnNavy}
              onPress={() => navigation.navigate('ProfileMain')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <Text style={styles.topBarAvatarText}>{userInitials}</Text>
            </TouchableOpacity>
          </View>
        }
      />

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

        {/* Empty-state CTA — when the user has joined zero communities,
            selectedCommunityId falls through to '' and every downstream
            hook (useArrivals, useGatherings, useDreamFeed,
            useCommunityMemory) short-circuits on the !communityId
            guard. Rendering four independently-empty sections in that
            state reads as "the app is broken." One clear CTA card is
            better. Gated on !communitiesLoading so the CTA doesn't
            flash before the context has resolved on cold start. */}
        {!communitiesLoading && (myCommunities?.length ?? 0) === 0 ? (
          <View style={styles.communityEmptyCard}>
            <View style={styles.communityEmptyIcon}>
              <Ionicons name="people-circle-outline" size={40} color={COLORS.teal} />
            </View>
            <Text style={styles.communityEmptyTitle}>Join a community</Text>
            <Text style={styles.communityEmptyBody}>
              Connect with your village, share updates, and celebrate
              together.
            </Text>
            <View style={styles.communityEmptyActions}>
              <TouchableOpacity
                style={styles.communityEmptyPrimary}
                onPress={() => navigation.navigate('CommunityBrowser')}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={16} color={COLORS.white} />
                <Text style={styles.communityEmptyPrimaryText}>
                  Browse communities
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.communityEmptySecondary}
                onPress={() => navigation.navigate('CreateCommunity')}
                activeOpacity={0.7}
              >
                <Ionicons name="add-outline" size={16} color={COLORS.teal} />
                <Text style={styles.communityEmptySecondaryText}>
                  Create a community
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* 2. New Arrivals */}
            {renderNewArrivals()}

            {/* 2b. Upcoming Events teaser (full list in EventsScreen) */}
            {renderUpcomingEvents()}

            {/* 2c. Community Posts — Post to Community Bucket A. Inline
                 FeedPostCards for member-authored type='community' posts
                 from feed_posts. Sits ahead of Dreams so a new post the
                 user just published is the first thing they see. */}
            {renderCommunityPosts()}

            {/* 2d. Dreams teaser (full list in DreamFeedScreen) */}
            {renderDreamFeed()}

        {/* Kente Divider */}
        <View style={styles.kenteDivider}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: i % 4 === 1 || i % 4 === 3 ? 0.4 : 1,
                height: 4,
                backgroundColor:
                  i % 4 === 0 ? '#C4622D' :
                  i % 4 === 1 ? COLORS.gold :
                  i % 4 === 2 ? '#2A5240' : COLORS.gold,
              }}
            />
          ))}
        </View>

        {/* 3. Gatherings */}
        {renderGatherings()}

        {/* 4. Your Elders */}
        {renderYourElders()}

        {/* Kente Divider */}
        <View style={styles.kenteDivider}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: i % 4 === 1 || i % 4 === 3 ? 0.4 : 1,
                height: 4,
                backgroundColor:
                  i % 4 === 0 ? '#C4622D' :
                  i % 4 === 1 ? COLORS.gold :
                  i % 4 === 2 ? '#2A5240' : COLORS.gold,
              }}
            />
          ))}
        </View>

        {/* 5. Near You */}
        {renderNearYou()}

        {/* 6. Community Memory */}
        {renderCommunityMemory()}
          </>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Post to Community Bucket B — first-visit coach mark pointing at
          the Community section's (+) shortcut. Mounted as a sibling to
          the scroll view so it floats above content. */}
      {coachVisible ? (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <View style={styles.coachCard}>
              <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
              <Text style={styles.coachText}>
                {t('community_tab.coach_tip')}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
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

  // Post to Community Bucket B — coach mark (matches the shape used by
  // Stress / Mood / Credit Profile B). Top-anchored so it lands above
  // the Community section header without occluding nav.
  coachOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  coachBackdrop: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 180,
    paddingHorizontal: 24,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.96)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    maxWidth: 320,
  },
  coachText: { flex: 1, fontSize: 13, color: '#FFFFFF', lineHeight: 18 },

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
  // Avatar variant used inside the navy-gradient ScreenHeader — same
  // shape but a lighter translucent background so the circle reads on
  // navy. The old topBarAvatar (navy on white) stays exported in case
  // anything else references it; safe to prune in a follow-up.
  topBarAvatarOnNavy: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
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

  // ── Kente Divider ────────────────────────────────────────────────────────
  kenteDivider: {
    flexDirection: 'row',
    height: 4,
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 2,
    overflow: 'hidden',
    opacity: 0.35,
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

  // ----- Events teaser card -----
  eventsTeaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  eventsTeaserIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00C6AE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Browse-events Bucket A.6 — thumbnail variant of the teaser icon
  // slot. Same footprint as the icon so the row layout doesn't jump
  // when an event has or lacks a flyer.
  eventsTeaserThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  eventsTeaserTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2342',
  },
  eventsTeaserSubtitle: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  eventsTeaserMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventsTeaserChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#F0FDFB',
    borderWidth: 1,
    borderColor: '#00C6AE',
  },
  eventsTeaserChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0A2342',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  eventsTeaserLocation: {
    flex: 1,
    fontSize: 11,
    color: COLORS.subtitle,
  },
  eventsTeaserMorePill: {
    backgroundColor: '#F0FDFB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#00C6AE',
  },
  eventsTeaserMorePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A2342',
  },

  // ----- Dreams teaser card -----
  dreamTeaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dreamTeaserIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dreamTeaserTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2342',
  },
  dreamTeaserMeta: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  dreamTeaserBody: {
    fontSize: 12,
    color: '#0A2342',
    marginTop: 4,
    lineHeight: 16,
  },


  emptyText: {
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Empty-state CTA card — shown when the user has zero communities.
  // Replaces the four independently-empty sections that would otherwise
  // stack under the pills row and read as "app broken."
  communityEmptyCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 8,
  },
  communityEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E6FBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  communityEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
  },
  communityEmptyBody: {
    fontSize: 13,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  communityEmptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  communityEmptyPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  communityEmptyPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  communityEmptySecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.teal,
  },
  communityEmptySecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.teal,
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
