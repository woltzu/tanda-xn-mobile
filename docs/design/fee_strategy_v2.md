# TandaXn Fee Strategy (v2)

> **Scope of this document.** TandaXn's phased approach to fees — processing costs, late contributions, withdrawal handling, and the sequenced monetization roadmap. It does NOT cover advance/loan product fees (Doc 36) or goal penalty charity reversals (deferred to Phase 3+). The runway model is Section 3 and is the analytical backbone of the entire strategy — it answers "how much external funding do I need to reach self-sustaining." Dollar-figure line items in the model are `[PLACEHOLDER]` — finance owns those numbers, not this doc — but the structure, revenue assumptions, and sensitivity math are all here.
>
> **Filename convention.** `v2` is the session-local revision tag, matching how `ledger_v2.md` is versioned. There is no `35_*` slot corresponding to the doc-index numbering the earlier session used — this doc stands on its own in `docs/design/`.
>
> **Written from.** Present-state code (`loan_products` fee columns, `ledger_events` from mig 276, platform-fee infrastructure from mig 279, reconciliation surface from mig 351) plus the outline provided. Every claim that isn't directly verifiable from the codebase is either flagged `[ESTIMATE]` (competitor data), `[PLACEHOLDER]` (finance-owned figures), or `[POLICY DECISION]` (a rate we'd need product/community input to set).

---

## 0. Runway and sequenced monetization

TandaXn is **not** choosing between "free forever" and "charge fees now." Fees phase in as we cross growth AND readiness milestones — the earliest phase absorbs processing costs as customer acquisition (CAC), and each subsequent phase adds a monetization lever when the compliance, product, and scale conditions actually support it.

### Phase gates — ALL conditions must be met to transition

Member count alone is **NOT** a trigger. Each phase transition requires every condition in the row to be simultaneously true; a phase does not begin until the last condition lands. If we reach 500 members but MTL is still pending, we stay in Phase 0. If we reach 2,000 members but the cross-border product isn't built, we stay in Phase 1.

| Transition | Conditions (ALL required) |
|---|---|
| **Phase 0 → Phase 1** | • **500–2,000 members** (identity_verified count) AND<br>• **MTL granted** in target operating jurisdictions AND<br>• **Advance product built to spec** (production-ready, tested, integrated with the wallet ledger) AND<br>• **Reviewed by lending counsel** (regulatory + T&C sign-off documented) |
| **Phase 1 → Phase 2** | • **2,000–5,000 members** AND<br>• **Cross-border remittance product built** (corridor rails, FX flow, per-corridor KYC re-verify) AND<br>• **Remittance regulatory scope confirmed** (may require additional state-level money-transmitter licensing on top of the Phase-1 MTL) |
| **Phase 2 → Phase 3** | • **5,000+ members** AND<br>• **Revenue infrastructure built** (ad-serving pipeline OR partnership contracts signed, whichever lever we activate first) |

### Fee policy per phase (once the corresponding transition has completed)

| Phase | Fee policy |
|---|---|
| **Phase 0** | Rotating circles free. Processing fees absorbed as CAC. Founding members granted permanent premium free (see Section 2). |
| **Phase 1** | Introduce advance/lending fees (12–18% depending on product type — Doc 36 owns the rate table). Real revenue starts here. |
| **Phase 2** | Add cross-border remittance at 1.5–2% (vs. Western Union 4–6% [ESTIMATE]). Expected biggest revenue lever for the diaspora product. |
| **Phase 3** | Layer on advertising, service-provider partnerships, B2B data licensing. Additive to Phase 1 + 2, not a replacement. |

### Structural home for phase state

None of these gates live in the schema today. When the Phase-1 gate approaches, the natural home is a `platform_settings` row set the app can read to gate advance products server-side:

- `platform_settings.phase = 0 | 1 | 2 | 3` — the currently active phase.
- `platform_settings.mtl_operational BOOLEAN` — gates advance-product endpoints server-side.
- `platform_settings.remittance_operational BOOLEAN` — gates the remittance EF.

Not implemented yet. Add when the Phase-1 transition is imminent so RPCs and EFs can consult a single source of truth rather than product-team-maintained feature flags.

### Why this is worth stating up front

The most common mistake in an early-stage fintech is to over-tune fees on day one — either by choosing "monetize immediately" (drives away users you need to prove product-market fit) or "free forever" (delays the transition to revenue past the point where it can save the business). Sequencing avoids both. It also lets us make **honest, dated commitments** to founding members ("no fees on rotating circles for you, ever") without those commitments preventing us from ever charging for anything downstream.

---

## 1. Overview

TandaXn's fee strategy is grounded in **four principles**, in priority order:

1. **Fairness.** Fees are proportional to the service value delivered. A late contribution fee reflects the real disruption a late payment causes to other circle members. A cross-border remittance fee reflects the FX + settlement work TandaXn does. Fees that exist to punish a member (rather than to price a service) are out of scope.
2. **Transparency.** Every fee is disclosed to the user **before** the transaction commits. Fees that TandaXn absorbs are still shown ("Processing fee: $6.83 — covered by TandaXn") so users understand the real cost structure. No hidden charges, no "convenience fees" bolted onto the checkout screen.
3. **Competitiveness.** Fees are lower than the traditional alternative for the same problem. We're competing against Western Union at 4–6%, payday lenders at 400%+ APR, and local money lenders at 15–25% [ESTIMATE — see Section 7]. Beating those isn't hard; being visibly better on price is a core value prop.
4. **Sequenced monetization.** Fee introduction is calendared to growth milestones (Section 0), not to funding-runway pressure. If burn forces an early fee change, Section 3's runway model is where that decision gets sized — not this principles list.

The rest of this doc walks through the runway math (Section 3), then each fee surface today, and explicitly names what's Phase-0 policy vs. what's deferred vs. what's still a policy decision.

---

## 2. Money-movement fees (Phase 0)

**Phase 0 policy: TandaXn absorbs.** All money-movement processing fees are covered by TandaXn as CAC during Phase 0. No user-side charge for card processing, ACH transfers, or bank payouts.

### What's absorbed

| Fee type | Applies to | Covered by |
|---|---|---|
| **Card processing** | Wallet deposits + circle contributions funded from card | TandaXn |
| **ACH direct debit** | Wallet deposits + circle contributions funded from bank | TandaXn |
| **International card** | Deposits/contributions on non-US cards | TandaXn |
| **Payout / transfer** | Circle payouts to recipient wallet + wallet-to-wallet transfers | TandaXn |
| **Currency conversion** | Deposits or payouts crossing currencies | TandaXn |

