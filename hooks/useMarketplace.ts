// ══════════════════════════════════════════════════════════════════════════════
// Marketplace Hooks — React hooks for marketplace features
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  MarketplaceEngine,
  type MarketplaceStore,
  type StoreService,
  type StoreReview,
  type Booking,
  type MemberInvite,
  type CsvUpload,
  type MarketInsight,
  type StoreInquiry,
  type ProviderRequest,
  type StoreCategory,
  type StoreStatus,
  type StoreBadge,
  type PaymentType,
  type BookingStatus,
  type SmsStatus,
  type SmsLanguage,
  type CreateStoreParams,
  type CreateBookingParams,
  type CsvRow,
  type RevenueEstimate,
} from "../services/MarketplaceEngine";
import { useAuth } from "../context/AuthContext";

// Re-export types for consumer convenience
export type {
  MarketplaceStore,
  StoreService,
  StoreReview,
  Booking,
  MemberInvite,
  CsvUpload,
  MarketInsight,
  StoreInquiry,
  ProviderRequest,
  StoreCategory,
  StoreStatus,
  StoreBadge,
  PaymentType,
  BookingStatus,
  SmsStatus,
  SmsLanguage,
  CreateStoreParams,
  CreateBookingParams,
  CsvRow,
  RevenueEstimate,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useMarketplaceStores — Browse/search stores
// ═══════════════════════════════════════════════════════════════════════════════

export function useMarketplaceStores(filters?: {
  category?: StoreCategory;
  city?: string;
  search?: string;
  featuredOnly?: boolean;
}) {
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MarketplaceEngine.listStores(filters);
      setStores(data);
    } catch (err) {
      console.error("useMarketplaceStores error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters?.category, filters?.city, filters?.search, filters?.featuredOnly]);

  useEffect(() => { fetch(); }, [fetch]);

  // Computed
  const byCategory = stores.reduce((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {} as Record<StoreCategory, MarketplaceStore[]>);

  const featured = stores.filter(s => s.isFeatured);

  return { stores, byCategory, featured, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useStoreDetail — Single store with services & reviews
// ═══════════════════════════════════════════════════════════════════════════════

export function useStoreDetail(storeId?: string) {
  const [store, setStore] = useState<MarketplaceStore | null>(null);
  const [services, setServices] = useState<StoreService[]>([]);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [storeData, servicesData, reviewsData] = await Promise.all([
        MarketplaceEngine.getStore(storeId),
        MarketplaceEngine.getStoreServices(storeId),
        MarketplaceEngine.getStoreReviews(storeId),
      ]);
      setStore(storeData);
      setServices(servicesData);
      setReviews(reviewsData);
      // Record view
      if (storeData) MarketplaceEngine.recordProfileView(storeId);
    } catch (err) {
      console.error("useStoreDetail error:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const sub = MarketplaceEngine.subscribeToStore(storeId, setStore);
    return () => { sub.unsubscribe(); };
  }, [storeId]);

  const popularServices = services.filter(s => s.isPopular);

  return { store, services, popularServices, reviews, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useMyStore — Current user's store (provider view)
// ═══════════════════════════════════════════════════════════════════════════════

export function useMyStore() {
  const { user } = useAuth();
  const [store, setStore] = useState<MarketplaceStore | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await MarketplaceEngine.getMyStore(user.id);
      setStore(data);
    } catch (err) {
      console.error("useMyStore error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const hasStore = store !== null;
  const isActive = store?.status === "active";

  return { store, hasStore, isActive, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. useBookings — Member's bookings + create booking
// ═══════════════════════════════════════════════════════════════════════════════

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await MarketplaceEngine.getMemberBookings(user.id);
      setBookings(data);
    } catch (err) {
      console.error("useBookings error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const createBooking = useCallback(async (params: CreateBookingParams) => {
    if (!user?.id) throw new Error("Not authenticated");
    const booking = await MarketplaceEngine.createBooking(user.id, params);
    setBookings(prev => [booking, ...prev]);
    return booking;
  }, [user?.id]);

  // Computed
  const pendingBookings = bookings.filter(b => b.status === "pending" || b.status === "confirmed");
  const payoutDayBookings = bookings.filter(b => b.paymentType === "payout_day" && b.status === "payment_due");
  const completedBookings = bookings.filter(b => b.status === "completed");

  return {
    bookings, pendingBookings, payoutDayBookings, completedBookings,
    loading, createBooking, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. useStoreBookings — Store owner's booking view
// ═══════════════════════════════════════════════════════════════════════════════

export function useStoreBookings(storeId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await MarketplaceEngine.getStoreBookings(storeId);
      setBookings(data);
    } catch (err) {
      console.error("useStoreBookings error:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const sub = MarketplaceEngine.subscribeToBookings(storeId, (booking) => {
      setBookings(prev => {
        const idx = prev.findIndex(b => b.id === booking.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = booking;
          return updated;
        }
        return [booking, ...prev];
      });
    });
    return () => { sub.unsubscribe(); };
  }, [storeId]);

  const updateStatus = useCallback(async (bookingId: string, status: BookingStatus) => {
    const updated = await MarketplaceEngine.updateBookingStatus(bookingId, status);
    setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
    return updated;
  }, []);

  return { bookings, loading, updateStatus, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. useMemberInvites — CSV upload + invite management
// ═══════════════════════════════════════════════════════════════════════════════

export function useMemberInvites(storeId?: string) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<MemberInvite[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof MarketplaceEngine.getInviteStats>> | null>(null);
  const [uploads, setUploads] = useState<CsvUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [invitesData, statsData, uploadsData] = await Promise.all([
        MarketplaceEngine.getStoreInvites(storeId),
        MarketplaceEngine.getInviteStats(storeId),
        MarketplaceEngine.getCsvUploads(storeId),
      ]);
      setInvites(invitesData);
      setStats(statsData);
      setUploads(uploadsData);
    } catch (err) {
      console.error("useMemberInvites error:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const sub = MarketplaceEngine.subscribeToInvites(storeId, (invite) => {
      setInvites(prev => {
        const idx = prev.findIndex(i => i.id === invite.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = invite;
          return updated;
        }
        return [invite, ...prev];
      });
    });
    return () => { sub.unsubscribe(); };
  }, [storeId]);

  const processCsv = useCallback(async (fileName: string, rows: CsvRow[]) => {
    if (!user?.id || !storeId) throw new Error("Not ready");
    setUploading(true);
    try {
      const upload = await MarketplaceEngine.processCsvUpload(user.id, storeId, fileName, rows);
      setUploads(prev => [upload, ...prev]);
      await fetch(); // Refresh invites
      return upload;
    } finally {
      setUploading(false);
    }
  }, [user?.id, storeId, fetch]);

  const markSent = useCallback(async (inviteIds: string[], messageSids?: Record<string, string>) => {
    await MarketplaceEngine.markInvitesSent(inviteIds, messageSids);
    await fetch();
  }, [fetch]);

  // Computed
  const pendingInvites = invites.filter(i => i.smsStatus === "pending");
  const sentInvites = invites.filter(i => i.smsStatus === "sent" || i.smsStatus === "delivered");
  const joinedInvites = invites.filter(i => i.joinedAt !== null);

  return {
    invites, pendingInvites, sentInvites, joinedInvites,
    stats, uploads, loading, uploading,
    processCsv, markSent, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. useMarketInsight — Market data for a city + category
// ═══════════════════════════════════════════════════════════════════════════════

export function useMarketInsight(city?: string, category?: StoreCategory) {
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!city || !category) return;
    setLoading(true);
    try {
      const data = await MarketplaceEngine.getMarketInsight(city, category);
      setInsight(data);
    } catch (err) {
      console.error("useMarketInsight error:", err);
    } finally {
      setLoading(false);
    }
  }, [city, category]);

  useEffect(() => { fetch(); }, [fetch]);

  const estimateRevenue = useCallback(
    (customers: number, avgOrderCents: number, repeatRate: number) =>
      MarketplaceEngine.calculateRevenueEstimate(customers, avgOrderCents, repeatRate),
    []
  );

  // Opportunity level
  const opportunityLevel = insight
    ? insight.supplyPct < 15 ? "very_high"
    : insight.supplyPct < 25 ? "high"
    : "good"
    : null;

  return { insight, opportunityLevel, loading, estimateRevenue, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. useOwnerDashboard — Store owner dashboard data
// ═══════════════════════════════════════════════════════════════════════════════

export function useOwnerDashboard(storeId?: string) {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof MarketplaceEngine.getOwnerDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await MarketplaceEngine.getOwnerDashboard(storeId);
      setDashboard(data);
    } catch (err) {
      console.error("useOwnerDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. useMarketplaceActions — Store CRUD + review + inquiry actions
// ═══════════════════════════════════════════════════════════════════════════════

export function useMarketplaceActions() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createStore = useCallback(async (params: CreateStoreParams) => {
    if (!user?.id) throw new Error("Not authenticated");
    setCreating(true);
    try {
      return await MarketplaceEngine.createStore(user.id, params);
    } finally {
      setCreating(false);
    }
  }, [user?.id]);

  const updateStore = useCallback(async (storeId: string, updates: Partial<CreateStoreParams>) => {
    return await MarketplaceEngine.updateStore(storeId, updates);
  }, []);

  const addService = useCallback(async (storeId: string, params: Parameters<typeof MarketplaceEngine.addService>[1]) => {
    return await MarketplaceEngine.addService(storeId, params);
  }, []);

  const updateService = useCallback(async (serviceId: string, updates: Parameters<typeof MarketplaceEngine.updateService>[1]) => {
    return await MarketplaceEngine.updateService(serviceId, updates);
  }, []);

  const deleteService = useCallback(async (serviceId: string) => {
    return await MarketplaceEngine.deleteService(serviceId);
  }, []);

  const addReview = useCallback(async (storeId: string, rating: number, text?: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    setSubmitting(true);
    try {
      return await MarketplaceEngine.addReview(user.id, storeId, rating, text);
    } finally {
      setSubmitting(false);
    }
  }, [user?.id]);

  const sendInquiry = useCallback(async (storeId: string, message: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    setSubmitting(true);
    try {
      return await MarketplaceEngine.sendInquiry(user.id, storeId, message);
    } finally {
      setSubmitting(false);
    }
  }, [user?.id]);

  const replyToInquiry = useCallback(async (inquiryId: string, reply: string) => {
    return await MarketplaceEngine.replyToInquiry(inquiryId, reply);
  }, []);

  const requestProvider = useCallback(async (category: StoreCategory, city: string, description?: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    return await MarketplaceEngine.requestProvider(user.id, category, city, description);
  }, [user?.id]);

  const claimStore = useCallback(async (token: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    return await MarketplaceEngine.claimStore(user.id, token);
  }, [user?.id]);

  const calculateDiscount = useCallback((priceCents: number, discountPct: number) => {
    return MarketplaceEngine.calculateDiscountedPrice(priceCents, discountPct);
  }, []);

  return {
    createStore, updateStore,
    addService, updateService, deleteService,
    addReview, sendInquiry, replyToInquiry,
    requestProvider, claimStore, calculateDiscount,
    creating, submitting,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. usePayoutCountdown — Payout countdown for home screen
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutCountdown(nextPayoutDate?: string, payoutAmount?: number) {
  const [daysUntilPayout, setDaysUntilPayout] = useState<number | null>(null);

  useEffect(() => {
    if (!nextPayoutDate) {
      setDaysUntilPayout(null);
      return;
    }
    const payout = new Date(nextPayoutDate);
    const now = new Date();
    const diffMs = payout.getTime() - now.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    setDaysUntilPayout(diffDays);
  }, [nextPayoutDate]);

  const canPayOnPayoutDay = daysUntilPayout !== null && daysUntilPayout <= 30;

  return {
    daysUntilPayout,
    payoutAmount: payoutAmount ?? 0,
    canPayOnPayoutDay,
    payoutDateFormatted: nextPayoutDate
      ? new Date(nextPayoutDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null,
  };
}
