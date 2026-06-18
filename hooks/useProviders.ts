// hooks/useProviders.ts
// ─────────────────────────────────────────────────────────────────────────────
// React hooks for the Verified Provider Network — Phase 1A.
//
// Four hooks:
//   - useProviders(filters)          — list verified+active providers
//   - useProvider(providerId)        — single provider with reviews
//   - useProviderApplication()       — submit() for "Become a provider"
//   - useProviderDashboard()         — own provider record + steps
//
// All reads go via the providers table directly with RLS doing the
// gating (verified+active visible to everyone, owner sees their own
// in-flight rows). No aggregate RPC yet — Phase 1A keeps it shape-first.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type ProviderCategory =
  | "construction"
  | "education"
  | "healthcare"
  | "agriculture"
  | "retail"
  | "legal_finance"
  | "services"
  | "other";

export type ProviderVerificationStatus = "pending" | "verified" | "rejected";

export type Provider = {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  category: ProviderCategory;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  years_experience: number | null;
  verification_level: 1 | 2 | 3;
  verification_status: ProviderVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  rating_avg: number;
  rating_count: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProviderReview = {
  id: string;
  provider_id: string;
  reviewer_id: string;
  goal_id: string | null;
  rating: number;
  review_text: string | null;
  is_verified: boolean;
  created_at: string;
  reviewer_name?: string | null;
};

export type ProviderVerificationStep = {
  id: string;
  provider_id: string;
  step_type: "elder_endorsement" | "document_upload" | "admin_site_visit";
  status: "pending" | "in_progress" | "completed" | "rejected";
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
};

export type ProviderFilters = {
  category?: ProviderCategory;
  country?: string;
  minRating?: number;
};

export type ProviderApplicationInput = {
  business_name: string;
  category: ProviderCategory;
  country: string;
  city: string;
  description?: string;
  phone?: string;
  email?: string;
  years_experience?: number;
};

// ─── useProviders ───────────────────────────────────────────────────────────
export function useProviders(filters: ProviderFilters = {}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters are passed as a stable JSON shape — re-fetch only when their
  // values change.
  const filtersKey = JSON.stringify(filters);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("providers")
        .select("*")
        .eq("verification_status", "verified")
        .eq("is_active", true)
        .order("rating_avg", { ascending: false })
        .limit(200);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.country) q = q.eq("country", filters.country);
      if (filters.minRating) q = q.gte("rating_avg", filters.minRating);
      const { data, error: err } = await q;
      if (err) throw err;
      setProviders((data ?? []) as Provider[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load providers");
    } finally {
      setLoading(false);
    }
    // filters is captured via filtersKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  return { providers, loading, error, refetch: fetchProviders };
}

// ─── useProvider ────────────────────────────────────────────────────────────
export function useProvider(providerId: string | undefined) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvider = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const [prov, revs] = await Promise.all([
        supabase.from("providers").select("*").eq("id", providerId).maybeSingle(),
        supabase
          .from("provider_reviews")
          .select(
            // The reviewer_name join is best-effort — RLS may hide some
            // profiles; we surface what's visible.
            "*, reviewer:profiles!reviewer_id(full_name)",
          )
          .eq("provider_id", providerId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (prov.error) throw prov.error;
      setProvider((prov.data as Provider) ?? null);
      const flat = (revs.data ?? []).map((r: any) => ({
        ...r,
        reviewer_name: r.reviewer?.full_name ?? null,
      })) as ProviderReview[];
      setReviews(flat);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load provider");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void fetchProvider();
  }, [fetchProvider]);

  return { provider, reviews, loading, error, refetch: fetchProvider };
}

// ─── useProviderApplication ─────────────────────────────────────────────────
// Wraps the "Become a provider" submit:
//   1. INSERT into providers (verification_level=1, status=pending).
//   2. INSERT into provider_verification_steps (elder_endorsement, pending).
//   3. INSERT a notification row of type 'provider_application_submitted'
//      for each active admin so the admin dashboard sees it.
// Step 2 + 3 failures are non-fatal — the provider row is the contract; the
// other side-effects can be retried by an admin job later.
export function useProviderApplication() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: ProviderApplicationInput): Promise<Provider | null> => {
      if (!user?.id) {
        setError("Not authenticated");
        return null;
      }
      setSubmitting(true);
      setError(null);
      try {
        const { data: provider, error: err } = await supabase
          .from("providers")
          .insert({
            user_id: user.id,
            business_name: input.business_name,
            category: input.category,
            country: input.country,
            city: input.city,
            description: input.description ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            years_experience: input.years_experience ?? null,
            verification_level: 1,
            verification_status: "pending",
          })
          .select()
          .single();
        if (err) throw err;

        // Best-effort verification step — Level 1 = elder endorsement only.
        await supabase
          .from("provider_verification_steps")
          .insert({
            provider_id: provider.id,
            step_type: "elder_endorsement",
            status: "pending",
          })
          .then(({ error: stepErr }) => {
            if (stepErr) console.warn("[useProviderApplication] step insert failed:", stepErr);
          });

        // Best-effort admin fan-out. RLS lets each admin read their own
        // notifications, and the inbox surface picks it up. If the
        // anon-key client can't INSERT into admin notifications (likely
        // RLS-blocked), a server-side trigger should own this; until
        // then we try and swallow on failure.
        try {
          const { data: admins } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("is_active", true);
          if (admins && admins.length) {
            const rows = admins.map((a: any) => ({
              user_id: a.user_id,
              type: "provider_application_submitted",
              title: "New provider application",
              body: `${input.business_name} (${input.category}) is awaiting Elder endorsement.`,
              data: {
                provider_id: provider.id,
                category: input.category,
                country: input.country,
                city: input.city,
              },
              read: false,
            }));
            await supabase.from("notifications").insert(rows);
          }
        } catch (notifErr) {
          console.warn("[useProviderApplication] admin notify failed:", notifErr);
        }

        return provider as Provider;
      } catch (e: any) {
        setError(e?.message ?? "Failed to submit application");
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id],
  );

  return { submit, submitting, error };
}

// ─── useProviderDashboard ───────────────────────────────────────────────────
// Returns the caller's OWN provider row (if any), plus their verification
// steps and active goal links. RLS does the gating — anonymous calls return
// null without error.
export function useProviderDashboard() {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [steps, setSteps] = useState<ProviderVerificationStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user?.id) {
      setProvider(null);
      setSteps([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: prov, error: err } = await supabase
        .from("providers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (err) throw err;
      setProvider((prov as Provider) ?? null);
      if (prov) {
        const { data: stepRows } = await supabase
          .from("provider_verification_steps")
          .select("*")
          .eq("provider_id", prov.id);
        setSteps((stepRows ?? []) as ProviderVerificationStep[]);
      } else {
        setSteps([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return {
    provider,
    steps,
    isProvider: provider !== null,
    loading,
    error,
    refetch: fetchDashboard,
  };
}