### Stripe cost reference (for the absorb math)

Costs TandaXn actually pays Stripe per transaction. These are the numbers that show up as the "covered by TandaXn" figure in the user-facing display, per Section 10.

- **Card (online, US card, USD)**: 2.9% + $0.30
- **ACH direct debit**: 0.8% capped at $5.00
- **International card**: 3.1% + $0.30 + 1.5% cross-border fee
- **Currency conversion**: +1.0% on the converted amount

These numbers are stripe.com's published US pricing (verify against your current Stripe agreement — enterprise/volume rates can vary). Migration 279 (`platform_fee_infrastructure`) added `stripe_fee_cents` to `ledger_events` so we're already capturing the actual cost per event, not modeling it from the rate card. See Section 9.

### Founding-member commitment

Every user who joins during Phase 0 gets **permanent premium free** on rotating circles. This is a durable commitment — even if Phase 1 or beyond introduces a "premium" tier or per-circle fee, founding members are grandfathered.

Structural home: `profiles.is_founding_member BOOLEAN DEFAULT FALSE` set at signup during the Phase-0 window and honored downstream by any premium-gating RPC. Not implemented today; add when the first premium surface goes live.

### Phase transitions

The absorb policy in this section applies **only to Phase 0**. When we cross into Phase 1, this doc must be revisited: the founding-member cohort keeps free processing on rotating circles (structural commitment above); newer members MAY see a processing pass-through on non-core surfaces (specifically wallet withdrawals — see Section 4 — and international-card premium). The default remains absorb until an explicit product decision documented in the next revision of this file.

---

## 3. Runway model — the analytical backbone

**This section answers the strategic question: "How much external funding do I need to get from Phase 0 to self-sustaining under moderate assumptions?"**

Every rate elsewhere in this document is calibration. Section 3 is the number that tells us whether the calibration will keep the company alive. Dollar-figure baselines are `[PLACEHOLDER]` (finance owns those), but the model structure, revenue math, and sensitivity ranges are all locked here — plug in the baseline burn figures and the "external funding required" number falls out.

### 3.1 Baseline monthly burn — zero revenue

Cost lines itemized. Every dollar figure is a `[FOUNDER ESTIMATE — Jul 2026, revisit monthly]` — accurate enough to close the funding math tonight, not precise enough to quote in a term sheet without a second pass. The cost categories are the ones that actually scale as the member base grows; incidentals (small tools, per-user support hours, one-off contractor engagements) are folded into the categories they most closely resemble rather than broken out. All columns are **snapshots at the given headcount**, not averages over the window.

| Cost category | 500 members | 1,000 members | 2,000 members |
|---|---|---|---|
| **Stripe fees absorbed** (Section 2) | $3,270 | $6,540 | $13,080 |
| **Infrastructure** (Supabase Pro + Vercel + Expo EAS + Sentry + misc SaaS) | $300 | $400 | $600 |
| **Legal** (MTL prep + application, amortized + ongoing counsel) | $1,200 | $1,200 | $1,800 |
| **Founder time** (opportunity cost — market-rate comp) | $12,000 | $12,000 | $12,000 |
| **Total monthly burn** | **$16,770** | **$20,140** | **$27,480** |

Source notes (July 2026 founder estimate — revisit monthly):

- **Stripe absorbed** — Assumes avg $215/member/month contribution volume × (2.9% + $0.30/charge × 4 charges/mo). Scales linearly at ~$6.54/member/month.
- **Infrastructure** — $25 Supabase Pro + $20 Vercel + $30 Expo EAS + $45 Sentry + ~$180 misc SaaS at 500 mem. Slight scale-up to $280 misc at 1,000 mem, then tier bumps (Supabase to $100, Vercel to $80) at 2,000 mem.
- **Legal** — MTL application active at 500-1,000 mem window ($600/mo amortized + $600/mo counsel = $1,200/mo). At 2,000 mem, MTL granted → shifts to $1,200/mo ongoing retainer + $600/mo compliance counsel = $1,800/mo.
- **Founder time** — Market-rate comp band for founder role at ~$12k/mo. Held flat across headcount because compensation doesn't scale with member count; a co-founder would need its own line.

Notes on the four lines:

- **Stripe fees absorbed** scales linearly with member txn volume. This is the single most sensitive line — a viral growth month at 3× normal volume triples this cost without any operational change.
- **Infrastructure** scales sub-linearly. Supabase and Vercel usage-tier steps come in chunks; expect step-function jumps at ~1,000 and ~5,000 active users rather than a smooth curve.
- **Legal** is lumpy. Big MTL application spike hits somewhere between 500 and 1,000 members (whenever the compliance runway forces the timing); ongoing counsel is a smaller monthly retainer thereafter. Model as a step function, not a monthly-average.
- **Founder time** is included as opportunity cost even when unpaid or below-market so the runway math reflects true cost. A founder working for equity at a market rate valuation is still consuming that cost — pretending otherwise makes the burn number optimistic and the funding gap unrealistic.

### 3.2 Phase 1 revenue overlay — advance / lending fees

**Moderate assumptions** (from spec):
- **Take rate**: 15% of active members take an advance in a given month.
- **Average advance size**: $200.
- **Average fee**: 14% (effective fee on the disbursed amount — combines origination fee + accrued interest for the short-term products that dominate the Advance Hub).

**Monthly revenue at moderate**:

```
revenue_per_month = members × take_rate × avg_size × avg_fee
```

| Members | Take rate | Advance volume/mo | Fee rate | Revenue/mo |
|---|---|---|---|---|
| 500 | 15% | $15,000 | 14% | **$2,100** |
| 1,000 | 15% | $30,000 | 14% | **$4,200** |
| 2,000 | 15% | $60,000 | 14% | **$8,400** |

Advance revenue is not available until the Phase-1 gate has closed (Section 0). At 500 members with MTL pending, this line is still zero — the phase gate is the gate, not the member count.

### 3.3 Phase 2 revenue overlay — cross-border remittance

**Moderate assumptions** (from spec):
- **Remittance rate**: 30% of active members remit in a given month.
- **Average monthly send**: $400 per remitting member.
- **Fee**: 1.75% (mid-point of the 1.5–2% Section 8 target range).

**Monthly revenue at moderate**:

```
revenue_per_month = members × remit_rate × avg_send × fee
```

