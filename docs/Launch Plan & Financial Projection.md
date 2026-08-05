# TandaXn App – Launch Plan & Financial Projection

> Prepared: June 2026  
> Status: Technical foundation complete, ready for community testing.

---

## 1. Overview

TandaXn is a production‑ready fintech‑social mobile app for community‑based savings (Tandas), circles, events, and lending. The app includes:

- Real‑time circle management with contribution, payout, and position tracking.
- XnScore™, Honor Score, and Stress Score to build trust and engagement.
- AI‑powered payout order optimisation and explainable decisions.
- Event creation, dream sharing, and community feed.
- Fully internationalised (EN/FR) with push notifications and telemetry.

The technical debt is minimal, and the codebase is lean (Expo + Supabase). The next step is **user validation** with real communities.

---

## 2. Financial Projection

### 2.1. Cost Structure
- **Hosting & Operations:** ~$200–500/month at moderate scale (few thousand DAU) on Supabase + Edge Functions.
- **Development:** Already built. Ongoing maintenance: low (≤10 hours/month).
- **User Acquisition:** Organic (community referrals) is the primary channel.

### 2.2. Revenue Scenarios
Assuming a **1% transaction fee** on contributions and optional **premium tiers** for advanced features.

| Metric | Conservative | Moderate | Optimistic |
|--------|--------------|----------|------------|
| **Users (DAU) after 6 months** | 200 | 800 | 3,000 |
| **Monthly active circles** | 10 | 40 | 150 |
| **Avg contribution per circle/month** | $1,000 | $2,500 | $5,000 |
| **Transaction fee (1%) revenue/mo** | $100 | $1,000 | $7,500 |
| **Premium revenue (if offered)** | $0 | $500/mo | $3,000/mo |
| **Monthly revenue (total)** | $100 | $1,500 | $10,500 |
| **Yearly revenue (year 1)** | $1,200 | $18,000 | $126,000 |
| **Break‑even** | Likely not | Possibly (if costs <$500/mo) | Yes |

> **To reach $1M+ ARR** would require ~50k DAU and a successful fee+premium model – a 3‑5 year journey if the app gains traction.

### 2.3. Key Financial Insights
- **Acquisition cost vs LTV:** Paid ads are not viable in the short term. Focus on organic, community‑driven acquisition.
- **Break‑even is achievable** in the moderate scenario within 12–18 months if you introduce a premium tier.
- **Network effects are critical:** The app's value grows exponentially with more users per circle. Start with dense, existing communities.

---

## 3. Launch Communities

We have three distinct, motivated groups ready to test the app:

| Community | Use Case | Key Features to Test |
|-----------|----------|----------------------|
| **Ivorian Muslim women** | Rotating savings (Tanda) | Create circle, contribute, payouts, cycle timeline, position visibility |
| **Ivorian community leaders** | Manage multiple circles, oversee members | Admin tools, score system, circle health, AI insights |
| **Trip organisers (2)** | Organise group trips with shared expenses | Create gathering, invite members, track contributions, expense sharing |

---

## 4. Launch Plan – Phase 1 (First 4 Weeks)

### Week 1 – Preparation
- [ ] Add **share sheet** for invite links (WhatsApp, Telegram, SMS).
- [ ] Ensure push notifications are fully working (reminders, cycle updates).
- [ ] Add a **feedback modal** (one‑question survey after first payout).
- [ ] Set up a simple admin dashboard (optional – can be a Supabase view).

### Week 2 – Onboard Women's Circles
- Onboard 3–5 existing Tanda groups (10–15 members each).
- Ask them to run a full cycle (e.g., 4 weeks).
- **Observe:** Onboarding flow, contribution recording, payout accuracy, score usage.

### Week 3 – Onboard Community Leaders
- Give leaders admin access to their circles.
- Test **circle health dashboard**, **member management**, and **AI recommendations**.
- **Ask:** "Does this help you run your community better? What's missing?"

### Week 4 – Onboard Trip Organisers
- Create a "trip" circle or use the **gathering/event** feature.
- Test: creating a trip, inviting members, collecting contributions, tracking expenses.
- **Ask:** "Is this easier than WhatsApp + spreadsheets?"

---

## 5. Feedback Collection Mechanism

### A. In‑App Feedback (Quick Wins)
- **After first payout:** Show a modal: *"How likely are you to recommend this app to a friend?"* (1–5) + optional text field.
- **After 30 days:** Ask: *"What's the one thing we should improve?"*

### B. Weekly Community Calls
- Schedule 15‑min calls with each group leader weekly for qualitative feedback.
- Build trust and identify blockers early.

### C. Admin Metrics (Track Automatically)
- Daily active circles
- Contribution completion rate per cycle
- Cycle completion rate
- User retention at 7, 14, 30 days
- Net Promoter Score (NPS)

---

## 6. Success Metrics for Test Phase (3‑Month Target)

| Metric | Target |
|--------|--------|
| Total test users | ≥ 50 |
| Active circles | ≥ 10 |
| Cycle completion rate | ≥ 80% |
| User retention (30 days) | ≥ 60% |
| Net Promoter Score (NPS) | ≥ 40 (good) |

> If we hit these, we have strong product‑market fit and can consider scaling (paid ads, wider outreach, premium tiers).

---

## 7. Recommendations for the Next 4 Weeks

### Priority 1 – Onboarding & Invite Flow
- Add a **share sheet** so users can invite friends via WhatsApp/Telegram with a pre‑filled deep link (we have the infrastructure; just need the UI).
- Simplify the sign‑up flow to reduce friction (already in good shape).

### Priority 2 – Feedback Loop
- Implement the feedback modal (quick to build).
- Schedule the weekly check‑in calls.

### Priority 3 – Admin Dashboard (Optional but Valuable)
- Build a simple screen for community leaders to see all their circles at a glance (list of circles, member counts, cycle status, pending actions). This could be a new tab in the app or a web view.

### Priority 4 – Trip‑Specific Enhancements
- If trip organisers need expense splitting or itinerary sharing, we can add that after initial feedback.

---

## 8. Next Steps (Immediate Actions)

1. **Finalise the invite/share sheet** – I can help you build this (a simple `Share` button that generates a deep link with circle/community ID).
2. **Add feedback modal** – one‑question survey after first payout.
3. **Prepare onboarding material** – a short guide/video for community leaders on how to set up circles and invite members.
4. **Launch** – start with the women's circles.

---

## 9. Conclusion

TandaXn is technically ready and has a clear path to validation. The three launch communities provide a unique opportunity to test the core use cases (savings, community management, and group events). If the metrics above are met within 3 months, the app has a strong chance of achieving product‑market fit and becoming financially sustainable.

**Your next move:** Choose one of the priority features (share sheet or feedback modal) and let's build it together.

---

_End of document._