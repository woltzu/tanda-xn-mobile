# Tier 4 RLS Hardening — Diagnostic (read-only)

**Scope:** find all RLS policies in `public` schema where `USING (qual) = 'true'`. 
These are the `rls_policy_always_true` WARN lints carried over from the May 6 Tier 3 sweep.
RLS is enabled on the table but the rule lets everyone through.

**Methodology:** mirrors Tier 3 — diagnostic first, batch review with user, then per-batch SQL with verification. 
This document is the diagnostic step. **No schema changes have been made.**

---

## Headline numbers

| Metric | Value |
|---|---|
| Policies with `qual='true'` | **70** |
| Distinct tables affected | **59** |
| Suggested **A** (scope to owner) | 18 |
| Suggested **B** (service-role only) | 26 |
| Suggested **C** (genuinely public read) | 7 |
| ❓ Needs manual review | 19 |

CLAUDE.md noted 41 such lints after Tier 3. Today's count: **70** — differs by 29.

---

## Classification framework (per CLAUDE.md Tier 4 plan)

| Letter | Meaning | Example fix |
|--------|---------|-------------|
| **A** | Replace with scoped condition | `USING (auth.uid() = user_id)` |
| **B** | Restrict to service-role only | `USING (auth.role() = 'service_role')` |
| **C** | Document and keep as public-read | reference/seed data already published; leave as `true` and add a code comment |
| **?** | No obvious owner column — manual review needed | _read the table's purpose, decide A/B/C_ |

---

## Suggested classification — pre-grouped for batch review

### Group A — Scope to owner (user_id / member_id / circle_id / community_id)  (18 policies)

| Table | Policy | Cmd | Roles | Peers | Rows | Hint | Why suggested |
|---|---|---|---|---|---|---|---|
| `circle_invitations` | `Anyone can view invitations` | SELECT | authenticated | 1/2 true | 0 | circle_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `circle_members` | `circle_members_select` | SELECT | public | 1/3 true | 8 | user_id, circle_id | has user_id — scope USING to `auth.uid() = user_id` |
| `circles` | `circles_select` | SELECT | public | 1/3 true | 4 | community_id | has community_id — scope USING to membership check (EXISTS on community_memberships) |
| `community_arrivals` | `arrivals_member_select` | SELECT | authenticated | 2/3 true | 0 | user_id, community_id | has user_id — scope USING to `auth.uid() = user_id` |
| `community_circles` | `Anyone can view community circles` | SELECT | authenticated | 1/1 true | 0 | circle_id, community_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `community_feed_items` | `feed_member_select` | SELECT | authenticated | 2/2 true | 0 | community_id | has community_id — scope USING to membership check (EXISTS on community_memberships) |
| `community_gatherings` | `gatherings_member_select` | SELECT | authenticated | 2/4 true | 0 | circle_id, community_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `community_health_scores` | `health_scores_select` | SELECT | public | 1/1 true | 0 | community_id | has community_id — scope USING to membership check (EXISTS on community_memberships) |
| `community_leaderboard_snapshots` | `leaderboard_select` | SELECT | public | 1/1 true | 0 | community_id | has community_id — scope USING to membership check (EXISTS on community_memberships) |
| `community_members` | `Anyone can view community members` | SELECT | authenticated | 1/3 true | 0 | user_id, community_id | has user_id — scope USING to `auth.uid() = user_id` |
| `community_post_likes` | `likes_member_select` | SELECT | authenticated | 2/4 true | 0 | user_id | has user_id — scope USING to `auth.uid() = user_id` |
| `dispute_cases` | `Allow all for dispute_cases` | ALL | public | 1/1 true | 0 | circle_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `elder_council_votes` | `council_votes_select` | SELECT | public | 1/1 true | 0 | community_id | has community_id — scope USING to membership check (EXISTS on community_memberships) |
| `gathering_rsvps` | `rsvps_member_select` | SELECT | authenticated | 2/5 true | 0 | user_id | has user_id — scope USING to `auth.uid() = user_id` |
| `invited_members` | `invited_members_select` | SELECT | public | 1/2 true | 7 | circle_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `pool_circle_exposure` | `exposure_public_read` | SELECT | public | 1/2 true | 0 | circle_id | has circle_id — scope USING to membership check (EXISTS on circle_members) |
| `provider_accounts` | `Allow all for provider_accounts` | ALL | public | 1/1 true | 0 | user_id | has user_id — scope USING to `auth.uid() = user_id` |
| `xn_scores` | `xnscores_others_limited` | SELECT | public | 1/2 true | 0 | user_id | has user_id — scope USING to `auth.uid() = user_id` |