| Members | Remit rate | Remittance volume/mo | Fee rate | Revenue/mo |
|---|---|---|---|---|
| 2,000 | 30% | $240,000 | 1.75% | **$4,200** |
| 3,500 | 30% | $420,000 | 1.75% | **$7,350** |
| 5,000 | 30% | $600,000 | 1.75% | **$10,500** |

Remittance revenue is not available until the Phase-2 gate has closed. All three columns above assume the corridor rails are live.

### 3.4 Combined revenue by phase-adjusted milestone

Assuming both phases are active at the given member count (i.e. Phase 2 gate has closed by 2,000 members):

| Members | Phase 1 rev/mo | Phase 2 rev/mo | **Total revenue/mo** |
|---|---|---|---|
| 500 (Phase 0 — no revenue possible) | $0 | $0 | **$0** |
| 1,000 (Phase 1 only if gate closed) | $4,200 | $0 | **$4,200** |
| 2,000 (Phase 1 + 2) | $8,400 | $4,200 | **$12,600** |
| 3,500 (Phase 1 + 2) | $14,700 | $7,350 | **$22,050** |
| 5,000 (Phase 1 + 2) | $21,000 | $10,500 | **$31,500** |

The 3,500 and 5,000 Phase 1 numbers extrapolate the 15% × $200 × 14% math to those member counts.

### 3.5 Sensitivity — three scenarios

Each variable moves ±50% around moderate to give a range that lets us plan defensively. "Pessimistic" = ×0.5 on the revenue outcome (i.e. the assumptions land at half their expected effectiveness); "optimistic" = ×1.5. This is more conservative than compounding each variable independently — a scenario where every variable simultaneously hits 0.5× would give (0.5)³ = 0.125× revenue, which is worst-case-Sunday-morning-panic territory rather than useful planning material.

#### Phase 1 revenue at each member count, per scenario

| Members | Pessimistic (×0.5) | Moderate | Optimistic (×1.5) |
|---|---|---|---|
| 500 | $1,050 | $2,100 | $3,150 |
| 1,000 | $2,100 | $4,200 | $6,300 |
| 2,000 | $4,200 | $8,400 | $12,600 |

#### Phase 2 revenue at each member count, per scenario

| Members | Pessimistic (×0.5) | Moderate | Optimistic (×1.5) |
|---|---|---|---|
| 2,000 | $2,100 | $4,200 | $6,300 |
| 3,500 | $3,675 | $7,350 | $11,025 |
| 5,000 | $5,250 | $10,500 | $15,750 |

#### Combined revenue at Phase-1+2 milestones, per scenario

| Members | Pessimistic | Moderate | Optimistic |
|---|---|---|---|
| 2,000 | $6,300 | $12,600 | $18,900 |
| 3,500 | $11,025 | $22,050 | $33,075 |
| 5,000 | $15,750 | $31,500 | $47,250 |

#### Net monthly burn = burn (§3.1) − revenue, per scenario

Burn at 3,500 and 5,000 members is extrapolated from the §3.1 growth curve (variable cost $6.54/mem/mo × headcount + fixed cost stabilizing at ~$14.4k-$15k/mo post-MTL). Marked with a trailing † in the table.

| Members | Burn/mo | Revenue (Pessimistic) | Revenue (Moderate) | Revenue (Optimistic) | Net (Pessimistic) | Net (Moderate) | Net (Optimistic) |
|---|---|---|---|---|---|---|---|
| 500 (Phase 0) | $16,770 | $0 | $0 | $0 | -$16,770 | -$16,770 | -$16,770 |
| 1,000 (Phase 1) | $20,140 | $2,100 | $4,200 | $6,300 | -$18,040 | -$15,940 | -$13,840 |
| 2,000 (Phase 1+2) | $27,480 | $6,300 | $12,600 | $18,900 | -$21,180 | -$14,880 | -$8,580 |
| 3,500 (Phase 1+2)† | $37,500 | $11,025 | $22,050 | $33,075 | -$26,475 | -$15,450 | -$4,425 |
| 5,000 (Phase 1+2)† | $47,700 | $15,750 | $31,500 | $47,250 | -$31,950 | -$16,200 | **-$450** |

### 3.5.1 Per-member unit economics — the key finding

The net-burn table above surfaces a strategic finding worth naming plainly.

**Per-member marginal contribution** (fees earned per member per month minus Stripe fees absorbed per member per month):

| Scenario | Phase 1 rev/mem/mo | Phase 2 rev/mem/mo | Total rev/mem/mo | Stripe fees absorbed/mem/mo | Net per member/mo |
|---|---|---|---|---|---|
| Pessimistic | $2.10 | $1.05 | $3.15 | $6.54 | **-$3.39** |
| Moderate | $4.20 | $2.10 | $6.30 | $6.54 | **-$0.24** |
| Optimistic | $6.30 | $3.15 | $9.45 | $6.54 | **+$2.91** |

**Reading the table:**

- **Pessimistic:** every new member is a $3.39/mo net cost. Growth actively destroys value. The pessimistic case is not a viable business as modeled.
- **Moderate:** every new member is a $0.24/mo net cost. Growth doesn't help meaningfully — it spreads fixed costs over slightly-negative-per-unit revenue. Self-sustaining requires either raising the take rate, raising fees, or lowering costs (in that order of preference).
- **Optimistic:** every new member is a $2.91/mo positive contribution. Growth gets us to breakeven — around 5,000 members under the modeled cost structure.

The moderate-scenario finding is the load-bearing insight from this whole document: **at the assumptions in Sections 3.2 and 3.3, the business as modeled does not close on the moderate case.** Section 3.6 sizes the funding gap under each scenario and names what would have to change to move moderate into a self-sustaining trajectory.

### 3.5.2 Fourth scenario — contribution frequency mix

The §3.1 baseline used a uniform "4 charges/mem/mo" assumption. Reality is a mix — most rotating-savings communities are weekly by tradition (esusu, tanda, susu) but monthly circles will exist. This subsection reruns the Stripe cost side of unit economics against a **60% weekly / 40% monthly** mix and reports whether the finding changes.

**Per-member Stripe cost by cadence** (Stripe: 2.9% + $0.30 per charge):

| Cadence | Monthly contribution volume | Charges/mo | Stripe cost/mo |
|---|---|---|---|
| **Weekly** ($50/wk) | $200 | 4 | $5.80 + $1.20 = **$7.00** |
| **Monthly** ($200) | $200 | 1 | $5.80 + $0.30 = **$6.10** |

Same monthly volume, different fixed-fee load. Weekly cadence is $0.90/mem/mo more expensive to process because of the four separate $0.30 charges.

