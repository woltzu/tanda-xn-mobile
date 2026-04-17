// ══════════════════════════════════════════════════════════════════════════════
// TripOrganizerEngine — Trip Organizer feature business logic
// Trip CRUD, itinerary, participants, documents, payments, vendors, messaging
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type TripStatus = 'draft' | 'published' | 'closed' | 'cancelled';
export type PaymentType = 'lump_sum' | 'installments';
export type ParticipantStatus = 'pending' | 'confirmed' | 'waitlist' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'partial' | 'paid_in_full';
export type TripPaymentType = 'deposit' | 'installment' | 'full' | 'refund';
export type TripPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type MessagingMode = 'organizer_only' | 'group';
export type RefundPolicy = 'none' | 'partial' | 'full';
export type CategoryTag = 'Arrival' | 'Breakfast' | 'Beach' | 'Adventure' | 'Culture' | 'Sailing' | 'Dinner' | 'Nightlife' | 'Logistics' | 'Departure' | 'Accommodation' | 'Other';
export type VendorType = 'hotel' | 'transport' | 'airline' | 'activity' | 'other';
export type RecipientType = 'all' | 'individual' | 'organizer_only';

export interface Trip {
  id: string;
  organizerId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  coverPhotoUrl: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  priceCents: number;
  depositCents: number;
  paymentType: PaymentType;
  installmentCount: number | null;
  currency: string;
  status: TripStatus;
  slug: string | null;
  messagingMode: MessagingMode;
  refundPolicy: RefundPolicy;
  whatsIncluded: string | null;
  whatsExcluded: string | null;
  registrationDeadline: string | null;
  requiredDocuments: { fieldKey: string; fieldType: string; label: string }[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  date: string;
  title: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripActivity {
  id: string;
  dayId: string;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  categoryTag: CategoryTag;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripParticipant {
  id: string;
  tripId: string;
  userId: string;
  status: ParticipantStatus;
  paymentStatus: PaymentStatus;
  totalPaidCents: number;
  cancellationReason: string | null;
  joinedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripSubmission {
  id: string;
  participantId: string;
  fieldKey: string;
  fieldType: string;
  textValue: string | null;
  fileUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripPayment {
  id: string;
  participantId: string;
  tripId: string;
  amountCents: number;
  type: TripPaymentType;
  status: TripPaymentStatus;
  reference: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface TripVendor {
  id: string;
  tripId: string;
  name: string;
  vendorType: VendorType;
  contactEmail: string | null;
  contactPhone: string | null;
  costCents: number;
  notes: string | null;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripMessage {
  id: string;
  tripId: string;
  senderId: string;
  recipientId: string | null;
  recipientType: RecipientType;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface TripDashboard {
  trip: Trip;
  participants: TripParticipant[];
  stats: {
    totalParticipants: number;
    confirmed: number;
    pending: number;
    waitlist: number;
    cancelled: number;
  };
  paymentSummary: {
    totalExpected: number;
    totalCollected: number;
    outstanding: number;
  };
}

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapTrip(row: any): Trip {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    name: row.trip_name ?? row.name,
    tagline: row.tagline ?? null,
    description: row.description,
    coverPhotoUrl: row.cover_image_url ?? row.cover_photo_url,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    maxParticipants: row.max_participants ?? 20,
    priceCents: parseFloat(row.price_per_person) || 0,
    depositCents: parseFloat(row.deposit_amount) || 0,
    paymentType: row.payment_type ?? 'lump_sum',
    installmentCount: null,
    currency: 'USD',
    status: row.status ?? 'draft',
    slug: row.slug ?? row.shareable_slug,
    messagingMode: row.messaging_mode ?? 'organizer_only',
    refundPolicy: row.refund_policy ?? 'none',
    whatsIncluded: row.whats_included ?? null,
    whatsExcluded: row.whats_excluded ?? null,
    registrationDeadline: row.registration_deadline ?? null,
    requiredDocuments: row.trip_requirements ?? row.required_documents ?? [],
    publishedAt: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDay(row: any): TripDay {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayNumber: row.day_number,
    date: row.date ?? '',
    title: row.day_title ?? row.title ?? '',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row: any): TripActivity {
  return {
    id: row.id,
    dayId: row.trip_day_id ?? row.day_id,
    title: row.activity_name ?? row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location_name ?? row.location,
    categoryTag: row.category_tag ?? 'Other',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParticipant(row: any): TripParticipant {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    status: row.status ?? 'pending',
    paymentStatus: row.payment_status ?? 'unpaid',
    totalPaidCents: parseFloat(row.total_paid) || 0,
    cancellationReason: row.cancellation_reason,
    joinedAt: row.registered_at ?? row.joined_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.registered_at ?? row.created_at,
    updatedAt: row.updated_at ?? row.registered_at,
  };
}

function mapSubmission(row: any): TripSubmission {
  return {
    id: row.id,
    participantId: row.trip_participant_id ?? row.participant_id,
    fieldKey: row.field_key,
    fieldType: row.field_type,
    textValue: row.text_value,
    fileUrl: row.file_url,
    verified: row.verified_by_organizer ?? row.verified ?? false,
    verifiedAt: row.verified_at,
    createdAt: row.submitted_at ?? row.created_at,
    updatedAt: row.updated_at ?? row.submitted_at,
  };
}

function mapPayment(row: any): TripPayment {
  return {
    id: row.id,
    participantId: row.participant_id,
    tripId: row.trip_id,
    amountCents: row.amount_cents,
    type: row.type,
    status: row.status ?? 'pending',
    reference: row.reference,
    note: row.note,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapVendor(row: any): TripVendor {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.vendor_name ?? row.name,
    vendorType: row.vendor_type ?? 'other',
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    costCents: parseFloat(row.amount_paid) || 0,
    notes: row.notes,
    isPaid: (parseFloat(row.amount_paid) || 0) > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): TripMessage {
  return {
    id: row.id,
    tripId: row.trip_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    recipientType: row.recipient_type ?? 'all',
    body: row.message_body ?? row.body,
    readAt: row.read_at,
    createdAt: row.sent_at ?? row.created_at,
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Convert a trip name to a URL-safe slug with a random 6-char suffix */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TRIP ORGANIZER ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class TripOrganizerEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 1: TRIP CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a new trip in draft status */
  static async createTrip(data: Partial<Trip>): Promise<Trip> {
    // Get current user if organizerId not provided
    let organizerId = data.organizerId;
    if (!organizerId) {
      const { data: { user } } = await supabase.auth.getUser();
      organizerId = user?.id;
    }
    if (!organizerId) throw new Error('No authenticated user found. Please log in.');

    const { data: row, error } = await supabase
      .from("trips")
      .insert({
        organizer_id: organizerId,
        trip_name: data.name,
        tagline: data.tagline ?? null,
        description: data.description,
        cover_image_url: data.coverPhotoUrl,
        destination: data.destination,
        start_date: data.startDate,
        end_date: data.endDate,
        max_participants: data.maxParticipants ?? 20,
        price_per_person: data.priceCents ?? 0,
        deposit_required: (data.depositCents ?? 0) > 0,
        deposit_amount: data.depositCents ?? 0,
        payment_type: data.paymentType ?? 'lump_sum',
        status: 'draft',
        messaging_mode: data.messagingMode ?? 'organizer_only',
        refund_policy: data.refundPolicy ?? 'none',
        whats_included: data.whatsIncluded ?? null,
        whats_excluded: data.whatsExcluded ?? null,
        registration_deadline: data.registrationDeadline ?? null,
        trip_requirements: data.requiredDocuments ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create trip: ${error.message}`);
    return mapTrip(row);
  }

  /** Update a trip. Validates locked fields if the trip is published. */
  static async updateTrip(tripId: string, data: Partial<Trip>): Promise<Trip> {
    // Fetch current trip to check status
    const { data: existing, error: fetchError } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();
    if (fetchError) throw new Error(`Failed to fetch trip: ${fetchError.message}`);

    // On a published trip, pricing / payment fields are locked (DB rules
    // reject changes to them and participants already signed up on a given
    // price shouldn't have that pulled out from under them). Silently strip
    // those fields from the payload instead of throwing — the edit wizard
    // sends the full hydrated form state, so we don't want every published
    // edit to fail just because the price input wasn't cleared.
    const isPublished = existing.status === 'published';
    if (isPublished) {
      const locked: (keyof Trip)[] = ['priceCents', 'depositCents', 'paymentType'];
      for (const field of locked) {
        if (data[field] !== undefined) {
          console.warn(
            `[TripOrganizerEngine.updateTrip] Skipping locked field '${String(field)}' on published trip ${tripId}`
          );
        }
      }
    }

    const update: any = {};
    if (data.name !== undefined) update.trip_name = data.name;
    if (data.tagline !== undefined) update.tagline = data.tagline;
    if (data.description !== undefined) update.description = data.description;
    if (data.coverPhotoUrl !== undefined) update.cover_image_url = data.coverPhotoUrl;
    if (data.destination !== undefined) update.destination = data.destination;
    if (data.startDate !== undefined) update.start_date = data.startDate;
    if (data.endDate !== undefined) update.end_date = data.endDate;
    if (data.maxParticipants !== undefined) update.max_participants = data.maxParticipants;
    // Pricing fields: only included when trip is NOT published
    if (!isPublished && data.priceCents !== undefined) {
      update.price_per_person = data.priceCents;
    }
    if (!isPublished && data.depositCents !== undefined) {
      update.deposit_amount = data.depositCents;
      update.deposit_required = data.depositCents > 0;
    }
    if (!isPublished && data.paymentType !== undefined) {
      update.payment_type = data.paymentType;
    }
    if (data.messagingMode !== undefined) update.messaging_mode = data.messagingMode;
    if (data.refundPolicy !== undefined) update.refund_policy = data.refundPolicy;
    if (data.whatsIncluded !== undefined) update.whats_included = data.whatsIncluded;
    if (data.whatsExcluded !== undefined) update.whats_excluded = data.whatsExcluded;
    if (data.registrationDeadline !== undefined) update.registration_deadline = data.registrationDeadline;
    if (data.requiredDocuments !== undefined) update.trip_requirements = data.requiredDocuments;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("trips")
      .update(update)
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update trip: ${error.message}`);
    return mapTrip(row);
  }

  /** Publish a trip: sets status to published and generates a slug */
  static async publishTrip(tripId: string): Promise<Trip> {
    // Fetch trip name to generate slug
    const { data: existing, error: fetchError } = await supabase
      .from("trips")
      .select("trip_name, status")
      .eq("id", tripId)
      .single();
    if (fetchError) throw new Error(`Failed to fetch trip: ${fetchError.message}`);
    if (existing.status !== 'draft') {
      throw new Error(`Only draft trips can be published. Current status: ${existing.status}`);
    }

    const slug = generateSlug(existing.trip_name);

    const { data: row, error } = await supabase
      .from("trips")
      .update({
        status: 'published',
        slug,
        shareable_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw new Error(`Failed to publish trip: ${error.message}`);
    return mapTrip(row);
  }

  /** Cancel a trip */
  static async cancelTrip(tripId: string): Promise<void> {
    const { error } = await supabase
      .from("trips")
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);
    if (error) throw new Error(`Failed to cancel trip: ${error.message}`);
  }

  /** Get all trips for an organizer, ordered by creation date desc */
  static async getOrganizerTrips(userId: string): Promise<Trip[]> {
    const { data: rows, error } = await supabase
      .from("trips")
      .select("*")
      .eq("organizer_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to fetch organizer trips: ${error.message}`);
    return (rows ?? []).map(mapTrip);
  }

  /** Get full trip dashboard with participants stats and payment summary */
  static async getTripDashboard(tripId: string): Promise<TripDashboard> {
    // Fetch trip
    const { data: tripRow, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();
    if (tripError) throw new Error(`Failed to fetch trip: ${tripError.message}`);

    // Fetch participants
    const { data: participantRows, error: partError } = await supabase
      .from("trip_participants")
      .select("*")
      .eq("trip_id", tripId);
    if (partError) throw new Error(`Failed to fetch participants: ${partError.message}`);

    const participants = (participantRows ?? []).map(mapParticipant);
    const trip = mapTrip(tripRow);

    const stats = {
      totalParticipants: participants.length,
      confirmed: participants.filter(p => p.status === 'confirmed').length,
      pending: participants.filter(p => p.status === 'pending').length,
      waitlist: participants.filter(p => p.status === 'waitlist').length,
      cancelled: participants.filter(p => p.status === 'cancelled').length,
    };

    // Fetch payment totals (trip_payments joins through trip_participants)
    const participantIds = participants.map(p => p.id);
    let totalCollected = 0;

    if (participantIds.length > 0) {
      const { data: paymentRows, error: payError } = await supabase
        .from("trip_payments")
        .select("amount, status")
        .in("trip_participant_id", participantIds);
      if (!payError && paymentRows) {
        totalCollected = paymentRows
          .filter(p => p.status === 'succeeded')
          .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
      }
    }

    const activeParticipants = participants.filter(p => p.status !== 'cancelled').length;
    const totalExpected = activeParticipants * trip.priceCents;

    return {
      trip,
      participants,
      stats,
      paymentSummary: {
        totalExpected,
        totalCollected,
        outstanding: totalExpected - totalCollected,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 2: ITINERARY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Add a day to a trip itinerary */
  static async addDay(tripId: string, data: Partial<TripDay>): Promise<TripDay> {
    const { data: row, error } = await supabase
      .from("trip_days")
      .insert({
        trip_id: tripId,
        day_number: data.dayNumber,
        day_title: data.title || `Day ${data.dayNumber}`,
        sort_order: data.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to add day: ${error.message}`);
    return mapDay(row);
  }

  /** Update a trip day */
  static async updateDay(dayId: string, data: Partial<TripDay>): Promise<TripDay> {
    const update: any = {};
    if (data.dayNumber !== undefined) update.day_number = data.dayNumber;
    if (data.title !== undefined) update.day_title = data.title;
    if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("trip_days")
      .update(update)
      .eq("id", dayId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update day: ${error.message}`);
    return mapDay(row);
  }

  /** Delete a trip day */
  static async deleteDay(dayId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_days")
      .delete()
      .eq("id", dayId);
    if (error) throw new Error(`Failed to delete day: ${error.message}`);
  }

  /** Reorder days within a trip */
  static async reorderDays(
    tripId: string,
    order: { dayId: string; sortOrder: number }[]
  ): Promise<void> {
    // Update each day's sort_order individually
    for (const item of order) {
      const { error } = await supabase
        .from("trip_days")
        .update({ sort_order: item.sortOrder, updated_at: new Date().toISOString() })
        .eq("id", item.dayId)
        .eq("trip_id", tripId);
      if (error) throw new Error(`Failed to reorder day ${item.dayId}: ${error.message}`);
    }
  }

  /** Add an activity to a trip day */
  static async addActivity(dayId: string, data: Partial<TripActivity>): Promise<TripActivity> {
    const { data: row, error } = await supabase
      .from("trip_activities")
      .insert({
        trip_day_id: dayId,
        activity_name: data.title,
        description: data.description,
        start_time: data.startTime,
        end_time: data.endTime,
        location_name: data.location,
        category_tag: data.categoryTag ?? 'Other',
        sort_order: data.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to add activity: ${error.message}`);
    return mapActivity(row);
  }

  /** Update a trip activity */
  static async updateActivity(activityId: string, data: Partial<TripActivity>): Promise<TripActivity> {
    const update: any = {};
    if (data.title !== undefined) update.activity_name = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.startTime !== undefined) update.start_time = data.startTime;
    if (data.endTime !== undefined) update.end_time = data.endTime;
    if (data.location !== undefined) update.location_name = data.location;
    if (data.categoryTag !== undefined) update.category_tag = data.categoryTag;
    if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("trip_activities")
      .update(update)
      .eq("id", activityId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update activity: ${error.message}`);
    return mapActivity(row);
  }

  /** Delete a trip activity */
  static async deleteActivity(activityId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_activities")
      .delete()
      .eq("id", activityId);
    if (error) throw new Error(`Failed to delete activity: ${error.message}`);
  }

  /** Get full trip itinerary: days with nested activities */
  static async getTripItinerary(tripId: string): Promise<(TripDay & { activities: TripActivity[] })[]> {
    const { data: dayRows, error: dayError } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true });
    if (dayError) throw new Error(`Failed to fetch itinerary days: ${dayError.message}`);

    const days = (dayRows ?? []).map(mapDay);

    if (days.length === 0) return [];

    const dayIds = days.map(d => d.id);
    const { data: activityRows, error: actError } = await supabase
      .from("trip_activities")
      .select("*")
      .in("trip_day_id", dayIds)
      .order("sort_order", { ascending: true });
    if (actError) throw new Error(`Failed to fetch itinerary activities: ${actError.message}`);

    const activities = (activityRows ?? []).map(mapActivity);

    // Group activities by day
    const activityMap = new Map<string, TripActivity[]>();
    for (const act of activities) {
      const list = activityMap.get(act.dayId) ?? [];
      list.push(act);
      activityMap.set(act.dayId, list);
    }

    return days.map(day => ({
      ...day,
      activities: activityMap.get(day.id) ?? [],
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 3: PARTICIPANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Register a user for a trip */
  static async registerForTrip(tripId: string, userId: string): Promise<TripParticipant> {
    // Check trip exists and is published
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("status, max_participants")
      .eq("id", tripId)
      .single();
    if (tripError) throw new Error(`Failed to fetch trip: ${tripError.message}`);
    if (trip.status !== 'published') {
      throw new Error(`Cannot register for a trip with status: ${trip.status}`);
    }

    // Check current confirmed/pending participant count
    const { count, error: countError } = await supabase
      .from("trip_participants")
      .select("id", { count: 'exact', head: true })
      .eq("trip_id", tripId)
      .in("status", ['pending', 'confirmed']);
    if (countError) throw new Error(`Failed to count participants: ${countError.message}`);

    const participantStatus: ParticipantStatus =
      (count ?? 0) >= trip.max_participants ? 'waitlist' : 'pending';

    const { data: row, error } = await supabase
      .from("trip_participants")
      .insert({
        trip_id: tripId,
        user_id: userId,
        status: participantStatus,
        payment_status: 'unpaid',
        total_paid: 0,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to register for trip: ${error.message}`);
    return mapParticipant(row);
  }

  /** Confirm a participant */
  static async confirmParticipant(participantId: string): Promise<TripParticipant> {
    const { data: row, error } = await supabase
      .from("trip_participants")
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", participantId)
      .select()
      .single();
    if (error) throw new Error(`Failed to confirm participant: ${error.message}`);
    return mapParticipant(row);
  }

  /** Cancel a participant with optional reason */
  static async cancelParticipant(participantId: string, reason?: string): Promise<TripParticipant> {
    const { data: row, error } = await supabase
      .from("trip_participants")
      .update({
        status: 'cancelled',
        cancellation_reason: reason ?? null,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", participantId)
      .select()
      .single();
    if (error) throw new Error(`Failed to cancel participant: ${error.message}`);
    return mapParticipant(row);
  }

  /** Get participants for a trip, optionally filtered by status */
  static async getParticipants(tripId: string, status?: ParticipantStatus): Promise<TripParticipant[]> {
    let query = supabase
      .from("trip_participants")
      .select("*")
      .eq("trip_id", tripId);
    if (status) {
      query = query.eq("status", status);
    }
    const { data: rows, error } = await query.order("joined_at", { ascending: true });
    if (error) throw new Error(`Failed to fetch participants: ${error.message}`);
    return (rows ?? []).map(mapParticipant);
  }

  /** Get participant detail with submissions and payments */
  static async getParticipantDetail(
    participantId: string
  ): Promise<TripParticipant & { submissions: TripSubmission[]; payments: TripPayment[] }> {
    const { data: row, error } = await supabase
      .from("trip_participants")
      .select("*")
      .eq("id", participantId)
      .single();
    if (error) throw new Error(`Failed to fetch participant: ${error.message}`);

    const participant = mapParticipant(row);

    // Fetch submissions
    const { data: subRows, error: subError } = await supabase
      .from("trip_participant_submissions")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: true });
    if (subError) throw new Error(`Failed to fetch submissions: ${subError.message}`);

    // Fetch payments
    const { data: payRows, error: payError } = await supabase
      .from("trip_payments")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    if (payError) throw new Error(`Failed to fetch payments: ${payError.message}`);

    return {
      ...participant,
      submissions: (subRows ?? []).map(mapSubmission),
      payments: (payRows ?? []).map(mapPayment),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 4: DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Submit a document for a participant */
  static async submitDocument(
    participantId: string,
    fieldKey: string,
    fieldType: string,
    data: { text_value?: string; file_url?: string }
  ): Promise<TripSubmission> {
    // Upsert: if a submission for this participant + fieldKey already exists, update it
    const { data: existing } = await supabase
      .from("trip_participant_submissions")
      .select("id")
      .eq("participant_id", participantId)
      .eq("field_key", fieldKey)
      .maybeSingle();

    if (existing) {
      const { data: row, error } = await supabase
        .from("trip_participant_submissions")
        .update({
          field_type: fieldType,
          text_value: data.text_value ?? null,
          file_url: data.file_url ?? null,
          verified: false,
          verified_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update submission: ${error.message}`);
      return mapSubmission(row);
    }

    const { data: row, error } = await supabase
      .from("trip_participant_submissions")
      .insert({
        participant_id: participantId,
        field_key: fieldKey,
        field_type: fieldType,
        text_value: data.text_value ?? null,
        file_url: data.file_url ?? null,
        verified: false,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to submit document: ${error.message}`);
    return mapSubmission(row);
  }

  /** Get all submissions for a participant */
  static async getMySubmissions(participantId: string): Promise<TripSubmission[]> {
    const { data: rows, error } = await supabase
      .from("trip_participant_submissions")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
    return (rows ?? []).map(mapSubmission);
  }

  /** Mark a submission as verified */
  static async verifySubmission(submissionId: string): Promise<TripSubmission> {
    const { data: row, error } = await supabase
      .from("trip_participant_submissions")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select()
      .single();
    if (error) throw new Error(`Failed to verify submission: ${error.message}`);
    return mapSubmission(row);
  }

  /** Check if all required documents are submitted for a participant */
  static async checkDocumentsComplete(participantId: string, tripId: string): Promise<boolean> {
    // Get trip required documents
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("required_documents")
      .eq("id", tripId)
      .single();
    if (tripError) throw new Error(`Failed to fetch trip: ${tripError.message}`);

    const requiredDocs: { fieldKey: string }[] = trip.required_documents ?? [];
    if (requiredDocs.length === 0) return true;

    // Get participant submissions
    const { data: submissions, error: subError } = await supabase
      .from("trip_participant_submissions")
      .select("field_key")
      .eq("participant_id", participantId);
    if (subError) throw new Error(`Failed to fetch submissions: ${subError.message}`);

    const submittedKeys = new Set((submissions ?? []).map((s: any) => s.field_key));
    return requiredDocs.every(doc => submittedKeys.has(doc.fieldKey));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 5: PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Record a payment for a participant */
  static async recordPayment(participantId: string, data: Partial<TripPayment>): Promise<TripPayment> {
    const { data: row, error } = await supabase
      .from("trip_payments")
      .insert({
        trip_participant_id: participantId,
        amount: data.amountCents ?? 0,
        payment_type: data.type ?? 'full',
        status: data.status ?? 'pending',
        paid_at: data.paidAt ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to record payment: ${error.message}`);

    // Update participant total_paid if payment succeeded
    if ((data.status ?? 'pending') === 'succeeded') {
      const { data: participant, error: partError } = await supabase
        .from("trip_participants")
        .select("total_paid, trip_id")
        .eq("id", participantId)
        .single();
      if (!partError && participant) {
        const newTotal = (participant.total_paid ?? 0) + (data.amountCents ?? 0);

        // Determine new payment status
        const { data: trip } = await supabase
          .from("trips")
          .select("price_per_person, deposit_amount")
          .eq("id", participant.trip_id)
          .single();

        let paymentStatus: PaymentStatus = 'partial';
        if (trip) {
          const priceVal = parseFloat(trip.price_per_person) || 0;
          const depositVal = parseFloat(trip.deposit_amount) || 0;
          if (newTotal >= priceVal) {
            paymentStatus = 'paid_in_full';
          } else if (newTotal >= depositVal) {
            paymentStatus = 'deposit_paid';
          }
        }

        await supabase
          .from("trip_participants")
          .update({
            total_paid: newTotal,
            payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", participantId);
      }
    }

    return mapPayment(row);
  }

  /** Get payment history for a participant */
  static async getPaymentHistory(participantId: string): Promise<TripPayment[]> {
    const { data: rows, error } = await supabase
      .from("trip_payments")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to fetch payment history: ${error.message}`);
    return (rows ?? []).map(mapPayment);
  }

  /** Get payment summary for an entire trip */
  static async getTripPaymentSummary(
    tripId: string
  ): Promise<{ totalExpected: number; totalCollected: number; outstanding: number }> {
    // Get trip price
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("price_per_person")
      .eq("id", tripId)
      .single();
    if (tripError) throw new Error(`Failed to fetch trip: ${tripError.message}`);

    const priceVal = parseFloat(trip?.price_per_person) || 0;

    // Count active participants
    const { count, error: countError } = await supabase
      .from("trip_participants")
      .select("id", { count: 'exact', head: true })
      .eq("trip_id", tripId)
      .in("status", ['pending', 'confirmed']);
    if (countError) throw new Error(`Failed to count participants: ${countError.message}`);

    const totalExpected = (count ?? 0) * priceVal;

    // Sum succeeded payments (join through trip_participants)
    const { data: participantIds } = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", tripId);

    let totalCollected = 0;
    if (participantIds && participantIds.length > 0) {
      const pIds = participantIds.map((p: any) => p.id);
      const { data: payments, error: payError } = await supabase
        .from("trip_payments")
        .select("amount")
        .in("trip_participant_id", pIds)
        .eq("status", "succeeded");
      if (!payError && payments) {
        totalCollected = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
      }
    }

    return {
      totalExpected,
      totalCollected,
      outstanding: totalExpected - totalCollected,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 6: VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Add a vendor to a trip */
  static async addVendor(tripId: string, data: Partial<TripVendor>): Promise<TripVendor> {
    const { data: row, error } = await supabase
      .from("trip_vendors")
      .insert({
        trip_id: tripId,
        vendor_name: data.name,
        vendor_type: data.vendorType ?? 'other',
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone,
        amount_paid: data.costCents ?? 0,
        notes: data.notes,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to add vendor: ${error.message}`);
    return mapVendor(row);
  }

  /** Update a vendor */
  static async updateVendor(vendorId: string, data: Partial<TripVendor>): Promise<TripVendor> {
    const update: any = {};
    if (data.name !== undefined) update.vendor_name = data.name;
    if (data.vendorType !== undefined) update.vendor_type = data.vendorType;
    if (data.contactEmail !== undefined) update.contact_email = data.contactEmail;
    if (data.contactPhone !== undefined) update.contact_phone = data.contactPhone;
    if (data.costCents !== undefined) update.amount_paid = data.costCents;
    if (data.notes !== undefined) update.notes = data.notes;
    update.updated_at = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("trip_vendors")
      .update(update)
      .eq("id", vendorId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update vendor: ${error.message}`);
    return mapVendor(row);
  }

  /** Delete a vendor */
  static async deleteVendor(vendorId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_vendors")
      .delete()
      .eq("id", vendorId);
    if (error) throw new Error(`Failed to delete vendor: ${error.message}`);
  }

  /** Get all vendors for a trip */
  static async getTripVendors(tripId: string): Promise<TripVendor[]> {
    const { data: rows, error } = await supabase
      .from("trip_vendors")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Failed to fetch vendors: ${error.message}`);
    return (rows ?? []).map(mapVendor);
  }

  /** Get trip budget: collected revenue vs vendor costs vs margin */
  static async getTripBudget(
    tripId: string
  ): Promise<{ collected: number; vendorCosts: number; margin: number }> {
    // Sum succeeded payments
    const { data: payments, error: payError } = await supabase
      .from("trip_payments")
      .select("amount_cents")
      .eq("trip_id", tripId)
      .eq("status", "succeeded");
    if (payError) throw new Error(`Failed to fetch payments: ${payError.message}`);

    const collected = (payments ?? []).reduce((sum: number, p: any) => sum + (p.amount_cents ?? 0), 0);

    // Sum vendor costs
    const { data: vendors, error: vendorError } = await supabase
      .from("trip_vendors")
      .select("cost_cents")
      .eq("trip_id", tripId);
    if (vendorError) throw new Error(`Failed to fetch vendors: ${vendorError.message}`);

    const vendorCosts = (vendors ?? []).reduce((sum: number, v: any) => sum + (v.cost_cents ?? 0), 0);

    return {
      collected,
      vendorCosts,
      margin: collected - vendorCosts,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 7: MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Send a broadcast message to all trip participants */
  static async sendBroadcast(tripId: string, senderId: string, body: string): Promise<TripMessage> {
    const { data: row, error } = await supabase
      .from("trip_messages")
      .insert({
        trip_id: tripId,
        sender_id: senderId,
        recipient_id: null,
        recipient_type: 'all',
        message_body: body,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to send broadcast: ${error.message}`);
    return mapMessage(row);
  }

  /** Send a direct message to a specific participant */
  static async sendDirectMessage(
    tripId: string,
    senderId: string,
    recipientId: string,
    body: string
  ): Promise<TripMessage> {
    const { data: row, error } = await supabase
      .from("trip_messages")
      .insert({
        trip_id: tripId,
        sender_id: senderId,
        recipient_id: recipientId,
        recipient_type: 'individual',
        message_body: body,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to send direct message: ${error.message}`);
    return mapMessage(row);
  }

  /** Get messages for a trip, optionally filtered by recipient type */
  static async getTripMessages(tripId: string, type?: RecipientType): Promise<TripMessage[]> {
    let query = supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", tripId);
    if (type) {
      query = query.eq("recipient_type", type);
    }
    const { data: rows, error } = await query.order("sent_at", { ascending: true });
    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return (rows ?? []).map(mapMessage);
  }

  /** Mark a message as read */
  static async markMessageRead(messageId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) throw new Error(`Failed to mark message read: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 8: PUBLIC
  // ═══════════════════════════════════════════════════════════════════════════

  /** Shared helper — fetches days + activities + spots remaining for a given trip */
  private static async hydratePublicTrip(
    trip: Trip
  ): Promise<Trip & { days: (TripDay & { activities: TripActivity[] })[]; spotsRemaining: number }> {
    // Fetch days
    const { data: dayRows, error: dayError } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true });
    if (dayError) throw new Error(`Failed to fetch days: ${dayError.message}`);

    const days = (dayRows ?? []).map(mapDay);

    // Fetch activities for all days
    const dayIds = days.map(d => d.id);
    const activitiesByDay: Record<string, TripActivity[]> = {};
    if (dayIds.length > 0) {
      const { data: actRows, error: actError } = await supabase
        .from("trip_activities")
        .select("*")
        .in("trip_day_id", dayIds)
        .order("sort_order", { ascending: true });
      if (!actError && actRows) {
        for (const row of actRows) {
          const act = mapActivity(row);
          const did = row.trip_day_id;
          if (!activitiesByDay[did]) activitiesByDay[did] = [];
          activitiesByDay[did].push(act);
        }
      }
    }

    const daysWithActivities = days.map(d => ({
      ...d,
      activities: activitiesByDay[d.id] ?? [],
    }));

    // Count active participants
    const { count } = await supabase
      .from("trip_participants")
      .select("id", { count: 'exact', head: true })
      .eq("trip_id", trip.id)
      .in("status", ['pending', 'confirmed']);

    const spotsRemaining = Math.max(0, trip.maxParticipants - (count ?? 0));

    return {
      ...trip,
      days: daysWithActivities,
      spotsRemaining,
    };
  }

  /** Get a trip by its ID for preview (organizer-only, works for draft trips) */
  static async getPublicTripById(
    tripId: string
  ): Promise<(Trip & { days: (TripDay & { activities: TripActivity[] })[]; spotsRemaining: number }) | null> {
    if (!tripId || tripId === 'new') return null;

    const { data: tripRow, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();
    if (tripError) throw new Error(`Trip not found: ${tripError.message}`);
    if (!tripRow) return null;

    const trip = mapTrip(tripRow);
    return this.hydratePublicTrip(trip);
  }

  /** Get a public trip by its slug, including itinerary days and spots remaining */
  static async getPublicTrip(
    slug: string
  ): Promise<(Trip & { days: TripDay[]; spotsRemaining: number }) | null> {
    if (!slug || slug === 'undefined') return null;

    const { data: tripRow, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (tripError) throw new Error(`Trip not found: ${tripError.message}`);
    if (!tripRow) return null;

    const trip = mapTrip(tripRow);

    // Fetch days
    const { data: dayRows, error: dayError } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true });
    if (dayError) throw new Error(`Failed to fetch days: ${dayError.message}`);

    const days = (dayRows ?? []).map(mapDay);

    // Fetch activities for all days
    const dayIds = days.map(d => d.id);
    let activitiesByDay: Record<string, TripActivity[]> = {};
    if (dayIds.length > 0) {
      const { data: actRows, error: actError } = await supabase
        .from("trip_activities")
        .select("*")
        .in("trip_day_id", dayIds)
        .order("sort_order", { ascending: true });
      if (!actError && actRows) {
        for (const row of actRows) {
          const act = mapActivity(row);
          const did = row.trip_day_id;
          if (!activitiesByDay[did]) activitiesByDay[did] = [];
          activitiesByDay[did].push(act);
        }
      }
    }

    // Attach activities to each day
    const daysWithActivities = days.map(d => ({
      ...d,
      activities: activitiesByDay[d.id] ?? [],
    }));

    // Count active participants
    const { count, error: countError } = await supabase
      .from("trip_participants")
      .select("id", { count: 'exact', head: true })
      .eq("trip_id", trip.id)
      .in("status", ['pending', 'confirmed']);
    if (countError) throw new Error(`Failed to count participants: ${countError.message}`);

    const spotsRemaining = Math.max(0, trip.maxParticipants - (count ?? 0));

    return {
      ...trip,
      days: daysWithActivities,
      spotsRemaining,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 9: REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Subscribe to participant changes for a trip */
  static subscribeToParticipants(tripId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`trip-participants-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_participants',
          filter: `trip_id=eq.${tripId}`,
        },
        callback
      )
      .subscribe();
  }

  /** Subscribe to new messages for a trip */
  static subscribeToMessages(tripId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`trip-messages-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        callback
      )
      .subscribe();
  }

  /** Subscribe to payment changes for a participant */
  static subscribeToPayments(participantId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`trip-payments-${participantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_payments',
          filter: `trip_participant_id=eq.${participantId}`,
        },
        callback
      )
      .subscribe();
  }
}