### Group B — Service-role only  (26 policies)

| Table | Policy | Cmd | Roles | Peers | Rows | Hint | Why suggested |
|---|---|---|---|---|---|---|---|
| `community_arrivals` | `arrivals_service_all` | ALL | service_role | 2/3 true | 0 | user_id, community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_direct_messages` | `dm_service_all` | ALL | service_role | 1/4 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_feed_items` | `feed_service_all` | ALL | service_role | 2/2 true | 0 | community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_gatherings` | `gatherings_service_all` | ALL | service_role | 2/4 true | 0 | circle_id, community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_memory` | `memory_service_all` | ALL | service_role | 1/3 true | 0 | community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_post_comments` | `comments_service_all` | ALL | service_role | 2/3 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_post_likes` | `likes_service_all` | ALL | service_role | 2/4 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_posts` | `posts_service_all` | ALL | service_role | 1/4 true | 0 | community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `community_welcomes` | `welcomes_service_all` | ALL | service_role | 2/3 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `cron_job_logs` | `cron_job_logs_read` | SELECT | authenticated | 2/2 true | 0 | — | looks like internal/system table — likely service_role only |
| `cron_job_logs` | `cron_job_logs_service_only` | ALL | public | 2/2 true | 0 | — | looks like internal/system table — likely service_role only |
| `dream_feed` | `dream_service_all` | ALL | service_role | 1/3 true | 0 | user_id, community_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `gathering_rsvps` | `rsvps_service_all` | ALL | service_role | 2/5 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `marketplace_providers` | `service_all` | ALL | service_role | 1/2 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `member_behavioral_profiles` | `member_behavioral_profiles_service_all` | ALL | service_role | 1/2 true | 5 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `member_network_metrics` | `member_network_metrics_service_all` | ALL | service_role | 1/2 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `member_profile_snapshots` | `member_profile_snapshots_service_all` | ALL | service_role | 1/2 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `member_risk_indicators` | `member_risk_indicators_service_all` | ALL | service_role | 1/2 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `member_session_analytics` | `member_session_analytics_service_all` | ALL | service_role | 1/2 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `migration_audit_log` | `migration_audit_authenticated_select` | SELECT | authenticated | 2/2 true | 0 | — | looks like internal/system table — likely service_role only |
| `migration_audit_log` | `migration_audit_service_all` | ALL | service_role | 2/2 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `migration_screens` | `migration_screens_service_all` | ALL | service_role | 2/2 true | 44 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `migration_wave_status` | `migration_wave_service_all` | ALL | service_role | 2/2 true | 3 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `near_you_connections` | `connections_service_all` | ALL | service_role | 1/4 true | 0 | — | policy name suggests service-role-only by design (Tier 3 carryover) |
| `near_you_profiles` | `near_you_service_all` | ALL | service_role | 1/3 true | 0 | user_id | policy name suggests service-role-only by design (Tier 3 carryover) |
| `vouch_events` | `vouch_events_select` | SELECT | public | 1/2 true | 0 | circle_id | looks like internal/system table — likely service_role only |

### Group C — Public-read by design (reference data)  (7 policies)

| Table | Policy | Cmd | Roles | Peers | Rows | Hint | Why suggested |
|---|---|---|---|---|---|---|---|
| `dissolution_trigger_config` | `dissolution_trigger_config_read` | SELECT | authenticated | 1/1 true | 10 | — | looks like reference/config data — likely intentionally public-read |
| `interest_calculation_config` | `config_public_read` | SELECT | public | 1/1 true | 10 | — | looks like reference/config data — likely intentionally public-read |
| `intervention_rules` | `rules_public_read` | SELECT | public | 1/2 true | 5 | — | looks like reference/config data — likely intentionally public-read |
| `market_index_rates` | `index_rates_public_read` | SELECT | public | 1/1 true | 3 | — | looks like reference/config data — likely intentionally public-read |
| `payout_algorithm_config` | `payout_algorithm_config_read` | SELECT | authenticated | 1/1 true | 1 | circle_id, community_id | looks like reference/config data — likely intentionally public-read |
| `savings_goal_types` | `savings_goal_types_read` | SELECT | authenticated | 1/2 true | 7 | — | looks like reference/config data — likely intentionally public-read |
| `xn_score_factor_components` | `factor_components_public_read` | SELECT | public | 1/1 true | 17 | — | looks like reference/config data — likely intentionally public-read |

### Group ? — Needs manual review  (19 policies)

| Table | Policy | Cmd | Roles | Peers | Rows | Hint | Why suggested |
|---|---|---|---|---|---|---|---|
| `community_post_comments` | `comments_member_select` | SELECT | authenticated | 2/3 true | 0 | — | no obvious ownership column — needs manual review |
| `community_welcomes` | `welcomes_member_select` | SELECT | authenticated | 2/3 true | 0 | — | no obvious ownership column — needs manual review |
| `exchange_rates` | `Anyone can view exchange rates` | SELECT | authenticated | 1/1 true | 0 | — | no obvious ownership column — needs manual review |
| `expertise_domains` | `expertise_domains_select_all` | SELECT | public | 1/2 true | 8 | — | no obvious ownership column — needs manual review |
| `intervention_templates` | `templates_public_read` | SELECT | public | 1/2 true | 8 | — | no obvious ownership column — needs manual review |
| `liquidity_pool` | `pool_public_read` | SELECT | public | 1/2 true | 1 | — | no obvious ownership column — needs manual review |
| `market_insights` | `market_insights_public_read` | SELECT | public | 1/2 true | 64 | — | no obvious ownership column — needs manual review |
| `migration_screens` | `migration_screens_authenticated_select` | SELECT | authenticated | 2/2 true | 44 | — | no obvious ownership column — needs manual review |
| `migration_wave_status` | `migration_wave_authenticated_select` | SELECT | authenticated | 2/2 true | 3 | — | no obvious ownership column — needs manual review |
| `mood_keywords` | `mood_kw_select` | SELECT | public | 1/2 true | 36 | — | no obvious ownership column — needs manual review |
| `payment_provider_transactions` | `Allow all for payment_provider_transactions` | ALL | public | 1/1 true | 0 | — | no obvious ownership column — needs manual review |
| `pool_utilization_snapshots` | `snapshots_public_read` | SELECT | public | 1/2 true | 0 | — | no obvious ownership column — needs manual review |
| `profiles` | `profiles_select` | SELECT | public | 1/4 true | 6 | — | no obvious ownership column — needs manual review |
| `score_benefits` | `Anyone can view score benefits` | SELECT | authenticated | 1/1 true | 6 | — | no obvious ownership column — needs manual review |
| `scoring_pipeline_runs` | `Authenticated users can read pipeline runs` | SELECT | authenticated | 1/1 true | 5 | — | no obvious ownership column — needs manual review |
| `store_reviews` | `reviews_member_select` | SELECT | public | 1/4 true | 0 | — | no obvious ownership column — needs manual review |
| `store_services` | `store_services_public_read` | SELECT | public | 1/2 true | 0 | — | no obvious ownership column — needs manual review |
| `stress_keywords` | `stress_keywords_select` | SELECT | public | 1/2 true | 31 | — | no obvious ownership column — needs manual review |
| `training_courses` | `Anyone can view courses` | SELECT | authenticated | 1/1 true | 0 | — | no obvious ownership column — needs manual review |

---

## Per-table detail

Grouped by table so each batch can target related policies together.

| Table | # true policies | Total policies on table | Row count | Has owner col? |
|---|---|---|---|---|
| `circle_invitations` | 1 | 2 | 0 | circle_id |
| `circle_members` | 1 | 3 | 8 | user_id, circle_id |
| `circles` | 1 | 3 | 4 | community_id |
| `community_arrivals` | 2 | 3 | 0 | user_id, community_id |
| `community_circles` | 1 | 1 | 0 | circle_id, community_id |
| `community_direct_messages` | 1 | 4 | 0 | — |
| `community_feed_items` | 2 | 2 | 0 | community_id |
| `community_gatherings` | 2 | 4 | 0 | circle_id, community_id |
| `community_health_scores` | 1 | 1 | 0 | community_id |
| `community_leaderboard_snapshots` | 1 | 1 | 0 | community_id |
| `community_members` | 1 | 3 | 0 | user_id, community_id |
| `community_memory` | 1 | 3 | 0 | community_id |
| `community_post_comments` | 2 | 3 | 0 | — |
| `community_post_likes` | 2 | 4 | 0 | user_id |
| `community_posts` | 1 | 4 | 0 | community_id |
| `community_welcomes` | 2 | 3 | 0 | — |
| `cron_job_logs` | 2 | 2 | 0 | — |
| `dispute_cases` | 1 | 1 | 0 | circle_id |
| `dissolution_trigger_config` | 1 | 1 | 10 | — |
| `dream_feed` | 1 | 3 | 0 | user_id, community_id |
| `elder_council_votes` | 1 | 1 | 0 | community_id |
| `exchange_rates` | 1 | 1 | 0 | — |
| `expertise_domains` | 1 | 2 | 8 | — |
| `gathering_rsvps` | 2 | 5 | 0 | user_id |
| `interest_calculation_config` | 1 | 1 | 10 | — |
| `intervention_rules` | 1 | 2 | 5 | — |
| `intervention_templates` | 1 | 2 | 8 | — |
| `invited_members` | 1 | 2 | 7 | circle_id |
| `liquidity_pool` | 1 | 2 | 1 | — |
| `market_index_rates` | 1 | 1 | 3 | — |
| `market_insights` | 1 | 2 | 64 | — |
| `marketplace_providers` | 1 | 2 | 0 | — |
| `member_behavioral_profiles` | 1 | 2 | 5 | user_id |
| `member_network_metrics` | 1 | 2 | 0 | user_id |
| `member_profile_snapshots` | 1 | 2 | 0 | user_id |
| `member_risk_indicators` | 1 | 2 | 0 | user_id |
| `member_session_analytics` | 1 | 2 | 0 | user_id |
| `migration_audit_log` | 2 | 2 | 0 | — |
| `migration_screens` | 2 | 2 | 44 | — |
| `migration_wave_status` | 2 | 2 | 3 | — |
| `mood_keywords` | 1 | 2 | 36 | — |
| `near_you_connections` | 1 | 4 | 0 | — |
| `near_you_profiles` | 1 | 3 | 0 | user_id |
| `payment_provider_transactions` | 1 | 1 | 0 | — |
| `payout_algorithm_config` | 1 | 1 | 1 | circle_id, community_id |
| `pool_circle_exposure` | 1 | 2 | 0 | circle_id |
| `pool_utilization_snapshots` | 1 | 2 | 0 | — |
| `profiles` | 1 | 4 | 6 | — |
| `provider_accounts` | 1 | 1 | 0 | user_id |
| `savings_goal_types` | 1 | 2 | 7 | — |
| `score_benefits` | 1 | 1 | 6 | — |
| `scoring_pipeline_runs` | 1 | 1 | 5 | — |
| `store_reviews` | 1 | 4 | 0 | — |
| `store_services` | 1 | 2 | 0 | — |
| `stress_keywords` | 1 | 2 | 31 | — |
| `training_courses` | 1 | 1 | 0 | — |
| `vouch_events` | 1 | 2 | 0 | circle_id |
| `xn_score_factor_components` | 1 | 1 | 17 | — |
| `xn_scores` | 1 | 2 | 0 | user_id |

---

## Risk notes before batch execution

- **Group A risk:** tightening RLS from `true` to `auth.uid() = user_id` could break flows where 
  the app code expects to read other users' rows (e.g., circle members viewing each other). 
  For each Group A table, confirm:
  1. Is the access pattern "users only see their own rows"? → safe scope
  2. Or "members of a circle/community can see each other"? → need EXISTS join instead
- **Group B risk:** if the app reads a Group B table from authenticated context (not just edge 
  functions / cron), the read will start failing.
- **Group C risk:** policies left as `true` keep the lint. Acceptable IF the table truly should 
  be public-read; add `COMMENT ON POLICY ... IS 'intentional — reference data'`.

- **Tier 3 carryover (`marketplace_providers.service_all`):** per CLAUDE.md this is intentional 
  and may just need a re-classification (B) plus a documentary comment, not a USING rewrite.

---

## Recommended next step (NOT YET EXECUTED)

1. **You review the per-policy table above** and confirm or override each suggested letter.
2. We then split into 3–5 batches of ~10 policies each, by topic (auth-flow tables, scoring tables, 
   community tables, reference tables, etc.).
3. For each batch:
   - Generate one SQL transaction with the rewrites
   - Dry-run review here in chat
   - Execute via Management API
   - Smoke test the affected app screens
   - Tag (`stable-2026-05-XX-rls-tier4-batch-N`)

---

_Diagnostic generated 2026-05-20. 70 policies on 59 tables. 
No schema changes made._