**Weighted average at the requested 60/40 mix:**

```
Stripe/mem/mo = 0.6 × $7.00 + 0.4 × $6.10 = $4.20 + $2.44 = $6.64/mem/mo
```

That's $0.10 **higher** than the §3.1 baseline of $6.54 — the current baseline appears to have amortized weekly charges as if they were monthly, understating the fixed-fee load slightly. Correcting for the mix worsens moderate unit economics by $0.10/mem/mo.

**Mixed-scenario per-member unit economics** (moderate revenue assumptions from §3.2/3.3):

| Line | Amount |
|---|---|
| Phase 1 revenue/mem/mo | $4.20 |
| Phase 2 revenue/mem/mo | $2.10 |
| **Total revenue/mem/mo** | **$6.30** |
| Stripe fees absorbed (60/40 mix) | $6.64 |
| **Net per member/mo** | **-$0.34** |

Answer to the question the scenario was designed to answer:

**No — moderate unit economics do NOT close under the 60/40 mix without pricing changes.** They get slightly worse than the §3.1 baseline ($0.34/mem/mo loss vs. $0.24). The mix is a real factor but not the primary lever.

**Sensitivity across the mix:** The question that IS interesting — at what mix ratio would the moderate case flip positive at all?

| Mix (weekly / monthly) | Stripe cost/mem/mo | Rev - Stripe | Closes at |
|---|---|---|---|
| 100% weekly | $7.00 | -$0.70 | Never |
| 60% / 40% (requested mix) | $6.64 | -$0.34 | Never |
| 40% / 60% | $6.46 | -$0.16 | Never |
| **20% / 80%** | **$6.28** | **+$0.02** | ~720,000 members (positive but negligible slope) |
| 0% / 100% (all monthly) | $6.10 | +$0.20 | ~72,000 members |

Even in the best-case frequency mix (100% monthly, which contradicts community tradition), per-member positive contribution is only +$0.20/mo — the business would need 72,000 members to close on fixed costs alone. Not near-term viable.

**Verdict on the mix as a lever:** small, second-order. Worth watching (a shift toward monthly cadence would save $0.90/mem/mo on high-frequency users), but not the fix for the moderate case's unit economics. **The primary problem remains that Phase 1 + Phase 2 revenue per member ($6.30) is too close to Stripe cost per member ($6.10–$7.00 across the mix).** The three levers in §3.7 remain the material response.

### 3.6 Runway required — external funding to reach self-sustaining

**Growth assumption for the integration:** 200 new verified members per month, held flat across the window. This turns headcount into a time axis so we can accumulate monthly burn between milestones. `[FOUNDER ESTIMATE — Jul 2026]`. Sensitivity at the bottom of this section.

**Timeline mapping** at 200 mem/mo:

| Milestone | Month reached |
|---|---|
| 500 mem (Phase 0 end / Phase 1 gate arrival) | Month 2.5 |
| 1,000 mem | Month 5 |
| 2,000 mem (Phase 2 gate arrival) | Month 10 |
| 3,500 mem | Month 17.5 |
| 5,000 mem | Month 25 |

**Cumulative cash out** = trapezoidal integration of net burn between milestones. Computed as `avg(net_burn_start, net_burn_end) × months_in_segment`.

#### Optimistic scenario

Optimistic reaches near-breakeven at 5,000 members (net -$450/mo at month 25).

| Segment | Duration | Avg net burn/mo | Cumulative cash out |
|---|---|---|---|
| 0 → 500 mem | 2.5 mo | $16,770 (Phase 0 — no revenue) | $41,925 |
| 500 → 1,000 mem | 2.5 mo | avg($16,770, $13,840) = $15,305 | $38,263 |
| 1,000 → 2,000 mem | 5 mo | avg($13,840, $8,580) = $11,210 | $56,050 |
| 2,000 → 3,500 mem | 7.5 mo | avg($8,580, $4,425) = $6,503 | $48,769 |
| 3,500 → 5,000 mem | 7.5 mo | avg($4,425, $450) = $2,438 | $18,281 |
| **Total (25 months to near-breakeven)** | | | **~$203,000** |

**Optimistic scenario deliverable: External funding required to reach self-sustaining ≈ $203,000, timeline ~25 months.**

#### Moderate scenario

Moderate does NOT reach self-sustaining at modeled scale. Net burn stays in a $14.9k–$16.8k/mo band across every milestone. Per-member marginal contribution is -$0.24/mo (Section 3.5.1) — growth spreads the load but doesn't fill it.

Cumulative cash needed to REACH 5,000 members under moderate (not self-sustaining, just the scale milestone):

| Segment | Duration | Avg net burn/mo | Cumulative cash out |
|---|---|---|---|
| 0 → 500 mem | 2.5 mo | $16,770 | $41,925 |
| 500 → 1,000 mem | 2.5 mo | avg($16,770, $15,940) = $16,355 | $40,888 |
| 1,000 → 2,000 mem | 5 mo | avg($15,940, $14,880) = $15,410 | $77,050 |
| 2,000 → 3,500 mem | 7.5 mo | avg($14,880, $15,450) = $15,165 | $113,738 |
| 3,500 → 5,000 mem | 7.5 mo | avg($15,450, $16,200) = $15,825 | $118,688 |
| **Total (25 months to 5,000 mem, STILL BURNING $16,200/mo)** | | | **~$392,000** |

**Moderate scenario deliverable: External funding required to go from Phase 0 to self-sustaining ≈ does not close at modeled scale.** Reaching 5,000 members consumes ~$392k of external funding and leaves the business still burning $16,200/mo — with per-member economics slightly negative, so further growth continues to burn cash at a similar rate rather than closing the gap.

#### Pessimistic scenario

Pessimistic net burn WORSENS with growth. Each new member is a $3.39/mo net cost (Section 3.5.1). Growth is actively destructive.

| Segment | Duration | Avg net burn/mo | Cumulative cash out |
|---|---|---|---|
| 0 → 500 mem | 2.5 mo | $16,770 | $41,925 |
| 500 → 1,000 mem | 2.5 mo | avg($16,770, $18,040) = $17,405 | $43,513 |
| 1,000 → 2,000 mem | 5 mo | avg($18,040, $21,180) = $19,610 | $98,050 |
| 2,000 → 3,500 mem | 7.5 mo | avg($21,180, $26,475) = $23,828 | $178,706 |
| 3,500 → 5,000 mem | 7.5 mo | avg($26,475, $31,950) = $29,213 | $219,094 |
| **Total (25 months to 5,000 mem, burning $31,950/mo)** | | | **~$581,000** |

