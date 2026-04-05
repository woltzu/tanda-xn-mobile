// ══════════════════════════════════════════════════════════════════════════════
// HOOKS: Community Features (Migration 056)
// ══════════════════════════════════════════════════════════════════════════════
// Arrivals, Gatherings, Posts, Memory, Dream Feed, Near You, Messages
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CommunityFeaturesEngine,
  CommunityArrival, CommunityGathering, GatheringRsvp,
  CommunityPost, PostComment, CommunityMemoryItem,
  DreamFeedItem, NearYouProfile, NearYouConnection,
  FeedItem, DirectMessage,
  GatheringType, GatheringStatus, PostType, MemoryType,
  CreateGatheringParams, CreatePostParams,
} from '../services/CommunityFeaturesEngine';

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  1. useArrivals — New member arrivals for a community                  │
// └──────────────────────────────────────────────────────────────────────────┘

export function useArrivals(communityId: string) {
  const [arrivals, setArrivals] = useState<CommunityArrival[]>([]);
  const [stats, setStats] = useState({ thisWeek: 0, thisMonth: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const [arr, st] = await Promise.all([
        CommunityFeaturesEngine.getArrivals(communityId),
        CommunityFeaturesEngine.getArrivalStats(communityId),
      ]);
      setArrivals(arr);
      setStats(st);
    } catch (err) {
      console.error('Failed to fetch arrivals:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const sendWelcome = useCallback(async (arrivalId: string, recipientUserId: string, message: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.sendWelcome(arrivalId, user.id, recipientUserId, message);
    await fetch();
  }, [user?.id, fetch]);

  return { arrivals, stats, loading, sendWelcome, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  2. useGatherings — Community events                                   │
// └──────────────────────────────────────────────────────────────────────────┘

export function useGatherings(communityId: string, statusFilter?: GatheringStatus) {
  const [gatherings, setGatherings] = useState<CommunityGathering[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getGatherings(communityId, statusFilter);
      setGatherings(data);
    } catch (err) {
      console.error('Failed to fetch gatherings:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const createGathering = useCallback(async (params: CreateGatheringParams) => {
    if (!user?.id) throw new Error('Not authenticated');
    const result = await CommunityFeaturesEngine.createGathering(user.id, params);
    await fetch();
    return result;
  }, [user?.id, fetch]);

  const rsvp = useCallback(async (gatheringId: string, firstName: string, status: 'going' | 'maybe' | 'not_going' = 'going') => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.rsvpGathering(gatheringId, user.id, firstName, undefined, status);
    await fetch();
  }, [user?.id, fetch]);

  const cancel = useCallback(async (gatheringId: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.cancelGathering(gatheringId, user.id);
    await fetch();
  }, [user?.id, fetch]);

  const upcoming = useMemo(() => gatherings.filter(g => g.status === 'upcoming'), [gatherings]);
  const elderSessions = useMemo(() => gatherings.filter(g => g.eventType === 'elder_session'), [gatherings]);

  return { gatherings, upcoming, elderSessions, loading, createGathering, rsvp, cancel, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  3. useGatheringDetail — Single gathering with RSVPs                    │
// └──────────────────────────────────────────────────────────────────────────┘

export function useGatheringDetail(gatheringId: string) {
  const [gathering, setGathering] = useState<CommunityGathering | null>(null);
  const [rsvps, setRsvps] = useState<GatheringRsvp[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!gatheringId) return;
    try {
      setLoading(true);
      const [g, r] = await Promise.all([
        CommunityFeaturesEngine.getGathering(gatheringId),
        CommunityFeaturesEngine.getGatheringRsvps(gatheringId),
      ]);
      setGathering(g);
      setRsvps(r);
    } catch (err) {
      console.error('Failed to fetch gathering:', err);
    } finally {
      setLoading(false);
    }
  }, [gatheringId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { gathering, rsvps, loading, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  4. useCommunityPosts — Member-generated content                       │
// └──────────────────────────────────────────────────────────────────────────┘

export function useCommunityPosts(communityId: string, postType?: PostType) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getPosts(communityId, postType);
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId, postType]);

  useEffect(() => { fetch(); }, [fetch]);

  const createPost = useCallback(async (params: CreatePostParams) => {
    if (!user?.id) throw new Error('Not authenticated');
    const result = await CommunityFeaturesEngine.createPost(user.id, params);
    await fetch();
    return result;
  }, [user?.id, fetch]);

  const likePost = useCallback(async (postId: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.likePost(postId, user.id);
    await fetch();
  }, [user?.id, fetch]);

  const unlikePost = useCallback(async (postId: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.unlikePost(postId, user.id);
    await fetch();
  }, [user?.id, fetch]);

  return { posts, loading, createPost, likePost, unlikePost, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  5. usePostComments — Comments on a post                               │
// └──────────────────────────────────────────────────────────────────────────┘

export function usePostComments(postId: string) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getComments(postId);
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addComment = useCallback(async (body: string, firstName: string, avatarUrl?: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.addComment(postId, user.id, body, firstName, avatarUrl);
    await fetch();
  }, [user?.id, postId, fetch]);

  return { comments, loading, addComment, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  6. useCommunityMemory — Archive of community moments                  │
// └──────────────────────────────────────────────────────────────────────────┘

export function useCommunityMemory(communityId: string) {
  const [memories, setMemories] = useState<CommunityMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getMemory(communityId);
      setMemories(data);
    } catch (err) {
      console.error('Failed to fetch memory:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const submitMemory = useCallback(async (
    memoryType: MemoryType, title: string, description?: string,
    photoUrl?: string, eventDate?: string
  ) => {
    if (!user?.id) throw new Error('Not authenticated');
    const result = await CommunityFeaturesEngine.submitMemory(
      communityId, user.id, memoryType, title, description, photoUrl, eventDate
    );
    await fetch();
    return result;
  }, [user?.id, communityId, fetch]);

  // Group by year for timeline display
  const byYear = useMemo(() => {
    const grouped: Record<string, CommunityMemoryItem[]> = {};
    memories.forEach(m => {
      const year = m.eventDate.substring(0, 4);
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(m);
    });
    return grouped;
  }, [memories]);

  return { memories, byYear, loading, submitMemory, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  7. useDreamFeed — Single rotating dream card                          │
// └──────────────────────────────────────────────────────────────────────────┘

export function useDreamFeed(communityId: string) {
  const [dream, setDream] = useState<DreamFeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getDreamForCommunity(communityId);
      setDream(data);
    } catch (err) {
      console.error('Failed to fetch dream:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const shareDream = useCallback(async (
    goalTitle: string, firstName: string, originCity?: string,
    goalDescription?: string, illustrationUrl?: string, progressPct?: number
  ) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.shareDream(
      user.id, communityId, goalTitle, firstName, originCity,
      goalDescription, illustrationUrl, progressPct
    );
    await fetch();
  }, [user?.id, communityId, fetch]);

  const removeDream = useCallback(async () => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.removeDream(user.id, communityId);
    await fetch();
  }, [user?.id, communityId, fetch]);

  return { dream, loading, shareDream, removeDream, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  8. useNearYou — Neighborhood discovery                                │
// └──────────────────────────────────────────────────────────────────────────┘

export function useNearYou(city: string) {
  const [profiles, setProfiles] = useState<NearYouProfile[]>([]);
  const [pendingConnections, setPending] = useState<NearYouConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!user?.id || !city) return;
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        CommunityFeaturesEngine.getNearbyProfiles(user.id, city),
        CommunityFeaturesEngine.getPendingConnections(user.id),
      ]);
      setProfiles(p);
      setPending(c);
    } catch (err) {
      console.error('Failed to fetch nearby:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, city]);

  useEffect(() => { fetch(); }, [fetch]);

  const sayHello = useCallback(async (recipientUserId: string, message: string) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.sayHello(user.id, recipientUserId, message);
    await fetch();
  }, [user?.id, fetch]);

  const respondToConnection = useCallback(async (connectionId: string, status: 'accepted' | 'ignored' | 'blocked') => {
    await CommunityFeaturesEngine.respondToConnection(connectionId, status);
    await fetch();
  }, [fetch]);

  const toggleDiscoverable = useCallback(async (isDiscoverable: boolean) => {
    if (!user?.id) return;
    await CommunityFeaturesEngine.toggleDiscoverable(user.id, isDiscoverable);
  }, [user?.id]);

  return { profiles, pendingConnections, loading, sayHello, respondToConnection, toggleDiscoverable, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  9. useCommunityFeed — Aggregated feed with realtime                   │
// └──────────────────────────────────────────────────────────────────────────┘

export function useCommunityFeed(communityId: string) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getFeed(communityId);
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch feed:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!communityId) return;
    const channel = CommunityFeaturesEngine.subscribeFeed(communityId, (newItem) => {
      setItems(prev => [newItem, ...prev]);
    });
    return () => { channel.unsubscribe(); };
  }, [communityId]);

  return { items, loading, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  10. useDirectMessages — Private messaging                              │
// └──────────────────────────────────────────────────────────────────────────┘

export function useDirectMessages(otherUserId: string) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!user?.id || !otherUserId) return;
    try {
      setLoading(true);
      const data = await CommunityFeaturesEngine.getConversation(user.id, otherUserId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, otherUserId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = CommunityFeaturesEngine.subscribeMessages(user.id, (msg) => {
      if (msg.senderUserId === otherUserId) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => { channel.unsubscribe(); };
  }, [user?.id, otherUserId]);

  const sendMessage = useCallback(async (body: string) => {
    if (!user?.id) return;
    const msg = await CommunityFeaturesEngine.sendMessage(user.id, otherUserId, body);
    setMessages(prev => [...prev, msg]);
    return msg;
  }, [user?.id, otherUserId]);

  return { messages, loading, sendMessage, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  11. useUnreadMessages — Unread count for badge                         │
// └──────────────────────────────────────────────────────────────────────────┘

export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    CommunityFeaturesEngine.getUnreadCount(user.id).then(setCount);

    const channel = CommunityFeaturesEngine.subscribeMessages(user.id, () => {
      setCount(prev => prev + 1);
    });
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  return count;
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  RE-EXPORT TYPES                                                       │
// └──────────────────────────────────────────────────────────────────────────┘

export type {
  CommunityArrival, CommunityGathering, GatheringRsvp,
  CommunityPost, PostComment, CommunityMemoryItem,
  DreamFeedItem, NearYouProfile, NearYouConnection,
  FeedItem, DirectMessage,
  GatheringType, GatheringStatus, PostType, MemoryType,
  CreateGatheringParams, CreatePostParams,
};
