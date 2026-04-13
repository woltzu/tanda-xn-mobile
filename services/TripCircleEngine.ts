// ══════════════════════════════════════════════════════════════════════════════
// TripCircleEngine — Core trip circle business logic
// Provider management, trip listings, membership, contributions, progress
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ProviderProfile {
  id: string;
  userId: string;
  providerType: 'trip_organizer' | 'catering' | 'photography' | 'professional';
  businessName: string;
  bio: string | null;
  yearsOperating: number | null;
  avgGroupSize: string | null;
  profilePhotoUrl: string | null;
  trustLevel: 'claimed' | 'verified' | 'elder_endorsed';
  elderEndorsementRequested: boolean;
  verificationStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  documents: { type: string; url: string; status: string; uploadedAt: string }[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripListing {
  id: string;
  providerId: string;
  title: string;
  description: string | null;
  emoji: string;
  coverPhotoUrl: string | null;
  coverVideoUrl: string | null;
  departureDate: string;
  returnDate: string;
  originCity: string | null;
  destination: string;
  pricePerPersonCents: number;
  depositCents: number;
  suggestedMonthlyCents: number | null;
  suggestedMonths: number | null;
  minTravelers: number;
  maxTravelers: number;
  includes: { item: string; emoji: string; included: boolean }[];
  status: 'draft' | 'live' | 'full' | 'booking_confirmed' | 'completed' | 'cancelled';
  escrowTotalCents: number;
  tandaxnFeePct: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  provider?: ProviderProfile;
  memberCount?: number;
  totalCollectedCents?: number;
  spotsRemaining?: number;
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  circleId: string | null;
  depositPaid: boolean;
  depositPaidAt: string | null;
  totalPaidCents: number;
  paymentStatus: 'pending' | 'current' | 'partial' | 'behind' | 'complete';
  joinedAt: string;
  cancelledAt: string | null;
  // Joined
  userName?: string;
  userInitials?: string;
}

export interface TripContribution {
  id: string;
  tripMemberId: string;
  tripId: string;
  userId: string;
  amountCents: number;
  type: 'deposit' | 'monthly' | 'extra' | 'refund';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface TripPaymentSchedule {
  id: string;
  tripMemberId: string;
  tripId: string;
  monthNumber: number;
  amountCents: number;
  dueDate: string;
  status: 'upcoming' | 'due' | 'paid' | 'late' | 'missed';
  contributionId: string | null;
}

export interface TripSummary {
  trip: TripListing;
  memberCount: number;
  totalCollectedCents: number;
  percentComplete: number;
  targetCents: number;
  spotsRemaining: number;
  daysUntilDeparture: number;
  estimatedBookingDate: string | null;
}

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapProvider(row: any): ProviderProfile {
  return {
    id: row.id,
    userId: row.user_id,
    providerType: row.provider_type,
    businessName: row.business_name,
    bio: row.bio,
    yearsOperating: row.years_operating,
    avgGroupSize: row.avg_group_size,
    profilePhotoUrl: row.profile_photo_url,
    trustLevel: row.trust_level ?? 'claimed',
    elderEndorsementRequested: row.elder_endorsement_requested ?? false,
    verificationStatus: row.verification_status ?? 'pending',
    documents: row.documents ?? [],
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrip(row: any): TripListing {
  return {
    id: row.id,
    providerId: row.provider_id,
    title: row.title,
    description: row.description,
    emoji: row.emoji ?? "✈️",
    coverPhotoUrl: row.cover_photo_url,
    coverVideoUrl: row.cover_video_url,
    departureDate: row.departure_date,
    returnDate: row.return_date,
    originCity: row.origin_city,
    destination: row.destination,
    pricePerPersonCents: row.price_per_person_cents,
    depositCents: row.deposit_cents,
    suggestedMonthlyCents: row.suggested_monthly_cents,
    suggestedMonths: row.suggested_months,
    minTravelers: row.min_travelers ?? 1,
    maxTravelers: row.max_travelers ?? 20,
    includes: row.includes ?? [],
    status: row.status ?? 'draft',
    escrowTotalCents: row.escrow_total_cents ?? 0,
    tandaxnFeePct: parseFloat(row.tandaxn_fee_pct) || 5,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined
    provider: row.provider_profiles ? mapProvider(row.provider_profiles) : undefined,
    memberCount: row.member_count,
    totalCollectedCents: row.total_collected_cents,
    spotsRemaining: row.spots_remaining,
  };
}

function mapMember(row: any): TripMember {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    circleId: row.circle_id,
    depositPaid: row.deposit_paid ?? false,
    depositPaidAt: row.deposit_paid_at,
    totalPaidCents: row.total_paid_cents ?? 0,
    paymentStatus: row.payment_status ?? 'pending',
    joinedAt: row.joined_at,
    cancelledAt: row.cancelled_at,
    // Joined
    userName: row.user_name ?? row.profiles?.full_name,
    userInitials: row.user_initials ?? row.profiles?.initials,
  };
}

function mapContribution(row: any): TripContribution {
  return {
    id: row.id,
    tripMemberId: row.trip_member_id,
    tripId: row.trip_id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    type: row.type,
    status: row.status ?? 'pending',
    dueDate: row.due_date,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapSchedule(row: any): TripPaymentSchedule {
  return {
    id: row.id,
    tripMemberId: row.trip_member_id,
    tripId: row.trip_id,
    monthNumber: row.month_number,
    amountCents: row.amount_cents,
    dueDate: row.due_date,
    status: row.status ?? 'upcoming',
    contributionId: row.contribution_id,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TRIP CIRCLE ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class TripCircleEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A: PROVIDER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a new provider profile for a user */
  static async createProviderProfile(
    userId: string,
    data: {
      providerType: ProviderProfile['providerType'];
      businessName: string;
      bio?: string;
      yearsOperating?: number;
      avgGroupSize?: string;
      profilePhotoUrl?: string;
    }
  ): Promise<ProviderProfile> {
    const { data: row, error } = await supabase
      .from("provider_profiles")
      .insert({
        user_id: userId,
        provider_type: data.providerType,
        business_name: data.businessName,
        bio: data.bio,
        years_operating: data.yearsOperating,
        avg_group_size: data.avgGroupSize,
        profile_photo_url: data.profilePhotoUrl,
        trust_level: 'claimed',
        verification_status: 'pending',
        documents: [],
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProvider(row);
  }

  /** Update an existing provider profile */
  static async updateProviderProfile(
    providerId: string,
    data: Partial<{
      businessName: string;
      bio: string;
      yearsOperating: number;
      avgGroupSize: string;
      profilePhotoUrl: string;
      providerType: ProviderProfile['providerType'];
      isActive: boolean;
    }>
  ): Promise<ProviderProfile> {
    const update: any = {};
    if (data.businessName !== undefined) update.business_name = data.businessName;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.yearsOperating !== undefined) update.years_operating = data.yearsOperating;
    if (data.avgGroupSize !== undefined) update.avg_group_size = data.avgGroupSize;
    if (data.profilePhotoUrl !== undefined) update.profile_photo_url = data.profilePhotoUrl;
    if (data.providerType !== undefined) update.provider_type = data.providerType;
    if (data.isActive !== undefined) update.is_active = data.isActive;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("provider_profiles")
      .update(update)
      .eq("id", providerId)
      .select()
      .single();
    if (error) throw error;
    return mapProvider(row);
  }

  /** Get provider profile by user ID */
  static async getProviderProfile(userId: string): Promise<ProviderProfile | null> {
    const { data, error } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProvider(data) : null;
  }

  /** Get provider profile by provider ID */
  static async getProviderById(providerId: string): Promise<ProviderProfile | null> {
    const { data, error } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("id", providerId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProvider(data) : null;
  }

  /** Submit provider for verification with supporting documents */
  static async submitForVerification(
    providerId: string,
    documents: { type: string; url: string }[]
  ): Promise<ProviderProfile> {
    const docs = documents.map((d) => ({
      type: d.type,
      url: d.url,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("provider_profiles")
      .update({
        verification_status: 'under_review',
        documents: docs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId)
      .select()
      .single();
    if (error) throw error;
    return mapProvider(data);
  }

  /** Request elder endorsement for a provider */
  static async requestElderEndorsement(providerId: string): Promise<ProviderProfile> {
    const { data, error } = await supabase
      .from("provider_profiles")
      .update({
        elder_endorsement_requested: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId)
      .select()
      .single();
    if (error) throw error;
    return mapProvider(data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B: TRIP LISTING CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a new trip listing for a provider */
  static async createTripListing(
    providerId: string,
    data: {
      title: string;
      description?: string;
      emoji?: string;
      coverPhotoUrl?: string;
      coverVideoUrl?: string;
      departureDate: string;
      returnDate: string;
      originCity?: string;
      destination: string;
      pricePerPersonCents: number;
      depositCents: number;
      minTravelers?: number;
      maxTravelers?: number;
      includes?: { item: string; emoji: string; included: boolean }[];
      tandaxnFeePct?: number;
    }
  ): Promise<TripListing> {
    // Auto-calculate suggested monthly and months from price and deposit
    const remaining = data.pricePerPersonCents - data.depositCents;
    const departureMs = new Date(data.departureDate).getTime();
    const nowMs = Date.now();
    const monthsUntilDeparture = Math.max(
      1,
      Math.floor((departureMs - nowMs) / (1000 * 60 * 60 * 24 * 30))
    );
    const suggestedMonths = Math.min(monthsUntilDeparture, 12);
    const suggestedMonthlyCents = suggestedMonths > 0
      ? Math.ceil(remaining / suggestedMonths)
      : remaining;

    const { data: row, error } = await supabase
      .from("trip_listings")
      .insert({
        provider_id: providerId,
        title: data.title,
        description: data.description,
        emoji: data.emoji ?? "✈️",
        cover_photo_url: data.coverPhotoUrl,
        cover_video_url: data.coverVideoUrl,
        departure_date: data.departureDate,
        return_date: data.returnDate,
        origin_city: data.originCity,
        destination: data.destination,
        price_per_person_cents: data.pricePerPersonCents,
        deposit_cents: data.depositCents,
        suggested_monthly_cents: suggestedMonthlyCents,
        suggested_months: suggestedMonths,
        min_travelers: data.minTravelers ?? 1,
        max_travelers: data.maxTravelers ?? 20,
        includes: data.includes ?? [],
        status: 'draft',
        escrow_total_cents: 0,
        tandaxn_fee_pct: data.tandaxnFeePct ?? 5,
      })
      .select()
      .single();
    if (error) throw error;
    return mapTrip(row);
  }

  /** Update an existing trip listing */
  static async updateTripListing(
    tripId: string,
    data: Partial<{
      title: string;
      description: string;
      emoji: string;
      coverPhotoUrl: string;
      coverVideoUrl: string;
      departureDate: string;
      returnDate: string;
      originCity: string;
      destination: string;
      pricePerPersonCents: number;
      depositCents: number;
      suggestedMonthlyCents: number;
      suggestedMonths: number;
      minTravelers: number;
      maxTravelers: number;
      includes: { item: string; emoji: string; included: boolean }[];
      tandaxnFeePct: number;
    }>
  ): Promise<TripListing> {
    const update: any = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.emoji !== undefined) update.emoji = data.emoji;
    if (data.coverPhotoUrl !== undefined) update.cover_photo_url = data.coverPhotoUrl;
    if (data.coverVideoUrl !== undefined) update.cover_video_url = data.coverVideoUrl;
    if (data.departureDate !== undefined) update.departure_date = data.departureDate;
    if (data.returnDate !== undefined) update.return_date = data.returnDate;
    if (data.originCity !== undefined) update.origin_city = data.originCity;
    if (data.destination !== undefined) update.destination = data.destination;
    if (data.pricePerPersonCents !== undefined) update.price_per_person_cents = data.pricePerPersonCents;
    if (data.depositCents !== undefined) update.deposit_cents = data.depositCents;
    if (data.suggestedMonthlyCents !== undefined) update.suggested_monthly_cents = data.suggestedMonthlyCents;
    if (data.suggestedMonths !== undefined) update.suggested_months = data.suggestedMonths;
    if (data.minTravelers !== undefined) update.min_travelers = data.minTravelers;
    if (data.maxTravelers !== undefined) update.max_travelers = data.maxTravelers;
    if (data.includes !== undefined) update.includes = data.includes;
    if (data.tandaxnFeePct !== undefined) update.tandaxn_fee_pct = data.tandaxnFeePct;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("trip_listings")
      .update(update)
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw error;
    return mapTrip(row);
  }

  /** Publish a draft trip listing — sets status to live */
  static async publishTrip(tripId: string): Promise<TripListing> {
    const { data, error } = await supabase
      .from("trip_listings")
      .update({
        status: 'live',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw error;
    return mapTrip(data);
  }

  /** Cancel a trip and trigger refunds for all members */
  static async cancelTrip(tripId: string): Promise<TripListing> {
    // First, get all active members to issue refunds
    const { data: members, error: membersErr } = await supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", tripId)
      .is("cancelled_at", null);
    if (membersErr) throw membersErr;

    // Create refund contributions for each member who has paid
    if (members && members.length > 0) {
      const refunds = members
        .filter((m: any) => m.total_paid_cents > 0)
        .map((m: any) => ({
          trip_member_id: m.id,
          trip_id: tripId,
          user_id: m.user_id,
          amount_cents: m.total_paid_cents,
          type: 'refund',
          status: 'pending',
          created_at: new Date().toISOString(),
        }));

      if (refunds.length > 0) {
        const { error: refundErr } = await supabase
          .from("trip_contributions")
          .insert(refunds);
        if (refundErr) throw refundErr;
      }

      // Cancel all memberships
      const { error: cancelErr } = await supabase
        .from("trip_members")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("trip_id", tripId)
        .is("cancelled_at", null);
      if (cancelErr) throw cancelErr;
    }

    // Update trip status
    const { data, error } = await supabase
      .from("trip_listings")
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw error;
    return mapTrip(data);
  }

  /** Get a single trip listing with provider, member count, and totals */
  static async getTripListing(tripId: string): Promise<TripListing | null> {
    const { data, error } = await supabase
      .from("trip_listings")
      .select("*, provider_profiles(*)")
      .eq("id", tripId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    // Get member count and total collected
    const { count: memberCount } = await supabase
      .from("trip_members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .is("cancelled_at", null);

    const { data: totals } = await supabase
      .from("trip_members")
      .select("total_paid_cents")
      .eq("trip_id", tripId)
      .is("cancelled_at", null);

    const totalCollected = (totals ?? []).reduce(
      (sum: number, m: any) => sum + (m.total_paid_cents ?? 0), 0
    );

    const trip = mapTrip(data);
    trip.memberCount = memberCount ?? 0;
    trip.totalCollectedCents = totalCollected;
    trip.spotsRemaining = trip.maxTravelers - (memberCount ?? 0);
    return trip;
  }

  /** Get all live trip listings with optional filters */
  static async getLiveTrips(filters?: {
    destination?: string;
    minPrice?: number;
    maxPrice?: number;
    departureAfter?: string;
    departureBefore?: string;
  }): Promise<TripListing[]> {
    let query = supabase
      .from("trip_listings")
      .select("*, provider_profiles(*)")
      .eq("status", "live")
      .order("departure_date", { ascending: true });

    if (filters?.destination) {
      query = query.ilike("destination", `%${filters.destination}%`);
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte("price_per_person_cents", filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte("price_per_person_cents", filters.maxPrice);
    }
    if (filters?.departureAfter) {
      query = query.gte("departure_date", filters.departureAfter);
    }
    if (filters?.departureBefore) {
      query = query.lte("departure_date", filters.departureBefore);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapTrip);
  }

  /** Get all trips belonging to a specific provider */
  static async getProviderTrips(providerId: string): Promise<TripListing[]> {
    const { data, error } = await supabase
      .from("trip_listings")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTrip);
  }

  /** Get a full trip summary with calculated fields */
  static async getTripSummary(tripId: string): Promise<TripSummary | null> {
    const trip = await TripCircleEngine.getTripListing(tripId);
    if (!trip) return null;

    const memberCount = trip.memberCount ?? 0;
    const totalCollected = trip.totalCollectedCents ?? 0;
    const targetCents = trip.pricePerPersonCents * memberCount;
    const percentComplete = targetCents > 0 ? Math.round((totalCollected / targetCents) * 100) : 0;
    const spotsRemaining = trip.maxTravelers - memberCount;

    const departureMs = new Date(trip.departureDate).getTime();
    const nowMs = Date.now();
    const daysUntilDeparture = Math.max(
      0,
      Math.ceil((departureMs - nowMs) / (1000 * 60 * 60 * 24))
    );

    // Estimate booking date: when enough is collected (80% threshold)
    let estimatedBookingDate: string | null = null;
    if (targetCents > 0 && totalCollected < targetCents * 0.8) {
      const monthlyRate = trip.suggestedMonthlyCents
        ? (trip.suggestedMonthlyCents * memberCount)
        : 0;
      if (monthlyRate > 0) {
        const remaining80 = targetCents * 0.8 - totalCollected;
        const monthsNeeded = Math.ceil(remaining80 / monthlyRate);
        const estDate = new Date();
        estDate.setMonth(estDate.getMonth() + monthsNeeded);
        estimatedBookingDate = estDate.toISOString().split("T")[0];
      }
    } else if (totalCollected >= targetCents * 0.8) {
      estimatedBookingDate = new Date().toISOString().split("T")[0];
    }

    return {
      trip,
      memberCount,
      totalCollectedCents: totalCollected,
      percentComplete,
      targetCents,
      spotsRemaining,
      daysUntilDeparture,
      estimatedBookingDate,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C: TRIP MEMBERSHIP
  // ═══════════════════════════════════════════════════════════════════════════

  /** Join a trip — creates membership record and generates payment schedule */
  static async joinTrip(userId: string, tripId: string): Promise<TripMember> {
    // Get the trip to calculate schedule
    const { data: trip, error: tripErr } = await supabase
      .from("trip_listings")
      .select("*")
      .eq("id", tripId)
      .single();
    if (tripErr) throw tripErr;

    // Check if already a member
    const { data: existing } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .maybeSingle();
    if (existing) throw new Error("User is already a member of this trip");

    // Check capacity
    const { count } = await supabase
      .from("trip_members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .is("cancelled_at", null);
    if ((count ?? 0) >= trip.max_travelers) {
      throw new Error("Trip is full — no spots remaining");
    }

    // Create the membership
    const { data: member, error: memberErr } = await supabase
      .from("trip_members")
      .insert({
        trip_id: tripId,
        user_id: userId,
        deposit_paid: false,
        total_paid_cents: 0,
        payment_status: 'pending',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (memberErr) throw memberErr;

    // Generate payment schedule
    const remaining = trip.price_per_person_cents - trip.deposit_cents;
    const months = trip.suggested_months ?? 6;
    const monthlyCents = months > 0 ? Math.ceil(remaining / months) : remaining;
    const scheduleRows = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + i);
      scheduleRows.push({
        trip_member_id: member.id,
        trip_id: tripId,
        month_number: i,
        amount_cents: i < months ? monthlyCents : remaining - monthlyCents * (months - 1),
        due_date: dueDate.toISOString().split("T")[0],
        status: 'upcoming',
      });
    }

    if (scheduleRows.length > 0) {
      const { error: schedErr } = await supabase
        .from("trip_payment_schedules")
        .insert(scheduleRows);
      if (schedErr) throw schedErr;
    }

    // Update trip status if now full
    const newCount = (count ?? 0) + 1;
    if (newCount >= trip.max_travelers) {
      await supabase
        .from("trip_listings")
        .update({ status: 'full', updated_at: new Date().toISOString() })
        .eq("id", tripId);
    }

    return mapMember(member);
  }

  /** Pay the deposit for a trip membership */
  static async payDeposit(tripMemberId: string): Promise<TripContribution> {
    // Get the member and trip
    const { data: member, error: mErr } = await supabase
      .from("trip_members")
      .select("*, trip_listings(*)")
      .eq("id", tripMemberId)
      .single();
    if (mErr) throw mErr;

    if (member.deposit_paid) {
      throw new Error("Deposit has already been paid");
    }

    const depositCents = member.trip_listings.deposit_cents;

    // Create the deposit contribution
    const { data: contribution, error: cErr } = await supabase
      .from("trip_contributions")
      .insert({
        trip_member_id: tripMemberId,
        trip_id: member.trip_id,
        user_id: member.user_id,
        amount_cents: depositCents,
        type: 'deposit',
        status: 'completed',
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (cErr) throw cErr;

    // Update the member record
    const { error: uErr } = await supabase
      .from("trip_members")
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        total_paid_cents: member.total_paid_cents + depositCents,
        payment_status: 'current',
      })
      .eq("id", tripMemberId);
    if (uErr) throw uErr;

    // Update escrow total on the trip
    await supabase
      .from("trip_listings")
      .update({
        escrow_total_cents: (member.trip_listings.escrow_total_cents ?? 0) + depositCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.trip_id);

    return mapContribution(contribution);
  }

  /** Cancel a trip membership and calculate refund */
  static async cancelMembership(tripMemberId: string): Promise<TripMember> {
    const { data: member, error: mErr } = await supabase
      .from("trip_members")
      .select("*")
      .eq("id", tripMemberId)
      .single();
    if (mErr) throw mErr;

    // Create refund contribution if the member has paid anything
    if (member.total_paid_cents > 0) {
      await supabase
        .from("trip_contributions")
        .insert({
          trip_member_id: tripMemberId,
          trip_id: member.trip_id,
          user_id: member.user_id,
          amount_cents: member.total_paid_cents,
          type: 'refund',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
    }

    // Cancel the membership
    const { data: updated, error: uErr } = await supabase
      .from("trip_members")
      .update({
        cancelled_at: new Date().toISOString(),
        payment_status: 'pending',
      })
      .eq("id", tripMemberId)
      .select()
      .single();
    if (uErr) throw uErr;

    // If trip was full, revert to live
    const { data: trip } = await supabase
      .from("trip_listings")
      .select("status")
      .eq("id", member.trip_id)
      .single();
    if (trip?.status === 'full') {
      await supabase
        .from("trip_listings")
        .update({ status: 'live', updated_at: new Date().toISOString() })
        .eq("id", member.trip_id);
    }

    return mapMember(updated);
  }

  /** Get all active members of a trip with payment status */
  static async getTripMembers(tripId: string): Promise<TripMember[]> {
    const { data, error } = await supabase
      .from("trip_members")
      .select("*, profiles(full_name, initials)")
      .eq("trip_id", tripId)
      .is("cancelled_at", null)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapMember);
  }

  /** Get all trips that a user is a member of */
  static async getMemberTrips(userId: string): Promise<TripListing[]> {
    const { data, error } = await supabase
      .from("trip_members")
      .select("trip_id, trip_listings(*, provider_profiles(*))")
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data ?? [])
      .filter((r: any) => r.trip_listings)
      .map((r: any) => mapTrip(r.trip_listings));
  }

  /** Get a member's full trip detail including schedule and contributions */
  static async getMemberTripDetail(
    userId: string,
    tripId: string
  ): Promise<{
    member: TripMember;
    trip: TripListing;
    schedule: TripPaymentSchedule[];
    contributions: TripContribution[];
  } | null> {
    const { data: memberRow, error: mErr } = await supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .is("cancelled_at", null)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!memberRow) return null;

    const member = mapMember(memberRow);

    // Fetch trip, schedule, and contributions in parallel
    const [tripRes, schedRes, contribRes] = await Promise.all([
      supabase
        .from("trip_listings")
        .select("*, provider_profiles(*)")
        .eq("id", tripId)
        .single(),
      supabase
        .from("trip_payment_schedules")
        .select("*")
        .eq("trip_member_id", member.id)
        .order("month_number", { ascending: true }),
      supabase
        .from("trip_contributions")
        .select("*")
        .eq("trip_member_id", member.id)
        .order("created_at", { ascending: false }),
    ]);

    if (tripRes.error) throw tripRes.error;

    return {
      member,
      trip: mapTrip(tripRes.data),
      schedule: (schedRes.data ?? []).map(mapSchedule),
      contributions: (contribRes.data ?? []).map(mapContribution),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D: CONTRIBUTIONS & PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Record a contribution for a trip member */
  static async recordContribution(
    tripMemberId: string,
    amountCents: number,
    type: TripContribution['type']
  ): Promise<TripContribution> {
    // Get the member
    const { data: member, error: mErr } = await supabase
      .from("trip_members")
      .select("*, trip_listings(*)")
      .eq("id", tripMemberId)
      .single();
    if (mErr) throw mErr;

    // Create the contribution
    const { data: contrib, error: cErr } = await supabase
      .from("trip_contributions")
      .insert({
        trip_member_id: tripMemberId,
        trip_id: member.trip_id,
        user_id: member.user_id,
        amount_cents: amountCents,
        type,
        status: 'completed',
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (cErr) throw cErr;

    // Update total_paid_cents and payment_status on the member
    const newTotal = member.total_paid_cents + amountCents;
    const tripPrice = member.trip_listings.price_per_person_cents;
    let paymentStatus: TripMember['paymentStatus'] = 'current';
    if (newTotal >= tripPrice) {
      paymentStatus = 'complete';
    } else if (newTotal > 0) {
      paymentStatus = 'partial';
    }

    const { error: uErr } = await supabase
      .from("trip_members")
      .update({
        total_paid_cents: newTotal,
        payment_status: paymentStatus,
      })
      .eq("id", tripMemberId);
    if (uErr) throw uErr;

    // Update escrow total
    await supabase
      .from("trip_listings")
      .update({
        escrow_total_cents: (member.trip_listings.escrow_total_cents ?? 0) + amountCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.trip_id);

    return mapContribution(contrib);
  }

  /** Get all contributions for a specific member */
  static async getContributionHistory(tripMemberId: string): Promise<TripContribution[]> {
    const { data, error } = await supabase
      .from("trip_contributions")
      .select("*")
      .eq("trip_member_id", tripMemberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapContribution);
  }

  /** Get the full payment schedule for a member */
  static async getPaymentSchedule(tripMemberId: string): Promise<TripPaymentSchedule[]> {
    const { data, error } = await supabase
      .from("trip_payment_schedules")
      .select("*")
      .eq("trip_member_id", tripMemberId)
      .order("month_number", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapSchedule);
  }

  /** Process a scheduled payment — marks as paid and creates contribution */
  static async processScheduledPayment(scheduleId: string): Promise<TripContribution> {
    // Get the schedule item
    const { data: sched, error: sErr } = await supabase
      .from("trip_payment_schedules")
      .select("*")
      .eq("id", scheduleId)
      .single();
    if (sErr) throw sErr;

    if (sched.status === 'paid') {
      throw new Error("This scheduled payment has already been processed");
    }

    // Record the contribution
    const contribution = await TripCircleEngine.recordContribution(
      sched.trip_member_id,
      sched.amount_cents,
      'monthly'
    );

    // Mark schedule item as paid
    const { error: uErr } = await supabase
      .from("trip_payment_schedules")
      .update({
        status: 'paid',
        contribution_id: contribution.id,
      })
      .eq("id", scheduleId);
    if (uErr) throw uErr;

    return contribution;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E: TRIP PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Calculate overall trip collection progress */
  static async calculateTripProgress(tripId: string): Promise<{
    totalCollected: number;
    target: number;
    percent: number;
    memberStats: { total: number; depositPaid: number; complete: number; behind: number };
  }> {
    const { data: trip, error: tErr } = await supabase
      .from("trip_listings")
      .select("price_per_person_cents")
      .eq("id", tripId)
      .single();
    if (tErr) throw tErr;

    const { data: members, error: mErr } = await supabase
      .from("trip_members")
      .select("total_paid_cents, deposit_paid, payment_status")
      .eq("trip_id", tripId)
      .is("cancelled_at", null);
    if (mErr) throw mErr;

    const memberList = members ?? [];
    const totalCollected = memberList.reduce(
      (sum: number, m: any) => sum + (m.total_paid_cents ?? 0), 0
    );
    const target = trip.price_per_person_cents * memberList.length;
    const percent = target > 0 ? Math.round((totalCollected / target) * 100) : 0;

    return {
      totalCollected,
      target,
      percent,
      memberStats: {
        total: memberList.length,
        depositPaid: memberList.filter((m: any) => m.deposit_paid).length,
        complete: memberList.filter((m: any) => m.payment_status === 'complete').length,
        behind: memberList.filter((m: any) => m.payment_status === 'behind').length,
      },
    };
  }

  /** Calculate individual member payment progress */
  static async calculateMemberProgress(tripMemberId: string): Promise<{
    paid: number;
    total: number;
    percent: number;
    nextDue: TripPaymentSchedule | null;
  }> {
    const { data: member, error: mErr } = await supabase
      .from("trip_members")
      .select("total_paid_cents, trip_listings(price_per_person_cents)")
      .eq("id", tripMemberId)
      .single();
    if (mErr) throw mErr;

    const paid = member.total_paid_cents ?? 0;
    const total = (member as any).trip_listings?.price_per_person_cents ?? 0;
    const percent = total > 0 ? Math.round((paid / total) * 100) : 0;

    // Get next upcoming or due schedule item
    const { data: nextSched } = await supabase
      .from("trip_payment_schedules")
      .select("*")
      .eq("trip_member_id", tripMemberId)
      .in("status", ['upcoming', 'due'])
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      paid,
      total,
      percent,
      nextDue: nextSched ? mapSchedule(nextSched) : null,
    };
  }

  /** Get the payout timeline for a trip */
  static async getPayoutTimeline(tripId: string): Promise<{
    depositsCollected: number;
    fullPayoutAmount: number;
    estimatedBookingDate: string | null;
    feeCents: number;
  }> {
    const { data: trip, error: tErr } = await supabase
      .from("trip_listings")
      .select("*")
      .eq("id", tripId)
      .single();
    if (tErr) throw tErr;

    const { data: members, error: mErr } = await supabase
      .from("trip_members")
      .select("total_paid_cents, deposit_paid")
      .eq("trip_id", tripId)
      .is("cancelled_at", null);
    if (mErr) throw mErr;

    const memberList = members ?? [];
    const depositsCollected = memberList.filter((m: any) => m.deposit_paid).length
      * trip.deposit_cents;
    const totalCollected = memberList.reduce(
      (sum: number, m: any) => sum + (m.total_paid_cents ?? 0), 0
    );
    const fullPayoutAmount = trip.price_per_person_cents * memberList.length;
    const feePct = parseFloat(trip.tandaxn_fee_pct) || 5;
    const feeCents = Math.round(fullPayoutAmount * (feePct / 100));

    // Estimate booking date
    let estimatedBookingDate: string | null = null;
    const threshold = fullPayoutAmount * 0.8;
    if (totalCollected >= threshold) {
      estimatedBookingDate = new Date().toISOString().split("T")[0];
    } else if (memberList.length > 0 && trip.suggested_monthly_cents) {
      const monthlyRate = trip.suggested_monthly_cents * memberList.length;
      const remaining = threshold - totalCollected;
      const monthsNeeded = Math.ceil(remaining / monthlyRate);
      const estDate = new Date();
      estDate.setMonth(estDate.getMonth() + monthsNeeded);
      estimatedBookingDate = estDate.toISOString().split("T")[0];
    }

    return {
      depositsCollected,
      fullPayoutAmount,
      estimatedBookingDate,
      feeCents,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION F: REALTIME
  // ═══════════════════════════════════════════════════════════════════════════

  /** Subscribe to realtime changes on a trip (listings + members) */
  static subscribeToTrip(
    tripId: string,
    callback: (payload: { type: string; table: string; data: any }) => void
  ) {
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_listings",
          filter: `id=eq.${tripId}`,
        },
        (payload) =>
          callback({ type: payload.eventType, table: "trip_listings", data: payload.new })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) =>
          callback({ type: payload.eventType, table: "trip_members", data: payload.new })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /** Subscribe to realtime changes for a user's trip memberships */
  static subscribeToMemberTrips(
    userId: string,
    callback: (payload: { type: string; table: string; data: any }) => void
  ) {
    const channel = supabase
      .channel(`member-trips-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) =>
          callback({ type: payload.eventType, table: "trip_members", data: payload.new })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
