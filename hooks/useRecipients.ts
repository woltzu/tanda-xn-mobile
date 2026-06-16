// ══════════════════════════════════════════════════════════════════════════════
// hooks/useRecipients.ts — send_money_recipients queries + save helper.
// ══════════════════════════════════════════════════════════════════════════════
//
// Drives the recent-recipients section in DomesticSendMoneyScreen and the
// NewRecipientModal save flow. Recipients are user-scoped (RLS), unique by
// identifier so re-sends bump last_sent_at instead of duplicating rows.
//
// Migration: supabase/migrations/138_send_money_recipients.sql.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type RecipientMethod = "wallet" | "bank" | "mobile" | "cash";

export type SavedRecipient = {
  id: string;
  user_id: string;
  name: string;
  identifier: string;
  method: RecipientMethod;
  contact_phone: string | null;
  contact_email: string | null;
  bank: string | null;
  account_number: string | null;
  network: string | null;
  location: string | null;
  verified: boolean;
  created_at: string;
  last_sent_at: string;
  // P2 (migration 154): drives the "Send to {name} again?" prediction
  // chip and the auto-fill amount when a recent recipient is tapped.
  send_count: number;
  last_amount_cents: number | null;
};

export type SaveRecipientInput = {
  name: string;
  identifier: string;
  method: RecipientMethod;
  contact_phone?: string | null;
  contact_email?: string | null;
  bank?: string | null;
  account_number?: string | null;
  network?: string | null;
  location?: string | null;
  verified?: boolean;
};

// ─── List query: latest N recipients ────────────────────────────────────────
//
// Ordered by last_sent_at so the "most recent" header stays accurate even
// as send_count climbs. The prediction chip on DomesticSendMoneyScreen
// separately picks the highest-frequency recipient via topRecipientByFrequency.

export function useRecentRecipients(limit = 4) {
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("send_money_recipients")
      .select("*")
      .order("last_sent_at", { ascending: false })
      .limit(limit);

    if (qErr) {
      setError(qErr.message);
      setRecipients([]);
    } else {
      setRecipients((data as SavedRecipient[]) ?? []);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  return { recipients, loading, error, refetch: fetchRecipients };
}

// ─── Frequency-based prediction (P2) ────────────────────────────────────────
//
// Picks the single most-sent-to recipient owned by the caller. Backs the
// "Send to {name} again?" chip. Ties broken by last_sent_at desc via the
// migration-154 index. Returns null when the user has no recipients yet.
export function topRecipientByFrequency(
  recipients: SavedRecipient[],
): SavedRecipient | null {
  if (recipients.length === 0) return null;
  return [...recipients].sort((a, b) => {
    if (b.send_count !== a.send_count) return b.send_count - a.send_count;
    return (b.last_sent_at ?? "").localeCompare(a.last_sent_at ?? "");
  })[0];
}

// ─── Stats bump (P2) ────────────────────────────────────────────────────────
//
// Called from DomesticSendMoneyScreen after sendMoney succeeds. Atomic
// increment of send_count + last_amount_cents + last_sent_at via the
// migration-154 RPC. Fire-and-forget — UX doesn't depend on this
// landing before navigation.
export async function bumpRecipientStats(
  recipientId: string,
  amountCents: number,
): Promise<void> {
  const { error } = await supabase.rpc("bump_recipient_stats", {
    p_recipient_id: recipientId,
    p_amount_cents: amountCents,
  });
  if (error) {
    console.warn("[useRecipients] bump_recipient_stats failed:", error.message);
  }
}

// ─── Save / upsert ──────────────────────────────────────────────────────────
//
// Upsert keyed by (user_id, identifier) so re-sends bump last_sent_at instead
// of inserting duplicates. Returns the resulting row on success.

export async function saveRecipient(
  input: SaveRecipientInput,
  userId: string,
): Promise<{ row: SavedRecipient | null; error: string | null }> {
  const payload = {
    user_id: userId,
    name: input.name,
    identifier: input.identifier,
    method: input.method,
    contact_phone: input.contact_phone ?? null,
    contact_email: input.contact_email ?? null,
    bank: input.bank ?? null,
    account_number: input.account_number ?? null,
    network: input.network ?? null,
    location: input.location ?? null,
    verified: input.verified ?? false,
    last_sent_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("send_money_recipients")
    .upsert(payload, {
      onConflict: "user_id,identifier",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as SavedRecipient, error: null };
}

// ─── Identifier display helper ──────────────────────────────────────────────

export function recipientAvatarLetter(recipient: SavedRecipient): string {
  const name = recipient.name.trim();
  return name.length > 0 ? name[0].toUpperCase() : "?";
}
