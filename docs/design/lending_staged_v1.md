# Doc 36 – Lending Staged (3‑Phase Framing)

**Status:** Approved
**Date:** 2026-07-18
**Scope:** Defines the phased rollout of lending features across the product roadmap.

---

## 1. Overview

**Purpose:** Lending is a core part of TandaXn's sequenced monetization (Doc 35). This document defines the phased introduction of lending products, eligibility, repayment, and regulatory gates – not the rates themselves (those live in `rate_card.md`).

**Guiding Principles:**
1. **Member safety first** – lending products are introduced only when members have built sufficient trust (XnScore, circle history).
2. **Regulatory compliance** – each phase requires a clear regulatory gate before launch.
3. **Transparency** – rates, fees, and terms are disclosed upfront, with no hidden charges.
4. **Incentive alignment** – repayment is automatic from future payouts, minimizing defaults.

---

## 2. Phase 0 – No Lending

**Policy:** No advances, no loans. Members build trust via:
- XnScore (tracked over time)
- Circle Reputation (successful cycles)
- On‑time contribution history

**Duration:** Until MTL (Money Transmitter License) is granted and the advance product is built to spec.

---

## 3. Phase 1 – Advances (Internal)

**Trigger:** MTL granted AND advance product built to spec AND reviewed by lending counsel.

**Products:** Both Circle Boost and Micro Emergency advances launch together.

**Product Scope:**
| Product | Max Advance | Fee | Repayment |
|---------|-------------|-----|-----------|
| Circle Boost | Up to $2,000 | 16.0% | 3–6 months |
| Micro Emergency | Up to $500 | 18.3% | 1–3 months |

*(Rates are in `rate_card.md` and version‑controlled separately.)*

**Eligibility Gates:**
- XnScore ≥ 50
- Minimum account age: 30 days (to prevent immediate churn)
- Completed at least 1 circle cycle
- KYC verified (identity)
- Active member (no late penalties in last 2 cycles)

**Repayment Mechanism:**
- **Primary:** Auto‑deduct from future circle payouts (payouts cover advance + fee).
- **Fallback:** Manual repayment via wallet balance (if payout is smaller than loan balance, or member prepays).

**Risk & Collection:**
- Late payment notifications (in‑app + SMS)
- 5% late fee applied after grace period (grace period set by circle creator)
- Defaults flagged to XnScore and Circle Reputation
- Defaulted advances are written off after 60 days overdue

---

## 4. Phase 2 – Third‑Party Lending

**Trigger:** Phase 1 live for 3+ months with stable default rates (<5%) AND partner lending agreements signed.

**Product Scope:**
- Education loans (larger amounts, flexible terms)
- Small Business loans
- Home Country Mortgage

**Eligibility Gates:**
- XnScore ≥ 70
- Completed 3+ circle cycles
- Total payouts received ≥ $10,000 (internal wallet)
- KYC verified
- Active member (no defaults in last 6 months)

**Repayment:**
- Administered via partner lender (TandaXn acts as referral/origination platform).
- TandaXn earns a referral fee or origination fee (governed by Doc 35).

**Risk & Collection:**
- Partner lender handles underwriting, servicing, and collection.
- TandaXn provides data (XnScore, payout history) for loan decisions.

---

## 5. Phase 3 – Direct Lending (Licensed)

**Trigger:** Phase 2 live for 6+ months AND TandaXn holds its own lending license (or equivalent state licensing).

**Product Scope:**
- Full suite of direct lending products (Circle Boost, Micro Emergency, Education, Small Business, Mortgage, Remittance‑backed loans)
- Underwriting and servicing in‑house

**Eligibility:**
- XnScore ≥ 80
- Completed 5+ circle cycles
- Full KYC + income verification (if required)

**Repayment:**
- Auto‑deduct from payouts, wallet balance, or manual installments.
- Full servicing (late fees, collections, charge‑offs) managed in‑house.

**Regulatory & Compliance:**
- Full licensing (MTL, lending license, and any state‑specific requirements).
- Regular audits and compliance reviews.

---

## 6. Eligibility Framework (Summary)

| Phase | Products | XnScore Req | Circle History | KYC | Other |
|-------|----------|-------------|----------------|-----|-------|
| Phase 0 | None | – | – | – | – |
| Phase 1 | Advances (2 products) | ≥ 50 | 1+ completed cycle | Verified | 30+ days active |
| Phase 2 | Third‑party loans | ≥ 70 | 3+ cycles | Verified | $10k+ payouts |
| Phase 3 | Direct lending | ≥ 80 | 5+ cycles | Verified + income | Full licensing |

---

## 7. Regulatory Gates

| Phase | Gate | Status |
|-------|------|--------|
| Phase 0 → 1 | MTL granted | In flight |
| Phase 1 → 2 | Partner lending agreements signed | Not started |
| Phase 2 → 3 | TandaXn holds lending license | Not started |

**Gate‑keeping rule:** A phase transition requires ALL conditions in the relevant Section 0 (Doc 35) to be met. Member‑count alone is not a trigger.

---

## 8. Risk Management

| Risk | Mitigation |
|------|------------|
| Defaults | Auto‑deduct from payouts, XnScore penalties, late fees |
| Collections | In‑app notifications, SMS reminders, escalation to collections in Phase 2+ |
| Fraud | Identity verification, KYC, and member reputation tracking |
| Regulatory | Phase gates and licensing before product launch |
| Operational | Manual fallback for repayments (prepayment or small balances) |

---

## 9. Product Inventory

| Product | Phase | Max Amount | Eligibility (XnScore) |
|---------|-------|------------|-----------------------|
| Circle Boost | 1 | $2,000 | ≥ 50 |
| Micro Emergency | 1 | $500 | ≥ 50 |
| Education | 2 | $5,000 | ≥ 70 |
| Small Business | 2 | $10,000 | ≥ 70 |
| Home Country Mortgage | 2 | $100,000 | ≥ 90 |
| (Future products) | 3 | TBD | ≥ 80 |

**Rates and fees are in `rate_card.md` and version‑controlled separately.**

---

## 10. Dependencies

| Dependency | Link |
|------------|------|
| **Doc 34 – Ledger Design** | Lending advances are recorded as `ledger_events` with `event_type = 'fee.advance_origination'` and `'fee.advance_interest'`. |
| **Doc 35 – Fee Strategy** | Lending fees are referenced in Doc 35 as "governed by Doc 36." |
| **Rate Card** | `rate_card.md` stores specific rates and fees for all lending products. |

---

## 11. Rate Card Reference

The `rate_card.md` document (version‑controlled separately from this doc) contains:
- Advance fees per product (e.g., Circle Boost 16.0%)
- Late fees (5% + 1%/day)
- Processing fees (covered by TandaXn in Phase 0)
- Remittance fees (target 1.5–2%)
- Any future product fees

**This document (Doc 36) references `rate_card.md` by name and does not embed rates or fees.**

---

## 12. Next Steps

1. **Review this draft** – provide feedback or request changes.
2. **Finalize and commit** – once approved, stage `docs/design/lending_staged_v1.md` (or similar filename).
3. **Populate `rate_card.md`** – start with Phase 1 rates and update as products launch.