**Pessimistic scenario deliverable: growth destroys value; do not size a raise from this scenario. If assumptions land at pessimistic levels, the business needs to change model, not raise more.**

#### Runway-in-months at fixed cash on hand

At $200,000 cash raised:

| Scenario | Runway (months to zero cash) |
|---|---|
| Pessimistic | ~11 months (never gets past 1,000 mem before running out) |
| Moderate | ~12 months (past 1,000 mem, not to 2,000) |
| Optimistic | ~25 months (reaches near-breakeven right as cash runs out — tight) |

At $400,000 cash raised:

| Scenario | Runway (months) |
|---|---|
| Pessimistic | ~19 months (past 2,000 mem but burn still worsening) |
| Moderate | ~26 months (reaches ~5,000 mem, still burning) |
| Optimistic | >36 months (well past breakeven with cash reserve) |

### 3.7 What has to change to move moderate into breakeven

The moderate case doesn't close because per-member marginal contribution is -$0.24/mo at the §3.1 baseline (-$0.34/mo under the §3.5.2 mix). Four levers that would flip it positive; the first three are pricing/cost decisions, the fourth is a product-mix observation.

1. **Take-rate up to 20% (from 15%)** — Phase 1 revenue per member would rise from $4.20 to $5.60/mo. Combined per-member revenue: $7.70. Net per member: +$1.16/mo (baseline) or +$1.06 (mix). Business closes around ~13,000 members.
2. **Advance fee up to 18% (from 14%)** — Phase 1 revenue per member would rise from $4.20 to $5.40/mo. Combined: $7.50. Net per member: +$0.96 / +$0.86. Business closes around ~15,000 members. Watch competitive positioning per Section 7.
3. **Cut founder-time line to $8k/mo (from $12k)** — fixed cost drops to $10,400 at 2,000 mem. Per-member unchanged; total burn shape changes and can reach breakeven with growth — at moderate rev/mem, ~44,000 members. Not a near-term path.
4. **Shift member mix toward monthly cadence** (§3.5.2) — 100% monthly saves $0.90/mem/mo in Stripe fixed fees vs. weekly. On its own this only pushes unit economics from -$0.24 to +$0.20 (best case) — modest slope, breakeven at ~72,000 members. But it stacks additively with Levers 1 + 2, so if the mix drifts toward monthly for other reasons (product decisions about what circles we highlight, community norms shifting), the take-rate + fee levers need to move less.

Combining Lever 1 + a partial version of Lever 2 (say 16% advance fee) closes at ~8,000 members — a scale target within reach of a typical Series A trajectory. Combining that with mix drift toward monthly circles could pull it to ~6,000 members. These are illustrative combinations from the model; §3.8 keeps them as open questions rather than committing to any one.

### 3.8 Product decisions required — open questions

The three primary levers (and one secondary observation) surfaced by §3.7 are **open questions for deliberate future review, not decisions to make now.** This document is the model that surfaces them; the answers require product, community, and legal input beyond the scope of a fee-strategy doc.

Framed as questions, in the order the runway math surfaces them:

1. **What advance take-rate should we plan for at launch?** — The 15% moderate assumption in §3.2 is a starting point sourced from small-lender comparables. Whether 15% is realistic (or 20% is achievable, or 10% is the honest expectation) depends on:
   - Community trust and willingness to draw on the Advance product.
   - Marketing surface (how prominent the Advance Hub is in the app).
   - Financial-literacy positioning (does the community view advances as safety-net or as debt-to-avoid?).
   Answering this needs member research and pilot data, not model recalibration.
2. **What advance fee should we launch at?** — The 14% moderate assumption comes from splitting the 12–18% Phase-1 range at the midpoint. Whether launching at 16% (higher revenue per advance) vs. 12% (broader adoption) is the right positioning depends on:
   - Competitive pricing per Section 7 (credit-builder loans at 15–20%; payday at 400%+).
   - MTL constraints and lending-counsel guidance.
   - Whether the fee structure is flat vs. tiered by risk grade (Doc 36's scope, not this doc's).
   Answering this needs lending-counsel review and finance-team modeling.
3. **What compensation structure for founders during the runway?** — The $12k/mo opportunity-cost line in §3.1 is a market-rate valuation for a founder role, held flat across the runway. Whether founders take equity-only (line drops to a smaller cash-only administrative cost), below-market cash (line partially drops), or full market comp (as modeled) is a fundraising / equity-structure question that lands with the investor conversation, not the fee-strategy doc.
4. **Should we surface product design that shifts contribution mix toward monthly?** — The §3.5.2 mix analysis shows that all-weekly circles cost $0.90/mem/mo more in Stripe fees than all-monthly circles. This isn't a pricing lever — it's a product-design observation. Whether we default the "Create a circle" flow to monthly cadence, position monthly circles as "premium" or "goal-oriented", or leave the choice fully to members is a UX and community-norms question.
5. **Should TandaXn absorb Stripe processing fees, or pass them transparently to members?** Current model assumes full absorption as CAC. Passing fees would flip unit economics dramatically (+$6.30/mem/mo revenue effect) but changes competitive positioning against free informal tontines. This is the largest single lever in the model and requires pilot data to answer responsibly.

The illustrative closing scenario from §3.7 — Lever 1 + partial Lever 2 (20% take rate + 16% advance fee) closing at ~8,000 members — is **one option surfaced by the model, not the recommendation.** The model can tell us what combinations of moves close the case; it cannot tell us which combination is the right business decision. That's the deliberate-review call the runway model is meant to inform, not replace.

**Tone note:** these are questions the model surfaces, not answers the model provides. Any doc that says "we should charge 18% for advances" without the pilot data behind it is doing calibration, not strategy. This section stays open until the pilot data lands.

**Decision timing.** None of these five questions should be answered in the same work session they were surfaced. Pricing decisions made without pilot data are guesses; pricing decisions made under founder fatigue are worse guesses. These questions get answered after (a) 50+ real user conversations about willingness to pay, (b) 3+ months of pilot cohort data on actual contribution behavior, or (c) both. Not before.

### 3.7 What moves the number

The three variables that dominate the "external funding required" figure:

