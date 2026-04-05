// ══════════════════════════════════════════════════════════════════════════════
// SERVICE: Community Features Engine (Migration 056)
// ══════════════════════════════════════════════════════════════════════════════
// Arrivals, Gatherings, Posts, Memory, Dream Feed, Near You, Direct Messages
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  A. TYPES                                                              │
// └──────────────────────────────────────────────────────────────────────────┘

// -- Arrivals --
export interface CommunityArrival {
  id: string;
  userId: string;
  communityId: string;
  firstName: string;
  originCity: string | null;
  originCountry: string | null;
  originCountryFlag: string | null;
  currentNeighborhood: string | null;
  currentCity: string | null;
  isVisible: boolean;
  welcomedCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface CommunityWelcome {
  id: string;
  arrivalId: string;
  welcomerUserId: string;
  recipientUserId: string;
  message: string;
  isVisibleInFeed: boolean;
  createdAt: string;
}

// -- Gatherings --
export type GatheringType = 'community' | 'circle' | 'elder_session' | 'service';
export type GatheringStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export interface CommunityGathering {
  id: string;
  communityId: string;
  organizerUserId: string;
  title: string;
  description: string | null;
  eventType: GatheringType;
  locationName: string | null;
  locationAddress: string | null;
  isVirtual: boolean;
  virtualLink: string | null;
  startsAt: string;
  endsAt: string | null;
  circleId: string | null;
  isFamilyWelcome: boolean;
  maxAttendees: number | null;
  status: GatheringStatus;
  rsvpCount: number;
  recapText: string | null;
  recapPhotoUrl: string | null;
  addToMemory: boolean;
  organizerFirstName: string;
  organizerOrigin: string | null;
  createdAt: string;
}

export interface GatheringRsvp {
  id: string;
  gatheringId: string;
  userId: string;
  status: 'going' | 'maybe' | 'not_going';
  userFirstName: string;
  userAvatarUrl: string | null;
  createdAt: string;
}

// -- Posts --
export type PostType = 'milestone' | 'question' | 'welcome' | 'service_announcement';

export interface CommunityPost {
  id: string;
  communityId: string;
  authorUserId: string;
  postType: PostType;
  title: string | null;
  body: string;
  photoUrl: string | null;
  authorFirstName: string;
  authorOrigin: string | null;
  authorAvatarUrl: string | null;
  likesCount: number;
  commentsCount: number;
  isApproved: boolean;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorUserId: string;
  body: string;
  authorFirstName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

// -- Memory --
export type MemoryType = 'circle_completion' | 'elder_elevation' | 'milestone_story' |
  'gathering_recap' | 'provider_milestone' | 'member_count' |
  'community_founding' | 'payout_milestone' | 'custom';

export interface CommunityMemoryItem {
  id: string;
  communityId: string;
  memoryType: MemoryType;
  title: string;
  description: string | null;
  photoUrl: string | null;
  attributedName: string | null;
  isSystemGenerated: boolean;
  isApproved: boolean;
  eventDate: string;
  createdAt: string;
}

// -- Dream Feed --
export type DreamPhase = 'Just started' | 'Building toward it' | 'Halfway there' | 'Almost there' | 'Achieved';

export interface DreamFeedItem {
  id: string;
  userId: string;
  communityId: string;
  goalTitle: string;
  goalDescription: string | null;
  goalIllustrationUrl: string | null;
  progressPct: number;
  progressPhase: DreamPhase;
  memberFirstName: string;
  memberOriginCity: string | null;
  isActive: boolean;
  createdAt: string;
}

// -- Near You --
export interface NearYouProfile {
  id: string;
  userId: string;
  neighborhood: string;
  city: string;
  state: string | null;
  firstName: string;
  originCity: string | null;
  originCountry: string | null;
  originCountryFlag: string | null;
  sharedCircles: string[] | null;
  sharedCommunities: string[] | null;
  isDiscoverable: boolean;
  preferredRadiusMiles: number;
}

export interface NearYouConnection {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  message: string;
  status: 'pending' | 'accepted' | 'ignored' | 'blocked';
  createdAt: string;
}

// -- Feed --
export interface FeedItem {
  id: string;
  communityId: string;
  feedType: string;
  title: string;
  body: string | null;
  photoUrl: string | null;
  iconName: string | null;
  accentColor: string;
  attributedName: string | null;
  isSystemGenerated: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// -- Direct Messages --
export interface DirectMessage {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  isRead: boolean;
  sourceType: string | null;
  createdAt: string;
}

// -- Params --
export interface CreateGatheringParams {
  communityId: string;
  title: string;
  description?: string;
  eventType: GatheringType;
  locationName?: string;
  locationAddress?: string;
  isVirtual?: boolean;
  virtualLink?: string;
  startsAt: string;
  endsAt?: string;
  circleId?: string;
  isFamilyWelcome?: boolean;
  maxAttendees?: number;
  addToMemory?: boolean;
  organizerFirstName: string;
  organizerOrigin?: string;
}

export interface CreatePostParams {
  communityId: string;
  postType: PostType;
  title?: string;
  body: string;
  photoUrl?: string;
  authorFirstName: string;
  authorOrigin?: string;
  authorAvatarUrl?: string;
  linkedCircleId?: string;
  linkedGoalId?: string;
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  B. MAPPER FUNCTIONS                                                   │
// └──────────────────────────────────────────────────────────────────────────┘

function mapArrival(r: any): CommunityArrival {
  return {
    id: r.id, userId: r.user_id, communityId: r.community_id,
    firstName: r.first_name, originCity: r.origin_city,
    originCountry: r.origin_country, originCountryFlag: r.origin_country_flag,
    currentNeighborhood: r.current_neighborhood, currentCity: r.current_city,
    isVisible: r.is_visible, welcomedCount: r.welcomed_count,
    expiresAt: r.expires_at, createdAt: r.created_at,
  };
}

function mapGathering(r: any): CommunityGathering {
  return {
    id: r.id, communityId: r.community_id, organizerUserId: r.organizer_user_id,
    title: r.title, description: r.description, eventType: r.event_type,
    locationName: r.location_name, locationAddress: r.location_address,
    isVirtual: r.is_virtual, virtualLink: r.virtual_link,
    startsAt: r.starts_at, endsAt: r.ends_at, circleId: r.circle_id,
    isFamilyWelcome: r.is_family_welcome, maxAttendees: r.max_attendees,
    status: r.status, rsvpCount: r.rsvp_count,
    recapText: r.recap_text, recapPhotoUrl: r.recap_photo_url,
    addToMemory: r.add_to_memory, organizerFirstName: r.organizer_first_name,
    organizerOrigin: r.organizer_origin, createdAt: r.created_at,
  };
}

function mapRsvp(r: any): GatheringRsvp {
  return {
    id: r.id, gatheringId: r.gathering_id, userId: r.user_id,
    status: r.status, userFirstName: r.user_first_name,
    userAvatarUrl: r.user_avatar_url, createdAt: r.created_at,
  };
}

function mapPost(r: any): CommunityPost {
  return {
    id: r.id, communityId: r.community_id, authorUserId: r.author_user_id,
    postType: r.post_type, title: r.title, body: r.body, photoUrl: r.photo_url,
    authorFirstName: r.author_first_name, authorOrigin: r.author_origin,
    authorAvatarUrl: r.author_avatar_url, likesCount: r.likes_count,
    commentsCount: r.comments_count, isApproved: r.is_approved,
    createdAt: r.created_at,
  };
}

function mapComment(r: any): PostComment {
  return {
    id: r.id, postId: r.post_id, authorUserId: r.author_user_id,
    body: r.body, authorFirstName: r.author_first_name,
    authorAvatarUrl: r.author_avatar_url, createdAt: r.created_at,
  };
}

function mapMemory(r: any): CommunityMemoryItem {
  return {
    id: r.id, communityId: r.community_id, memoryType: r.memory_type,
    title: r.title, description: r.description, photoUrl: r.photo_url,
    attributedName: r.attributed_name, isSystemGenerated: r.is_system_generated,
    isApproved: r.is_approved, eventDate: r.event_date, createdAt: r.created_at,
  };
}

function mapDream(r: any): DreamFeedItem {
  return {
    id: r.id, userId: r.user_id, communityId: r.community_id,
    goalTitle: r.goal_title, goalDescription: r.goal_description,
    goalIllustrationUrl: r.goal_illustration_url, progressPct: Number(r.progress_pct),
    progressPhase: r.progress_phase, memberFirstName: r.member_first_name,
    memberOriginCity: r.member_origin_city, isActive: r.is_active,
    createdAt: r.created_at,
  };
}

function mapNearYou(r: any): NearYouProfile {
  return {
    id: r.id, userId: r.user_id, neighborhood: r.neighborhood,
    city: r.city, state: r.state, firstName: r.first_name,
    originCity: r.origin_city, originCountry: r.origin_country,
    originCountryFlag: r.origin_country_flag,
    sharedCircles: r.shared_circles, sharedCommunities: r.shared_communities,
    isDiscoverable: r.is_discoverable, preferredRadiusMiles: r.preferred_radius_miles,
  };
}

function mapFeedItem(r: any): FeedItem {
  return {
    id: r.id, communityId: r.community_id, feedType: r.feed_type,
    title: r.title, body: r.body, photoUrl: r.photo_url,
    iconName: r.icon_name, accentColor: r.accent_color,
    attributedName: r.attributed_name, isSystemGenerated: r.is_system_generated,
    metadata: r.metadata ?? {}, createdAt: r.created_at,
  };
}

function mapDM(r: any): DirectMessage {
  return {
    id: r.id, senderUserId: r.sender_user_id,
    recipientUserId: r.recipient_user_id, body: r.body,
    isRead: r.is_read, sourceType: r.source_type, createdAt: r.created_at,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  C. ENGINE                                                             │
// └──────────────────────────────────────────────────────────────────────────┘

export class CommunityFeaturesEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // C1. ARRIVALS
  // ═══════════════════════════════════════════════════════════════════════════

  static async getArrivals(communityId: string, limit = 20): Promise<CommunityArrival[]> {
    const { data, error } = await supabase
      .from('community_arrivals')
      .select('*')
      .eq('community_id', communityId)
      .eq('is_visible', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapArrival);
  }

  static async getArrivalStats(communityId: string): Promise<{ thisWeek: number; thisMonth: number; total: number }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: total } = await supabase.from('community_arrivals')
      .select('*', { count: 'exact', head: true }).eq('community_id', communityId);
    const { count: thisMonth } = await supabase.from('community_arrivals')
      .select('*', { count: 'exact', head: true }).eq('community_id', communityId).gte('created_at', monthAgo);
    const { count: thisWeek } = await supabase.from('community_arrivals')
      .select('*', { count: 'exact', head: true }).eq('community_id', communityId).gte('created_at', weekAgo);

    return { thisWeek: thisWeek ?? 0, thisMonth: thisMonth ?? 0, total: total ?? 0 };
  }

