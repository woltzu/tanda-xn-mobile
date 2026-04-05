// ══════════════════════════════════════════════════════════════════════════════
// MarketplaceEngine — Core marketplace business logic
// Stores, services, bookings, CSV uploads, SMS invites, reviews, insights
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type StoreCategory =
  | "food" | "beauty" | "travel" | "shipping"
  | "finance" | "events" | "realestate" | "health" | "other";

export type StoreStatus = "draft" | "claimed" | "active" | "suspended" | "banned";
export type StoreBadge = "claimed" | "trusted" | "verified";
export type PaymentType = "immediate" | "payout_day";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "refunded" | "payment_due" | "payment_failed";
export type SmsStatus = "pending" | "sent" | "delivered" | "failed" | "opted_out";
export type SmsLanguage = "fr" | "en" | "both";
export type DisputeStage = 1 | 2 | 3;

export interface MarketplaceStore {
  id: string;
  ownerId: string | null;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  city: string;
  state: string | null;
  neighborhood: string | null;
  category: StoreCategory;
  description: string | null;
  photoUrl: string | null;
  emoji: string;
  memberDiscountPct: number;
  exclusiveOffer: string | null;
  status: StoreStatus;
  badge: StoreBadge;
  createdBy: string | null;
  claimedAt: string | null;
  claimToken: string | null;
  isFeatured: boolean;
  featuredUntil: string | null;
  totalReviews: number;
  avgRating: number;
  totalBookings: number;
  profileViews: number;
  managedCircles: any[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreService {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  priceCents: number;
  emoji: string;
  category: string | null;
  isAvailable: boolean;
  isPopular: boolean;
  stockStatus: string;
  durationMinutes: number | null;
  sortOrder: number;
}

export interface StoreReview {
  id: string;
  storeId: string;
  reviewerId: string;
  rating: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  storeId: string;
  serviceId: string | null;
  memberId: string;
  serviceName: string;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  paymentType: PaymentType;
  payoutDate: string | null;
  circleId: string | null;
  stripePaymentIntentId: string | null;
  status: BookingStatus;
  isEscrow: boolean;
  escrowReleasedAt: string | null;
  appointmentDate: string | null;
  notes: string | null;
  createdAt: string;
  // Joined fields
  storeName?: string;
  storeEmoji?: string;
}

export interface MemberInvite {
  id: string;
  storeId: string | null;
  invitedBy: string | null;
  firstName: string;
  lastName: string | null;
  phone: string;
  circleName: string | null;
  token: string;
  inviteLink: string;
  smsStatus: SmsStatus;
  smsLanguage: SmsLanguage;
  smsSentAt: string | null;
  smsMessageSid: string | null;
  joinedAt: string | null;
  joinedUserId: string | null;
  csvUploadId: string | null;
  batchId: string | null;
  createdAt: string;
}

export interface CsvUpload {
  id: string;
  storeId: string;
  uploadedBy: string;
  fileName: string;
  fileUrl: string | null;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: any[];
  status: string;
  processedAt: string | null;
  createdAt: string;
}

export interface MarketInsight {
  id: string;
  city: string;
  category: StoreCategory;
  diasporaPopulation: number;
  activeMembers: number;
  annualSpendMillions: number;
  avgOrderValueCents: number;
  supplyPct: number;
  providerCount: number;
  spendMultiplier: number;
  communityBreakdown: any[];
}

export interface ProviderRequest {
  id: string;
  userId: string;
  category: StoreCategory;
  city: string;
  description: string | null;
  isSignalSent: boolean;
  createdAt: string;
}

export interface StoreInquiry {
  id: string;
  storeId: string;
  userId: string;
  message: string;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface MarketplaceDispute {
  id: string;
  bookingId: string;
  storeId: string;
  customerId: string;
  stage: DisputeStage;
  description: string;
  resolution: string | null;
  elderId: string | null;
  elderRecommendation: string | null;
  adminId: string | null;
  adminDecision: string | null;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
}

// ─── PARAMS ─────────────────────────────────────────────────────────────────

export interface CreateStoreParams {
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  city: string;
  state?: string;
  neighborhood?: string;
  category: StoreCategory;
  description?: string;
  photoUrl?: string;
  emoji?: string;
  memberDiscountPct?: number;
  exclusiveOffer?: string;
  managedCircles?: any[];
}

export interface CreateBookingParams {
  storeId: string;
  serviceId?: string;
  serviceName: string;
  originalAmountCents: number;
  discountAmountCents?: number;
  finalAmountCents: number;
  paymentType: PaymentType;
  payoutDate?: string;
  circleId?: string;
  appointmentDate?: string;
  notes?: string;
}

export interface CsvRow {
  first_name: string;
  last_name?: string;
  phone: string;
  circle_name?: string;
}

export interface SendInvitesParams {
  storeId: string;
  inviteIds?: string[];     // specific invites, or all pending if omitted
  language?: SmsLanguage;
  storeName?: string;
  ownerName?: string;
}

export interface RevenueEstimate {
  customersPerMonth: number;
  avgOrderValueCents: number;
  repeatVisitRate: number;
  monthlyRevenueCents: number;
  annualRevenueCents: number;
  monthlyOrders: number;
}

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapStore(row: any): MarketplaceStore {
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    category: row.category,
    description: row.description,
    photoUrl: row.photo_url,
    emoji: row.emoji ?? "🏪",
    memberDiscountPct: row.member_discount_pct ?? 10,
    exclusiveOffer: row.exclusive_offer,
    status: row.status,
    badge: row.badge,
    createdBy: row.created_by,
    claimedAt: row.claimed_at,
    claimToken: row.claim_token,
    isFeatured: row.is_featured ?? false,
    featuredUntil: row.featured_until,
    totalReviews: row.total_reviews ?? 0,
    avgRating: parseFloat(row.avg_rating) || 0,
    totalBookings: row.total_bookings ?? 0,
    profileViews: row.profile_views ?? 0,
    managedCircles: row.managed_circles ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapService(row: any): StoreService {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    emoji: row.emoji ?? "✂️",
    category: row.category,
    isAvailable: row.is_available ?? true,
    isPopular: row.is_popular ?? false,
    stockStatus: row.stock_status ?? "available",
    durationMinutes: row.duration_minutes,
    sortOrder: row.sort_order ?? 0,
  };
}

function mapBooking(row: any): Booking {
  return {
    id: row.id,
    storeId: row.store_id,
    serviceId: row.service_id,
    memberId: row.member_id,
    serviceName: row.service_name,
    originalAmountCents: row.original_amount_cents,
    discountAmountCents: row.discount_amount_cents ?? 0,
    finalAmountCents: row.final_amount_cents,
    paymentType: row.payment_type,
    payoutDate: row.payout_date,
    circleId: row.circle_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    status: row.status,
    isEscrow: row.is_escrow ?? false,
    escrowReleasedAt: row.escrow_released_at,
    appointmentDate: row.appointment_date,
    notes: row.notes,
    createdAt: row.created_at,
    storeName: row.store_name ?? row.marketplace_stores?.business_name,
    storeEmoji: row.store_emoji ?? row.marketplace_stores?.emoji,
  };
}

function mapInvite(row: any): MemberInvite {
  return {
    id: row.id,
    storeId: row.store_id,
    invitedBy: row.invited_by,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    circleName: row.circle_name,
    token: row.token,
    inviteLink: row.invite_link,
    smsStatus: row.sms_status,
    smsLanguage: row.sms_language,
    smsSentAt: row.sms_sent_at,
    smsMessageSid: row.sms_message_sid,
    joinedAt: row.joined_at,
    joinedUserId: row.joined_user_id,
    csvUploadId: row.csv_upload_id,
    batchId: row.batch_id,
    createdAt: row.created_at,
  };
}

function mapCsvUpload(row: any): CsvUpload {
  return {
    id: row.id,
    storeId: row.store_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    fileUrl: row.file_url,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    duplicateRows: row.duplicate_rows,
    errorRows: row.error_rows,
    errors: row.errors ?? [],
    status: row.status,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

function mapInsight(row: any): MarketInsight {
  return {
    id: row.id,
    city: row.city,
    category: row.category,
    diasporaPopulation: row.diaspora_population,
    activeMembers: row.active_members,
    annualSpendMillions: parseFloat(row.annual_spend_millions) || 0,
    avgOrderValueCents: row.avg_order_value_cents,
    supplyPct: row.supply_pct,
    providerCount: row.provider_count,
    spendMultiplier: parseFloat(row.spend_multiplier) || 1,
    communityBreakdown: row.community_breakdown ?? [],
  };
}

function mapReview(row: any): StoreReview {
  return {
    id: row.id,
    storeId: row.store_id,
    reviewerId: row.reviewer_id,
    rating: row.rating,
    reviewText: row.review_text,
    isVerifiedPurchase: row.is_verified_purchase ?? false,
    createdAt: row.created_at,
  };
}

function mapInquiry(row: any): StoreInquiry {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    message: row.message,
    status: row.status,
    reply: row.reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class MarketplaceEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A: STORES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a new store (provider application or admin-created draft) */
  static async createStore(userId: string, params: CreateStoreParams): Promise<MarketplaceStore> {
    const { data, error } = await supabase
      .from("marketplace_stores")
      .insert({
        owner_id: userId,
        created_by: userId,
        business_name: params.businessName,
        owner_name: params.ownerName,
        phone: params.phone,
        email: params.email,
        city: params.city,
        state: params.state,
        neighborhood: params.neighborhood,
        category: params.category,
        description: params.description,
        photo_url: params.photoUrl,
        emoji: params.emoji ?? "🏪",
        member_discount_pct: params.memberDiscountPct ?? 10,
        exclusive_offer: params.exclusiveOffer,
        managed_circles: params.managedCircles ?? [],
        status: "active",
        badge: "claimed",
      })
      .select()
      .single();
    if (error) throw error;
    return mapStore(data);
  }

  /** Create a draft store (Franck creates for provider to claim later) */
  static async createDraftStore(adminId: string, params: CreateStoreParams): Promise<MarketplaceStore> {
    const { data, error } = await supabase
      .from("marketplace_stores")
      .insert({
        owner_id: null,
        created_by: adminId,
        business_name: params.businessName,
        owner_name: params.ownerName,
        phone: params.phone,
        email: params.email,
        city: params.city,
        state: params.state,
        category: params.category,
        description: params.description,
        photo_url: params.photoUrl,
        emoji: params.emoji,
        member_discount_pct: params.memberDiscountPct ?? 10,
        exclusive_offer: params.exclusiveOffer,
        status: "draft",
        badge: "claimed",
      })
      .select()
      .single();
    if (error) throw error;
    return mapStore(data);
  }

  /** Claim a draft store by token */
  static async claimStore(userId: string, claimToken: string): Promise<MarketplaceStore> {
    const { data, error } = await supabase
      .from("marketplace_stores")
      .update({
        owner_id: userId,
        status: "claimed",
        claimed_at: new Date().toISOString(),
      })
      .eq("claim_token", claimToken)
      .eq("status", "draft")
      .is("owner_id", null)
      .select()
      .single();
    if (error) throw error;
    return mapStore(data);
  }

  /** Get store by ID */
  static async getStore(storeId: string): Promise<MarketplaceStore | null> {
    const { data, error } = await supabase
      .from("marketplace_stores")
      .select("*")
      .eq("id", storeId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapStore(data) : null;
  }

  /** Get store by owner */
  static async getMyStore(userId: string): Promise<MarketplaceStore | null> {
    const { data, error } = await supabase
      .from("marketplace_stores")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStore(data) : null;
  }

  /** List active stores, optionally filtered */
  static async listStores(filters?: {
    category?: StoreCategory;
    city?: string;
    search?: string;
    featuredOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MarketplaceStore[]> {
    let query = supabase
      .from("marketplace_stores")
      .select("*")
      .in("status", ["active", "claimed"])
      .order("is_featured", { ascending: false })
      .order("total_bookings", { ascending: false });

    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters?.search) query = query.or(
      `business_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
    if (filters?.featuredOnly) query = query.eq("is_featured", true);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters?.limit ?? 20) - 1);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapStore);
  }

  /** Update store profile */
  static async updateStore(storeId: string, updates: Partial<CreateStoreParams>): Promise<MarketplaceStore> {
    const mapped: any = {};
    if (updates.businessName !== undefined) mapped.business_name = updates.businessName;
    if (updates.ownerName !== undefined) mapped.owner_name = updates.ownerName;
    if (updates.phone !== undefined) mapped.phone = updates.phone;
    if (updates.email !== undefined) mapped.email = updates.email;
    if (updates.city !== undefined) mapped.city = updates.city;
    if (updates.state !== undefined) mapped.state = updates.state;
    if (updates.neighborhood !== undefined) mapped.neighborhood = updates.neighborhood;
    if (updates.category !== undefined) mapped.category = updates.category;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.photoUrl !== undefined) mapped.photo_url = updates.photoUrl;
    if (updates.emoji !== undefined) mapped.emoji = updates.emoji;
    if (updates.memberDiscountPct !== undefined) mapped.member_discount_pct = updates.memberDiscountPct;
    if (updates.exclusiveOffer !== undefined) mapped.exclusive_offer = updates.exclusiveOffer;
    if (updates.managedCircles !== undefined) mapped.managed_circles = updates.managedCircles;

    const { data, error } = await supabase
      .from("marketplace_stores")
      .update(mapped)
      .eq("id", storeId)
      .select()
      .single();
    if (error) throw error;
    return mapStore(data);
  }

  /** Increment profile views */
  static async recordProfileView(storeId: string): Promise<void> {
    await supabase.rpc("increment_counter", {
      table_name: "marketplace_stores",
      column_name: "profile_views",
      row_id: storeId,
    }).catch(() => {
      // Fallback: direct update
      supabase
        .from("marketplace_stores")
        .update({ profile_views: supabase.rpc ? undefined : 1 } as any)
        .eq("id", storeId);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B: STORE SERVICES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Add a service/product to a store */
  static async addService(storeId: string, params: {
    name: string;
    description?: string;
    priceCents: number;
    emoji?: string;
    category?: string;
    isPopular?: boolean;
    durationMinutes?: number;
    sortOrder?: number;
  }): Promise<StoreService> {
    const { data, error } = await supabase
      .from("store_services")
      .insert({
        store_id: storeId,
        name: params.name,
        description: params.description,
        price_cents: params.priceCents,
        emoji: params.emoji,
        category: params.category,
        is_popular: params.isPopular ?? false,
        duration_minutes: params.durationMinutes,
        sort_order: params.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return mapService(data);
  }

  /** List services for a store */
  static async getStoreServices(storeId: string): Promise<StoreService[]> {
    const { data, error } = await supabase
      .from("store_services")
      .select("*")
      .eq("store_id", storeId)
      .eq("is_available", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map(mapService);
  }

  /** Update a service */
  static async updateService(serviceId: string, updates: Partial<{
    name: string;
    description: string;
    priceCents: number;
    emoji: string;
    isAvailable: boolean;
    isPopular: boolean;
    stockStatus: string;
    durationMinutes: number;
    sortOrder: number;
  }>): Promise<StoreService> {
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.priceCents !== undefined) mapped.price_cents = updates.priceCents;
    if (updates.emoji !== undefined) mapped.emoji = updates.emoji;
    if (updates.isAvailable !== undefined) mapped.is_available = updates.isAvailable;
    if (updates.isPopular !== undefined) mapped.is_popular = updates.isPopular;
    if (updates.stockStatus !== undefined) mapped.stock_status = updates.stockStatus;
    if (updates.durationMinutes !== undefined) mapped.duration_minutes = updates.durationMinutes;
    if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from("store_services")
      .update(mapped)
      .eq("id", serviceId)
      .select()
      .single();
    if (error) throw error;
    return mapService(data);
  }

  /** Delete a service */
  static async deleteService(serviceId: string): Promise<void> {
    const { error } = await supabase
      .from("store_services")
      .delete()
      .eq("id", serviceId);
    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C: BOOKINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a booking */
  static async createBooking(memberId: string, params: CreateBookingParams): Promise<Booking> {
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .insert({
        store_id: params.storeId,
        service_id: params.serviceId,
        member_id: memberId,
        service_name: params.serviceName,
        original_amount_cents: params.originalAmountCents,
        discount_amount_cents: params.discountAmountCents ?? 0,
        final_amount_cents: params.finalAmountCents,
        payment_type: params.paymentType,
        payout_date: params.payoutDate,
        circle_id: params.circleId,
        appointment_date: params.appointmentDate,
        notes: params.notes,
        status: params.paymentType === "payout_day" ? "payment_due" : "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return mapBooking(data);
  }

  /** Get member bookings */
  static async getMemberBookings(memberId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .select("*, marketplace_stores(business_name, emoji)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...mapBooking(row),
      storeName: row.marketplace_stores?.business_name,
      storeEmoji: row.marketplace_stores?.emoji,
    }));
  }

  /** Get store bookings (owner view) */
  static async getStoreBookings(storeId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapBooking);
  }

  /** Update booking status */
  static async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking> {
    const updates: any = { status };
    if (status === "completed") {
      // Release escrow if applicable
      updates.escrow_released_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .update(updates)
      .eq("id", bookingId)
      .select()
      .single();
    if (error) throw error;
    return mapBooking(data);
  }

  /** Get bookings due on payout day (for cron processing) */
  static async getPayoutDayBookings(payoutDate: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .select("*")
      .eq("payment_type", "payout_day")
      .eq("payout_date", payoutDate)
      .eq("status", "payment_due");
    if (error) throw error;
    return (data ?? []).map(mapBooking);
  }

  /** Calculate discounted price for a circle member */
  static calculateDiscountedPrice(priceCents: number, memberDiscountPct: number): {
    originalCents: number;
    discountCents: number;
    finalCents: number;
  } {
    const discountCents = Math.round(priceCents * (memberDiscountPct / 100));
    return {
      originalCents: priceCents,
      discountCents,
      finalCents: priceCents - discountCents,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D: CSV UPLOAD & MEMBER INVITES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Process a CSV upload — parse rows, create invites */
  static async processCsvUpload(
    userId: string,
    storeId: string,
    fileName: string,
    rows: CsvRow[]
  ): Promise<CsvUpload> {
    // 1. Create upload record
    const { data: upload, error: uploadErr } = await supabase
      .from("csv_uploads")
      .insert({
        store_id: storeId,
        uploaded_by: userId,
        file_name: fileName,
        total_rows: rows.length,
        status: "processing",
      })
      .select()
      .single();
    if (uploadErr) throw uploadErr;

    // 2. Validate and deduplicate
    const errors: any[] = [];
    const validRows: CsvRow[] = [];
    const seenPhones = new Set<string>();
    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.first_name?.trim()) {
        errors.push({ row: i + 1, field: "first_name", error: "First name is required" });
        continue;
      }
      if (!row.phone?.trim()) {
        errors.push({ row: i + 1, field: "phone", error: "Phone number is required" });
        continue;
      }

      const normalizedPhone = row.phone.replace(/[^0-9+]/g, "");
      if (seenPhones.has(normalizedPhone)) {
        duplicateCount++;
        continue;
      }
      seenPhones.add(normalizedPhone);
      validRows.push({ ...row, phone: normalizedPhone });
    }

    // 3. Check for existing invites with same phone for this store
    if (validRows.length > 0) {
      const phones = validRows.map(r => r.phone);
      const { data: existing } = await supabase
        .from("member_invites")
        .select("phone")
        .eq("store_id", storeId)
        .in("phone", phones);

      const existingPhones = new Set((existing ?? []).map((e: any) => e.phone));
      const newRows = validRows.filter(r => {
        if (existingPhones.has(r.phone)) {
          duplicateCount++;
          return false;
        }
        return true;
      });

      // 4. Batch insert invites
      if (newRows.length > 0) {
        const batchId = `csv_${upload.id}_${Date.now()}`;
        const inviteRecords = newRows.map(row => ({
          store_id: storeId,
          invited_by: userId,
          first_name: row.first_name.trim(),
          last_name: row.last_name?.trim() || null,
          phone: row.phone,
          circle_name: row.circle_name?.trim() || null,
          csv_upload_id: upload.id,
          batch_id: batchId,
          sms_status: "pending" as const,
          sms_language: "fr" as const,
        }));

        const { error: inviteErr } = await supabase
          .from("member_invites")
          .insert(inviteRecords);
        if (inviteErr) throw inviteErr;
      }

      // 5. Update upload record
      const { data: updated, error: updateErr } = await supabase
        .from("csv_uploads")
        .update({
          valid_rows: newRows.length,
          duplicate_rows: duplicateCount,
          error_rows: errors.length,
          errors,
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", upload.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return mapCsvUpload(updated);
    }

    // No valid rows
    const { data: updated, error: updateErr } = await supabase
      .from("csv_uploads")
      .update({
        valid_rows: 0,
        duplicate_rows: duplicateCount,
        error_rows: errors.length,
        errors,
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", upload.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    return mapCsvUpload(updated);
  }

  /** Get invites for a store */
  static async getStoreInvites(storeId: string, filters?: {
    smsStatus?: SmsStatus;
    circleName?: string;
    batchId?: string;
  }): Promise<MemberInvite[]> {
    let query = supabase
      .from("member_invites")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (filters?.smsStatus) query = query.eq("sms_status", filters.smsStatus);
    if (filters?.circleName) query = query.eq("circle_name", filters.circleName);
    if (filters?.batchId) query = query.eq("batch_id", filters.batchId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapInvite);
  }

  /** Get invite stats for a store */
  static async getInviteStats(storeId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    joined: number;
    failed: number;
    conversionRate: number;
    circles: { name: string; count: number }[];
  }> {
    const { data, error } = await supabase
      .from("member_invites")
      .select("sms_status, circle_name, joined_at")
      .eq("store_id", storeId);
    if (error) throw error;

    const invites = data ?? [];
    const total = invites.length;
    const pending = invites.filter(i => i.sms_status === "pending").length;
    const sent = invites.filter(i => i.sms_status === "sent").length;
    const delivered = invites.filter(i => i.sms_status === "delivered").length;
    const joined = invites.filter(i => i.joined_at !== null).length;
    const failed = invites.filter(i => i.sms_status === "failed").length;

    // Group by circle
    const circleMap = new Map<string, number>();
    invites.forEach(i => {
      const name = i.circle_name || "Unassigned";
      circleMap.set(name, (circleMap.get(name) ?? 0) + 1);
    });
    const circles = Array.from(circleMap.entries()).map(([name, count]) => ({ name, count }));

    return {
      total,
      pending,
      sent,
      delivered,
      joined,
      failed,
      conversionRate: total > 0 ? Math.round((joined / total) * 100) : 0,
      circles,
    };
  }

  /** Mark invites as SMS sent (called after Twilio sends) */
  static async markInvitesSent(inviteIds: string[], messageSids?: Record<string, string>): Promise<void> {
    for (const id of inviteIds) {
      await supabase
        .from("member_invites")
        .update({
          sms_status: "sent",
          sms_sent_at: new Date().toISOString(),
          sms_message_sid: messageSids?.[id] || null,
        })
        .eq("id", id);
    }
  }

  /** Mark invite as joined (when member creates account via token) */
  static async markInviteJoined(token: string, userId: string): Promise<MemberInvite | null> {
    const { data, error } = await supabase
      .from("member_invites")
      .update({
        joined_at: new Date().toISOString(),
        joined_user_id: userId,
      })
      .eq("token", token)
      .select()
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapInvite(data) : null;
  }

  /** Generate SMS text for an invite */
  static generateSmsText(invite: MemberInvite, storeName: string, ownerName: string, language: SmsLanguage = "fr"): string {
    const link = invite.inviteLink;
    if (language === "en") {
      return `Hi ${invite.firstName}! ${ownerName} invites you to join TandaXn — your tontine circle is waiting. Set up in 2 min: ${link}`;
    }
    if (language === "both") {
      return `Bonjour ${invite.firstName}! ${ownerName} vous invite sur TandaXn. / Hi ${invite.firstName}! Join your tontine circle: ${link}`;
    }
    // French (default)
    return `Bonjour ${invite.firstName} ! ${ownerName} vous invite à rejoindre TandaXn — votre cercle de tontine vous attend. Inscrivez-vous en 2 min : ${link}`;
  }

  /** Get CSV uploads for a store */
  static async getCsvUploads(storeId: string): Promise<CsvUpload[]> {
    const { data, error } = await supabase
      .from("csv_uploads")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapCsvUpload);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E: REVIEWS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Add a review */
  static async addReview(reviewerId: string, storeId: string, rating: number, reviewText?: string): Promise<StoreReview> {
    // Check for verified purchase
    const { data: bookings } = await supabase
      .from("marketplace_bookings")
      .select("id")
      .eq("store_id", storeId)
      .eq("member_id", reviewerId)
      .eq("status", "completed")
      .limit(1);

    const { data, error } = await supabase
      .from("store_reviews")
      .insert({
        store_id: storeId,
        reviewer_id: reviewerId,
        rating,
        review_text: reviewText,
        is_verified_purchase: (bookings?.length ?? 0) > 0,
      })
      .select()
      .single();
    if (error) throw error;
    return mapReview(data);
  }

  /** Get reviews for a store */
  static async getStoreReviews(storeId: string): Promise<StoreReview[]> {
    const { data, error } = await supabase
      .from("store_reviews")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReview);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION F: MARKET INSIGHTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get market insight for a city + category */
  static async getMarketInsight(city: string, category: StoreCategory): Promise<MarketInsight | null> {
    const { data, error } = await supabase
      .from("market_insights")
      .select("*")
      .eq("city", city)
      .eq("category", category)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapInsight(data) : null;
  }

  /** Get all insights for a city */
  static async getCityInsights(city: string): Promise<MarketInsight[]> {
    const { data, error } = await supabase
      .from("market_insights")
      .select("*")
      .eq("city", city);
    if (error) throw error;
    return (data ?? []).map(mapInsight);
  }

  /** Calculate revenue estimate */
  static calculateRevenueEstimate(
    customersPerMonth: number,
    avgOrderValueCents: number,
    repeatVisitRate: number
  ): RevenueEstimate {
    const monthlyOrders = Math.round(customersPerMonth * repeatVisitRate);
    const monthlyRevenueCents = monthlyOrders * avgOrderValueCents;
    return {
      customersPerMonth,
      avgOrderValueCents,
      repeatVisitRate,
      monthlyRevenueCents,
      annualRevenueCents: monthlyRevenueCents * 12,
      monthlyOrders,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION G: INQUIRIES & REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Send an inquiry to a store */
  static async sendInquiry(userId: string, storeId: string, message: string): Promise<StoreInquiry> {
    const { data, error } = await supabase
      .from("store_inquiries")
      .insert({
        store_id: storeId,
        user_id: userId,
        message,
      })
      .select()
      .single();
    if (error) throw error;
    return mapInquiry(data);
  }

  /** Reply to an inquiry (store owner) */
  static async replyToInquiry(inquiryId: string, reply: string): Promise<StoreInquiry> {
    const { data, error } = await supabase
      .from("store_inquiries")
      .update({
        reply,
        status: "replied",
        replied_at: new Date().toISOString(),
      })
      .eq("id", inquiryId)
      .select()
      .single();
    if (error) throw error;
    return mapInquiry(data);
  }

  /** Get store inquiries */
  static async getStoreInquiries(storeId: string): Promise<StoreInquiry[]> {
    const { data, error } = await supabase
      .from("store_inquiries")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInquiry);
  }

  /** Request a provider in a category/city */
  static async requestProvider(userId: string, category: StoreCategory, city: string, description?: string): Promise<ProviderRequest> {
    const { data, error } = await supabase
      .from("provider_requests")
      .insert({
        user_id: userId,
        category,
        city,
        description,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      userId: data.user_id,
      category: data.category,
      city: data.city,
      description: data.description,
      isSignalSent: data.is_signal_sent,
      createdAt: data.created_at,
    };
  }

  /** Check if a category/city has enough requests to trigger recruitment */
  static async checkRequestThreshold(category: StoreCategory, city: string): Promise<{
    count: number;
    thresholdMet: boolean;
  }> {
    const { count, error } = await supabase
      .from("provider_requests")
      .select("*", { count: "exact", head: true })
      .eq("category", category)
      .eq("city", city);
    if (error) throw error;
    return {
      count: count ?? 0,
      thresholdMet: (count ?? 0) >= 5,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION H: OWNER DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get owner dashboard data */
  static async getOwnerDashboard(storeId: string): Promise<{
    store: MarketplaceStore;
    services: StoreService[];
    inviteStats: Awaited<ReturnType<typeof MarketplaceEngine.getInviteStats>>;
    recentBookings: Booking[];
    recentReviews: StoreReview[];
    recentInquiries: StoreInquiry[];
    monthlyBookings: number;
    monthlyRevenueCents: number;
  }> {
    const [store, services, inviteStats, bookings, reviews, inquiries] = await Promise.all([
      this.getStore(storeId),
      this.getStoreServices(storeId),
      this.getInviteStats(storeId),
      this.getStoreBookings(storeId),
      this.getStoreReviews(storeId),
      this.getStoreInquiries(storeId),
    ]);

    if (!store) throw new Error("Store not found");

    // Calculate this month's stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlyBookingsFiltered = bookings.filter(b => b.createdAt >= startOfMonth);
    const monthlyRevenueCents = monthlyBookingsFiltered
      .filter(b => b.status === "completed")
      .reduce((sum, b) => sum + b.finalAmountCents, 0);

    return {
      store,
      services,
      inviteStats,
      recentBookings: bookings.slice(0, 10),
      recentReviews: reviews.slice(0, 5),
      recentInquiries: inquiries.slice(0, 5),
      monthlyBookings: monthlyBookingsFiltered.length,
      monthlyRevenueCents,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION I: REALTIME
  // ═══════════════════════════════════════════════════════════════════════════

  /** Subscribe to store bookings (owner) */
  static subscribeToBookings(storeId: string, callback: (booking: Booking) => void) {
    return supabase
      .channel(`store_bookings_${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_bookings", filter: `store_id=eq.${storeId}` },
        (payload) => callback(mapBooking(payload.new))
      )
      .subscribe();
  }

  /** Subscribe to invite conversions */
  static subscribeToInvites(storeId: string, callback: (invite: MemberInvite) => void) {
    return supabase
      .channel(`store_invites_${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_invites", filter: `store_id=eq.${storeId}` },
        (payload) => callback(mapInvite(payload.new))
      )
      .subscribe();
  }

  /** Subscribe to store updates */
  static subscribeToStore(storeId: string, callback: (store: MarketplaceStore) => void) {
    return supabase
      .channel(`store_${storeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketplace_stores", filter: `id=eq.${storeId}` },
        (payload) => callback(mapStore(payload.new))
      )
      .subscribe();
  }
}