1. **Baseline burn** (Section 3.1) — obviously, the biggest lever. Every dollar off the monthly total is roughly a month of runway extension for an unfunded team.
2. **MTL timing** — determines when Phase 1 revenue can start. A 3-month delay in MTL is a 3-month delay in the revenue overlay; at $4,200/mo moderate revenue at 1,000 members, that's roughly $12k of additional funding required. At 2,000 members, $25k.
3. **Take rate assumption** (Section 3.2) — hardest to know before launch. Running the model at 10% and 20% take rates in addition to the 15% moderate gives a real-world range that fundraising conversations can defend against.

Sizing runway from optimistic assumptions is how startups die. Sizing from pessimistic assumptions is how they raise a bit too much and dilute unnecessarily. Both are honest failure modes. The moderate-with-3-6-month-buffer approach threads that needle.

---

## 4. Withdrawal fees

**Scope of this section: wallet-to-bank withdrawals ONLY.** Goal withdrawals are handled in Section 6 (deferred). Circle payouts are Section 2 (absorbed in Phase 0). Cross-border remittance is Section 8 (Phase 2).

### Policy

**Phase 0**: Absorbed by TandaXn, consistent with Section 2. A member requesting a bank withdrawal sees "Bank transfer fee: $X.XX — covered by TandaXn" per the disclosure convention in Section 10.

**Phase 1+ (probable pass-through)**: Bank transfer fees may pass through to the member. This depends heavily on the **custody structure** we settle on when the MTL comes online — see below.

### Custody structure caveat

The cost of a wallet-to-bank withdrawal depends on how funds are held during Phase 1:

- **Non-custodial (pass-through wallet, funds settle to member's linked bank the moment they arrive).** Withdrawal cost per transaction is small (ACH: $0.25–$1.00). Passing through as a flat fee is defensible.
- **Custodial (TandaXn holds pooled member funds until instructed).** Higher operational and compliance cost per withdrawal (wire fees, reconciliation overhead, potentially FBO-account fees from the sponsor bank). Pass-through fee may be higher, or we may need to absorb a portion.

The choice between these is not made in this doc — it's an MTL/legal/finance decision that lands ahead of Phase 1. What this doc commits to: **transparent disclosure of whatever the cost turns out to be**, and never a withdrawal-blocking hidden charge.

### Display convention

Whatever the cost, the user sees it before confirming the withdrawal. Section 10 has the exact display copy.

---

## 5. Late contribution fees

**This section scopes late fees. It does NOT set the rate** — the rate is a per-circle product/community decision, not a platform default.

### Why late fees exist

A cycle depends on every member's contribution landing on time. If a contribution is late, the whole cycle stalls: the recipient's payout is delayed, downstream cycles are pushed back, and Circle Reputation for both the late member and the circle as a whole drops. **Without a fee, a late member has no cost to being late.** That erodes on-time contributions across the circle and pulls Circle Reputation down over time, which is a compounding harm.

Late fees are a **coordination device**, not a revenue lever. Every dollar collected in late fees is a signal that a coordination failure occurred. Ideally the number trends toward zero as the community matures.

### Mechanism (structural)

- **Grace period.** Configurable per circle at creation time. Default `grace_period_days = 5` on the `circles` table; circle creators can set 0–14 days. The grace period must be honored before any late-fee logic fires.
- **Rate.** Per-circle, set at creation. Suggested default (see below) is 5% of the missed contribution amount + 1%/day thereafter — but the platform doesn't hardcode this; it's a `late_fee_flat_cents` + `late_fee_percent` column pair on `loan_products` today and would need equivalent columns on `circles` for the contribution case.
- **Collection.** Fee is added to the member's **next contribution** — never deducted from a current-cycle payout to a different member. This keeps the fee attributable to the correct member and doesn't create a second layer of coordination failure.
- **Waivers.** Circle creator has the authority to waive a late fee on request. The waiver posts a `wallet_transactions` row with `transaction_type='fee_waived'` and a `metadata.waived_by` pointer to the creator's user_id, for audit.
- **Maximum caps.** A per-circle cap (`late_fee_cap_cents`) prevents runaway compounding for members who miss multiple cycles. Suggested default: 50% of one contribution amount.

### Suggested rate (starting point, not a decision)

**5% of missed contribution + 1%/day after grace period expires, capped at 50% of one contribution.**

This is a starting point in line with rotating-savings community norms. The actual rate should be set by each circle at creation, and the platform-wide default should be revisited after 6 months of production data — we'll know then what percentage of members hit the fee, what percentage of fees get waived, and whether the numbers are enforcing on-time behavior or just punishing bad luck. [POLICY DECISION — needs product/community input to lock the default].

### Collection accounting

Every late fee is a `ledger_events` row with `event_type='fee.late'` and a paired `wallet_transactions` debit on the paying member's next contribution. See Section 9 for the taxonomy.

---

## 6. Goal penalty fees (deferred)

**Decision: goal penalty fees and the charity-reversal mechanism are deferred to Phase 3+ and are NOT covered by this document.**

### Why deferred

The proposed mechanism — a member who withdraws early from a locked savings goal sees the penalty routed to a charity/orphanage in their home country — requires:

- **Legal compliance** with cross-border charitable transfer rules in each corridor (US → CIV, US → SEN, etc.). Non-trivial and jurisdiction-specific.
- **Charity vetting** — a curated list of trusted recipients in each corridor with pre-negotiated wire arrangements.
- **User disclosure** — the "your penalty goes to charity X" disclosure must be shown at goal creation time and re-confirmed at withdrawal. Also needs to be a per-goal setting so the user can pick or change the charity.
- **Reversal accounting** — the penalty flow becomes a two-step transaction (member's wallet debited, charity's off-platform wallet credited) that has to land in `ledger_events` and reconcile via mig 351's sweeper.

None of this is buildable in the Phase 0 → Phase 1 timeframe.

### Alternative for launch

For Phase 0 through Phase 2, **early goal-withdrawal from a locked tier reduces accrued benefits, not member principal**. Specifically:

- Interest earned during the lock period is forfeited (not paid to a third party — just not credited).
- Any matching or bonus tier the goal qualified for is unlocked at a reduced multiplier or not at all.
- The user's principal is returned intact.

This is a "loss of upside" penalty, not a "loss of money" penalty. Structurally simpler, legally uncontroversial, and communicates the right incentive: locking money is worth something, unlocking early costs you the something.

### When to revisit

Phase 3+ once the corridor list, charity-vetting process, and cross-border compliance are all mature. This section becomes its own full document at that point (`goal_penalty_charity_v1.md`). Not here.

---

## 7. Competitive landscape

**Caveat: competitor data below is a starting reference, not verified truth.** Every claim that isn't sourced from a primary document (competitor's own pricing page, published press release, filed disclosure) is tagged `[ESTIMATE — needs verification]`. Please chase the primary sources before quoting these numbers to investors, partners, or press.