  static async sendWelcome(arrivalId: string, welcomerUserId: string, recipientUserId: string, message: string): Promise<CommunityWelcome> {
    const { data, error } = await supabase
      .from('community_welcomes')
      .insert({ arrival_id: arrivalId, welcomer_user_id: welcomerUserId, recipient_user_id: recipientUserId, message })
      .select('*')
      .single();
    if (error) throw error;

    // Also send as direct message
    await supabase.from('community_direct_messages').insert({
      sender_user_id: welcomerUserId,
      recipient_user_id: recipientUserId,
      body: message,
      source_type: 'welcome',
      source_id: data.id,
    });

    return {
      id: data.id, arrivalId: data.arrival_id, welcomerUserId: data.welcomer_user_id,
      recipientUserId: data.recipient_user_id, message: data.message,
      isVisibleInFeed: data.is_visible_in_feed, createdAt: data.created_at,
    };
  }

  static async toggleArrivalVisibility(userId: string, communityId: string, isVisible: boolean): Promise<void> {
    const { error } = await supabase
      .from('community_arrivals')
      .update({ is_visible: isVisible })
      .eq('user_id', userId)
      .eq('community_id', communityId);
    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C2. GATHERINGS
  // ═══════════════════════════════════════════════════════════════════════════

  static async getGatherings(communityId: string, status?: GatheringStatus): Promise<CommunityGathering[]> {
    let query = supabase
      .from('community_gatherings')
      .select('*')
      .eq('community_id', communityId)
      .order('starts_at', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapGathering);
  }

  static async getGathering(id: string): Promise<CommunityGathering | null> {
    const { data, error } = await supabase
      .from('community_gatherings').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapGathering(data) : null;
  }

  static async createGathering(userId: string, params: CreateGatheringParams): Promise<CommunityGathering> {
    const { data, error } = await supabase
      .from('community_gatherings')
      .insert({
        community_id: params.communityId,
        organizer_user_id: userId,
        title: params.title,
        description: params.description,
        event_type: params.eventType,
        location_name: params.locationName,
        location_address: params.locationAddress,
        is_virtual: params.isVirtual ?? false,
        virtual_link: params.virtualLink,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        circle_id: params.circleId,
        is_family_welcome: params.isFamilyWelcome ?? false,
        max_attendees: params.maxAttendees,
        add_to_memory: params.addToMemory ?? false,
        organizer_first_name: params.organizerFirstName,
        organizer_origin: params.organizerOrigin,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapGathering(data);
  }

  static async rsvpGathering(gatheringId: string, userId: string, firstName: string, avatarUrl?: string, status: 'going' | 'maybe' | 'not_going' = 'going'): Promise<GatheringRsvp> {
    const { data, error } = await supabase
      .from('gathering_rsvps')
      .upsert({
        gathering_id: gatheringId,
        user_id: userId,
        status,
        user_first_name: firstName,
        user_avatar_url: avatarUrl,
      }, { onConflict: 'gathering_id,user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapRsvp(data);
  }

  static async getGatheringRsvps(gatheringId: string): Promise<GatheringRsvp[]> {
    const { data, error } = await supabase
      .from('gathering_rsvps').select('*').eq('gathering_id', gatheringId)
      .eq('status', 'going').order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRsvp);
  }

  static async cancelGathering(gatheringId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('community_gatherings')
      .update({ status: 'cancelled' })
      .eq('id', gatheringId)
      .eq('organizer_user_id', userId);
    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C3. POSTS
  // ═══════════════════════════════════════════════════════════════════════════

  static async getPosts(communityId: string, postType?: PostType, limit = 30): Promise<CommunityPost[]> {
    let query = supabase
      .from('community_posts')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (postType) query = query.eq('post_type', postType);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapPost);
  }

  static async createPost(userId: string, params: CreatePostParams): Promise<CommunityPost> {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        community_id: params.communityId,
        author_user_id: userId,
        post_type: params.postType,
        title: params.title,
        body: params.body,
        photo_url: params.photoUrl,
        author_first_name: params.authorFirstName,
        author_origin: params.authorOrigin,
        author_avatar_url: params.authorAvatarUrl,
        linked_circle_id: params.linkedCircleId,
        linked_goal_id: params.linkedGoalId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapPost(data);
  }

  static async likePost(postId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('community_post_likes')
      .insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') throw error; // ignore duplicate
  }

  static async unlikePost(postId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('community_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  static async hasLiked(postId: string, userId: string): Promise<boolean> {
    const { count } = await supabase
      .from('community_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('user_id', userId);
    return (count ?? 0) > 0;
  }

  static async getComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from('community_post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapComment);
  }

  static async addComment(postId: string, userId: string, body: string, firstName: string, avatarUrl?: string): Promise<PostComment> {
    const { data, error } = await supabase
      .from('community_post_comments')
      .insert({ post_id: postId, author_user_id: userId, body, author_first_name: firstName, author_avatar_url: avatarUrl })
      .select('*')
      .single();
    if (error) throw error;
    return mapComment(data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C4. COMMUNITY MEMORY
  // ═══════════════════════════════════════════════════════════════════════════

  static async getMemory(communityId: string, limit = 50): Promise<CommunityMemoryItem[]> {
    const { data, error } = await supabase
      .from('community_memory')
      .select('*')
      .eq('community_id', communityId)
      .eq('is_approved', true)
      .order('event_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapMemory);
  }

  static async submitMemory(
    communityId: string, userId: string, memoryType: MemoryType,
    title: string, description?: string, photoUrl?: string,
    eventDate?: string, linkedGatheringId?: string
  ): Promise<CommunityMemoryItem> {
    const { data, error } = await supabase
      .from('community_memory')
      .insert({
        community_id: communityId,
        memory_type: memoryType,
        title,
        description,
        photo_url: photoUrl,
        attributed_user_id: userId,
        event_date: eventDate ?? new Date().toISOString().split('T')[0],
        is_system_generated: false,
        is_approved: false, // needs Elder/admin approval
        linked_gathering_id: linkedGatheringId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapMemory(data);
  }

  static async approveMemory(memoryId: string, approverUserId: string): Promise<void> {
    const { error } = await supabase
      .from('community_memory')
      .update({ is_approved: true, approved_by: approverUserId, approved_at: new Date().toISOString() })
      .eq('id', memoryId);
    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C5. DREAM FEED
  // ═══════════════════════════════════════════════════════════════════════════

  static async getDreamForCommunity(communityId: string): Promise<DreamFeedItem | null> {
    // Get a single rotating dream — deterministic by day
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const { data, error } = await supabase
      .from('dream_feed')
      .select('*')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Rotate based on day of year
    const index = dayOfYear % data.length;
    return mapDream(data[index]);
  }

  static async shareDream(
    userId: string, communityId: string, goalTitle: string,
    firstName: string, originCity?: string,
    goalDescription?: string, illustrationUrl?: string,
    progressPct?: number, linkedGoalId?: string
  ): Promise<DreamFeedItem> {
    const phase: DreamPhase = !progressPct || progressPct < 10 ? 'Just started'
      : progressPct < 40 ? 'Building toward it'
      : progressPct < 60 ? 'Halfway there'
      : progressPct < 90 ? 'Almost there'
      : 'Achieved';

    const { data, error } = await supabase
      .from('dream_feed')
      .upsert({
        user_id: userId,
        community_id: communityId,
        goal_title: goalTitle,
        goal_description: goalDescription,
        goal_illustration_url: illustrationUrl,
        progress_pct: progressPct ?? 0,
        progress_phase: phase,
        member_first_name: firstName,
        member_origin_city: originCity,
        linked_goal_id: linkedGoalId,
        is_active: true,
      }, { onConflict: 'user_id,community_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapDream(data);
  }

  static async removeDream(userId: string, communityId: string): Promise<void> {
    const { error } = await supabase
      .from('dream_feed')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('community_id', communityId);
    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C6. NEAR YOU
  // ═══════════════════════════════════════════════════════════════════════════

  static async getNearbyProfiles(userId: string, city: string, limit = 20): Promise<NearYouProfile[]> {
    const { data, error } = await supabase
      .from('near_you_profiles')
      .select('*')
      .eq('city', city)
      .eq('is_discoverable', true)
      .neq('user_id', userId)
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapNearYou);
  }

  static async upsertNearYouProfile(userId: string, profile: Partial<NearYouProfile>): Promise<NearYouProfile> {
    const { data, error } = await supabase
      .from('near_you_profiles')
      .upsert({
        user_id: userId,
        neighborhood: profile.neighborhood,
        city: profile.city,
        state: profile.state,
        first_name: profile.firstName,
        origin_city: profile.originCity,
        origin_country: profile.originCountry,
        origin_country_flag: profile.originCountryFlag,
        is_discoverable: profile.isDiscoverable ?? true,
        preferred_radius_miles: profile.preferredRadiusMiles ?? 10,
      }, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapNearYou(data);
  }

  static async toggleDiscoverable(userId: string, isDiscoverable: boolean): Promise<void> {
    const { error } = await supabase
      .from('near_you_profiles')
      .update({ is_discoverable: isDiscoverable })
      .eq('user_id', userId);
    if (error) throw error;
  }

  static async sayHello(senderUserId: string, recipientUserId: string, message: string): Promise<NearYouConnection> {
    const { data, error } = await supabase
      .from('near_you_connections')
      .insert({ sender_user_id: senderUserId, recipient_user_id: recipientUserId, message })
      .select('*')
      .single();
    if (error) throw error;

    // Send as DM
    await supabase.from('community_direct_messages').insert({
      sender_user_id: senderUserId,
      recipient_user_id: recipientUserId,
      body: message,
      source_type: 'near_you',
      source_id: data.id,
    });

    return {
      id: data.id, senderUserId: data.sender_user_id,
      recipientUserId: data.recipient_user_id, message: data.message,
      status: data.status, createdAt: data.created_at,
    };
  }

  static async respondToConnection(connectionId: string, status: 'accepted' | 'ignored' | 'blocked'): Promise<void> {
    const { error } = await supabase
      .from('near_you_connections')
      .update({ status })
      .eq('id', connectionId);
    if (error) throw error;
  }

  static async getPendingConnections(userId: string): Promise<NearYouConnection[]> {
    const { data, error } = await supabase
      .from('near_you_connections')
      .select('*')
      .eq('recipient_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id, senderUserId: r.sender_user_id, recipientUserId: r.recipient_user_id,
      message: r.message, status: r.status, createdAt: r.created_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C7. FEED
  // ═══════════════════════════════════════════════════════════════════════════

  static async getFeed(communityId: string, limit = 30, offset = 0): Promise<FeedItem[]> {
    const { data, error } = await supabase
      .from('community_feed_items')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []).map(mapFeedItem);
  }

  static subscribeFeed(communityId: string, callback: (item: FeedItem) => void) {
    return supabase
      .channel(`community_feed_${communityId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_feed_items',
        filter: `community_id=eq.${communityId}`,
      }, (payload) => {
        if (payload.new) callback(mapFeedItem(payload.new));
      })
      .subscribe();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C8. DIRECT MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  static async getConversation(userId1: string, userId2: string, limit = 50): Promise<DirectMessage[]> {
    const { data, error } = await supabase
      .from('community_direct_messages')
      .select('*')
      .or(`and(sender_user_id.eq.${userId1},recipient_user_id.eq.${userId2}),and(sender_user_id.eq.${userId2},recipient_user_id.eq.${userId1})`)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapDM);
  }

  static async sendMessage(senderUserId: string, recipientUserId: string, body: string, sourceType?: string): Promise<DirectMessage> {
    const { data, error } = await supabase
      .from('community_direct_messages')
      .insert({ sender_user_id: senderUserId, recipient_user_id: recipientUserId, body, source_type: sourceType ?? 'direct' })
      .select('*')
      .single();
    if (error) throw error;
    return mapDM(data);
  }

  static async markRead(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('community_direct_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', messageId);
    if (error) throw error;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('community_direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('is_read', false);
    return count ?? 0;
  }

  static subscribeMessages(userId: string, callback: (msg: DirectMessage) => void) {
    return supabase
      .channel(`dm_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_direct_messages',
        filter: `recipient_user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new) callback(mapDM(payload.new));
      })
      .subscribe();
  }
}