### Rotating-savings / diaspora fintech comparisons

- **Money Fellows** — 16% → 0% position-based fees. Earlier payout positions pay higher fees; later positions pay less or nothing. [ESTIMATE — verify against Money Fellows' current published pricing.]
- **Carbon Circles** — ~5% flat fee per contribution. [ESTIMATE — verify.]
- **Esusu (US)** — no per-transaction fee; monetized via reporting-to-credit-bureau partnerships. [ESTIMATE — different model, useful as a "not everyone charges" data point.]

### Remittance comparisons (relevant for Phase 2)

- **Western Union / MoneyGram (traditional agents)** — 4–6% depending on corridor and payout type (cash pickup vs. bank). Higher for smaller amounts.
- **Wise (bank-to-bank digital)** — ~0.6–1.5% depending on corridor.
- **PayPal / Xoom** — 2.99–3.49% + fixed fee ($0.49 typical). Card-funded rates can exceed 5%.
- **WorldRemit / Remitly** — 1–3% depending on corridor and payout type. [ESTIMATE — corridor-dependent, verify per corridor before pricing our own.]

### Lending comparisons (relevant for Phase 1)

- **Local money lender (informal, home country)** — 15–25% [ESTIMATE — corridor-dependent, but consistently high]. Traditional community lender rates.
- **Payday lender (US)** — 400%+ APR when annualized. Predatory by any modern definition; used as the "obviously we beat this" baseline.
- **Credit-builder loans (Self, Kikoff, others)** — 15–20% APR on small principals. Comparable to what TandaXn's Advance products would charge in Phase 1.

### TandaXn's positioning

- **Phase 0 (rotating circles):** free processing. Every competitor above charges *something*. Our subsidy is the acquisition wedge.
- **Phase 1 (advance / lending):** 12–18% APR range covers most product tiers. Beats local money lender floor, beats credit-builder loans by a small margin, radically beats payday.
- **Phase 2 (remittance):** 1.5–2% target. Wise-competitive for the corridors Wise serves; a genuine improvement (2–4pp) over Western Union in the corridors that matter most for the diaspora product.

### What "competitive" means for this document

The purpose of Section 7 isn't to promise to always undercut. It's to give this doc a clear reference frame: **when we set a rate, we know what the alternative costs**, and we can defend the rate we set against a real number. Setting rates in a vacuum leads to overcharging (loses users) or undercharging (loses runway). Neither serves us.

---

## 8. Cross-border considerations

**Cross-border remittance is a Phase 2 revenue lever. This section scopes it; it does NOT set the rate.**

### Target

**1.5–2% total member-facing rate** on a US → home-country remittance in the corridors we serve. That's roughly Wise-competitive on the digital corridors and 2–4 percentage points better than Western Union for the corridors where WU is still dominant. [ESTIMATE — corridor-dependent per Section 7.]

### Cost structure (what the target rate has to cover)

- **Stripe international payment fee** — 3.1% + $0.30 + 1.5% cross-border on the funding leg, if funded by card. If funded from an already-loaded wallet (ACH-funded earlier), this cost drops significantly.
- **FX spread** — the difference between the mid-market rate we can access (Wise API, or a bank-partner FX desk) and the rate we quote the user. Typically 0.3–1.0% depending on the corridor and volume.
- **Settlement cost** — bank fees on the receiving end (mobile-money bank, agent network, or direct-deposit correspondent bank). Corridor-dependent.
- **Compliance overhead** — KYC re-verification, transaction monitoring, sanctions screening. Doesn't scale linearly per transaction but is a real per-corridor operational cost.

A 1.5–2% member rate needs to cover all four AND leave margin. That math is not runnable until we know:

1. Which corridors we launch in (Phase 2 candidate list).
2. Whether we self-clear FX or partner with Wise/another rail.
3. Whether the funding leg is wallet-only (pre-loaded) or card-permitted.

### What this document commits to

- Cross-border remittance is not launched in Phase 0 or Phase 1.
- The target price is 1.5–2% total member-facing on the corridors we serve.
- We will not launch a remittance corridor at above 3% under any circumstances — that undermines the "beats Western Union" positioning and eliminates the reason for the product.

### When to revise

When the Phase 2 gate is imminent (2,000+ members, cross-border rails scoped), this section becomes its own working document. Not here.

---

## 9. Fee collection and accounting

Every fee — collected or absorbed — is written to the ledger. This section names the shapes so the reconciliation surface (Doc 34 v2 § 7 and mig 351) can carry them without a schema change.

### Ties to Doc 34 v2 (Ledger Design)

`ledger_events` (mig 276) is the append-only append surface for every confirmed Stripe event. Fees add to that surface as new `event_type` values. `wallet_transactions` (`015_payout_execution_engine.sql`) is the wallet-side ledger — fees paid by the member are `direction='debit'` rows; fees absorbed by TandaXn are `direction='credit'` rows against a platform-owned wallet or (more cleanly) NOT written to `wallet_transactions` at all (the cost hits the P&L, not a member wallet — see below).

### Event taxonomy

New `event_type` values on `ledger_events`:

| `event_type` | Meaning | Written from |
|---|---|---|
| `fee.processing` | Stripe processing fee TandaXn absorbed on behalf of a user movement (Phase 0). Amount = the Stripe fee itself; `stripe_fee_cents` column already carries this per mig 279. Duplicated here for taxonomy clarity when the total flow is a single `ledger_events` row. | `stripe-webhook/index.ts` on any `payment_intent.succeeded` or `charge.succeeded` where `stripe_fee_cents > 0`. |
| `fee.absorbed` | Any TandaXn-covered fee that isn't a Stripe processing fee — e.g. a bank withdrawal fee absorbed during Phase 0, or a currency-conversion overhead we cover. | RPC / EF that initiated the covered transfer. |
| `fee.late` | Late contribution fee charged to a member (Section 5). Paired with a `wallet_transactions` debit on the paying member's next contribution. | Circle late-fee trigger (to be created — mirrors the pattern of the refund triggers from mig 309). |
| `fee.withdrawal` | Bank transfer fee passed through to a member on a wallet-to-bank withdrawal (Phase 1+). | Withdrawal RPC. |
| `fee.advance_origination` | Advance/loan origination fee (Phase 1). Owned by Doc 36; listed here for completeness. | Advance disbursement RPC. |
| `fee.advance_interest` | Advance interest, accrued/collected. Owned by Doc 36. | Interest accrual cron. |
| `fee.remittance` | Cross-border remittance fee (Phase 2). Owned by a future doc; listed here for completeness. | Remittance EF. |

### Absorb accounting

Fees TandaXn absorbs land in `ledger_events` with `event_type='fee.processing'` or `event_type='fee.absorbed'`. They do NOT create a member-side `wallet_transactions` debit — the member's wallet balance is unchanged by an absorbed fee. What we do write is the `stripe_fee_cents` field on the parent `ledger_events` row (already there per mig 279), which is what `get_reconciliation_summary` sums into `total_stripe_fees_cents`.

The bookkeeping question of "which cost center takes the P&L hit" is out of scope for this doc — that's an accounting mapping between `ledger_events(event_type='fee.processing')` and a chart-of-accounts entry that finance owns.

### Collected accounting

Fees the member pays (late fee, withdrawal fee, advance origination, remittance) land in `ledger_events` AND in a paired `wallet_transactions` row that debits the member's `main_balance_cents`. The pair is linked via `wallet_transactions.reference_type = 'ledger_events'` + `.reference_id = <ledger_events.id>` or similar. Follow the shape established by mig 278 (`circle_payouts_ledger`) for cross-table linking.

### Reconciliation

Fees are covered by the mig 351 hourly reconciliation sweeper for free — `ledger_events` and `wallet_transactions` are both scanned regardless of `event_type`. No new discrepancy types are needed; a missing `wallet_transactions` debit for a `fee.late` `ledger_events` row would surface as `pi_ledger_missing` under the current taxonomy. (Technically the discrepancy type name is Stripe-flavored; if fee-family discrepancies become common we can widen the taxonomy in a future mig.)

### Reporting

Daily fee summary should be queryable off `ledger_events` directly:

```sql
SELECT event_type, DATE(created_at) AS day,
       COUNT(*) AS n, SUM(amount_cents) AS total_cents
  FROM public.ledger_events
 WHERE event_type LIKE 'fee.%'
   AND created_at >= NOW() - INTERVAL '30 days'
 GROUP BY 1, 2
 ORDER BY 2 DESC, 1;
```

An extension of `get_reconciliation_summary` that adds `total_fees_cents` per fee family is a natural follow-up; scoped for the Phase 1 transition, not launch.

---

## 10. Disclosures and transparency

**Guiding rule: show the price always, even when it's covered.**

The user should never be surprised by a fee, never see a fee that they were told was covered, and never be able to complete a transaction without knowing what the total cost is.

### Display convention by fee family

Copy is EN-facing; French translations should match in structure and be honest about the equivalent local expectations.

| Fee family | Display copy | When shown |
|---|---|---|
| **Processing fee (Phase 0, covered)** | *"Processing fee: $6.83 — covered by TandaXn"* | On the wallet-deposit review screen, before the user confirms the payment intent. Also visible on the resulting activity-feed row. |
| **Payout fee (Phase 0, covered)** | *"Payout fee: $1.00 — covered by TandaXn"* | On the payout confirmation screen when a cycle payout lands to the recipient. |
| **Late fee (Phase 0+)** | *"Late fee: $5.00 — added to your next contribution"* | On the missed-contribution notification, on the next-contribution due screen, and on the eventual wallet-transactions row. |
| **Withdrawal fee (Phase 1+)** | *"Bank transfer fee: $3.00 — deducted from your withdrawal"* | On the withdrawal review screen, before the user confirms. |
| **Advance fee (Phase 1)** | *"Origination fee: 6.0% ($60.00) — deducted from your advance"* | On the SmartCalculator + confirmation screen inside the advance flow. Doc 36 owns the exact copy. |
| **Remittance fee (Phase 2)** | *"Remittance fee: 1.8% ($9.00) — deducted from the amount sent"* | On the remittance review screen. Future doc owns copy. |

### Consent gates

Fees are disclosed **before** any transaction is confirmed. In practice this means:

- Pre-deposit: fee shown on the review screen before `create-payment-intent` is called.
- Pre-withdrawal: fee shown on the review screen before the withdrawal RPC is called.
- Pre-advance: fee shown on SmartCalculator + confirmation before `request_advance` is called.
- Pre-contribution: fee is only shown if the contribution IS late — the on-time case has no fee.
- Pre-remittance: fee shown on the send-money review screen before the remittance EF is called.

The consent gate is a UI concern, not a schema-enforced one. But the pattern is uniform: **no button that spends money is enabled until the fee is on the screen and the user has actively acknowledged it** (either by tapping "Confirm" on a review screen or by ticking a "I understand the fees" checkbox for higher-friction flows like advances).

### Coverage messaging

When a fee is covered, the coverage attribution is explicit. "Covered by TandaXn" is the standard phrasing; "Free during launch" is acceptable as a variant on marketing surfaces. NOT acceptable: hiding the fee entirely, or showing "$0" without attribution — that misrepresents the cost structure and undermines the Phase 1 transition when we eventually pass some fees through.

### Founding-member disclosure

Founding members' commitment (Section 2) is displayed on their profile or account screen as a badge: *"Founding member — rotating circles are free for you, always."* This is both a customer-love feature and a durable structural commitment that any future fee changes must respect.

---

## Closing notes

This document is a **strategy doc**, not a rate card. Every specific rate mentioned above is either a starting point (Section 5's suggested late fee) or a target (Section 8's remittance rate) — not a commitment. The commitments are structural:

- **Phase 0 absorbs processing.** No user pays a card fee to fund their circle. This is durable through Phase 0 and honored permanently for founding members.
- **Every fee is disclosed before it's charged.** No hidden charges, no post-hoc surprises.
- **We beat traditional alternatives on price.** Not by pennies — visibly. That's the wedge.
- **Late fees are a coordination device, not a revenue lever.** Ideally trend toward zero over time as community norms strengthen.
- **Cross-border remittance is a promise but not a launch feature.** Phase 2, when the rails are ready.
- **Goal penalties do not route to charity in the first two phases.** The mechanism is loss-of-upside, not loss-of-principal. Charity reversal is Phase 3+ when compliance is built.
- **Phase transitions require all conditions in Section 0 to be met.** Member count alone is not enough; readiness gates are load-bearing.
- **Runway is the analytical backbone.** Section 3 is where every fee decision gets sized against the funding gap. Fill in the baseline burn placeholders and the "external funding required" number falls out.

Everything else is calibration — settable, revisable, and expected to change as production data comes in.
