import * as Linking from "expo-linking";
import { InviteData } from "../context/OnboardingContext";

// URL scheme configuration
export const DEEP_LINK_PREFIX = Linking.createURL("/");
export const WEB_LINK_PREFIXES = [
  "https://tandaxn.com",
  "https://v0-tanda-xn.vercel.app",
];

// Deep link path patterns
export const LINK_PATHS = {
  // Circle invites: /invite/circle/:circleId
  CIRCLE_INVITE: "invite/circle",
  // Community invites: /invite/community/:communityId
  COMMUNITY_INVITE: "invite/community",
  // Email verification callback
  AUTH_CALLBACK: "auth/callback",
  // Password reset
  RESET_PASSWORD: "auth/reset-password",
};

// Linking configuration for React Navigation
export const linkingConfig = {
  prefixes: [DEEP_LINK_PREFIX, ...WEB_LINK_PREFIXES],
  config: {
    screens: {
      // Auth screens
      Login: "login",
      Signup: "signup",
      ForgotPassword: "forgot-password",
      ResetPassword: "reset-password",
      EmailVerification: "verify-email",
      AuthCallback: "auth/confirm",

      // Invite screens
      CircleInvite: "invite/circle/:circleId",
      CommunityInvite: "invite/community/:communityId",
      // Public frictionless join — unauthenticated, invite-code based
      QuickJoin: "join/:inviteCode",
      // Magic-link landing after QuickJoin email confirmation
      JoinConfirm: "join-confirm",
      // Optional password setup screen reachable directly at /set-password
      SetPassword: "set-password",

      // Main app tabs — must match App.tsx <Tab.Navigator>.
      // Actual tab routes are: Home, Circles, Action, Market, Community.
      // (Earlier versions of this config listed Dreams/Wallet/Profile as tabs;
      // those are not tabs and the URLs silently failed — fixed 2026-05-20.)
      MainTabs: {
        screens: {
          Home: "home",
          Circles: "circles",
          Action: "action",
          Market: "market",
          Community: "community",
        },
      },

      // Detail screens (registered on the root Stack, navigable from anywhere)
      CircleDetail: "circle/:circleId",
      // Cycle Timeline — Bucket C of the cycle audit. Lets notifications
      // (cycle_started / contribution_due / payout_ready / cycle_closed)
      // route the user straight to the timeline for the relevant circle.
      CycleTimeline: "timeline/:circleId",
      CommunityHub: "community/:communityId",
      GoalsHub: "goals",
      CreateGoal: "goals/create",

      // Dream feed (root Stack screens — also reachable via HomeStack at runtime;
      // putting them top-level here means /dreams URLs load without a tab bar.
      // If you want the tab bar visible, nest these under MainTabs.Home.screens later.)
      DreamFeed: "dreams",
      // PostDetail accepts an optional `?focusComment=1` query string —
      // React Navigation's linking auto-merges query params into route
      // params alongside the :postId path param, so a notification
      // CTA like `dreams/post/abc123?focusComment=1` lands on
      // PostDetail with { postId: 'abc123', focusComment: '1' }
      // without any extra parser code. PostDetailScreen reads it via
      // route.params.focusComment (VDF Bucket B.3) to autoFocus the
      // sticky comment input on mount.
      PostDetail: "dreams/post/:postId",
      UserDreamProfile: "dreams/user/:userId",
      // Create-a-dream-post Bucket C.5 — deep link to the composer.
      // Lets the dream_post_supported notification (or a future
      // "share an update" nudge) route straight into the create flow.
      // No params today; future iterations can carry a template key
      // to pre-fill the caption.
      CreateDreamPost: "dreams/create",

      // Stripe posts users back to tandaxn://stripe-redirect after a
      // redirect-based PaymentSheet method (Klarna, Cash App Pay,
      // Amazon Pay, iDEAL) or a 3-D Secure challenge. The screen
      // holds the UI still while the SDK resolves the intent, then
      // pops back — see screens/StripeRedirectScreen.tsx.
      StripeRedirect: "stripe-redirect",

      // Wallet / Profile / Settings (root Stack screens)
      WalletMain: "wallet",
      ProfileMain: "profile",
      Settings: "settings",

      // XnScore Dashboard — Bucket C of the XnScore review. Lets the
      // xnscore_tier_change notification (migration 213) route the user
      // straight to their score. userId is optional; when absent the
      // screen reads the auth context (own profile).
      XnScoreDashboard: "xnscore/:userId?",

      // Honor Score Overview — Bucket C of the Honor review. Lets the
      // honor_tier_change notification (migration 214) route straight
      // to the overview. userId optional; absent = own profile.
      HonorScoreOverview: "honor/:userId?",

      // Phase 2 Bucket A — governance routes. Both gated by elder
      // role server-side (the RPCs raise for non-elders), so deep-link
      // hits from non-elders land on the screen's "Elder-only" guard.
      ElderNominations: "governance/nominations",
      IssueExposureVouch: "governance/vouch/:memberId?",

      // Phase 2 Bucket B — Resolution Center. Lets critical-tier
      // member notifications (future trigger) route the user straight
      // to the resolution flow.
      ResolutionCenter: "resolution",

      // Stress Score Dashboard — Bucket C of the Stress review. Lets
      // the stress_status_change and stress_intervention_offered
      // notifications (migration 215) route straight to the dashboard.
      // userId optional; absent = own profile.
      StressScoreDashboard: "stress/:userId?",

      // Mood Insights — Bucket C of the Mood review. Lets the
      // mood_drift_change and mood_intervention_offered notifications
      // (migration 216) route straight to the dashboard.
      // userId optional; absent = own profile.
      MoodInsights: "mood/:userId?",

      // Credit Profile — Bucket C of the Credit Profile review. Lets
      // loan_disbursed / loan_payment_recorded / loan_overdue /
      // loan_application_status notifications (migration 220) route
      // straight to the profile. userId optional; absent = own profile.
      CreditProfile: "credit/:userId?",

      // Post to Community — Bucket C of the Post to Community review.
      // The community_post_created / community_post_liked /
      // community_post_commented notifications (migration 221) deep-link
      // straight to a post via the existing PostDetail route registered
      // above at `dreams/post/:postId`. PostDetail renders any
      // feed_posts row regardless of type, so a community-post-specific
      // alias here is intentionally NOT registered — React Navigation
      // linking only accepts one path per screen, and overloading
      // PostDetail with a second path would silently overwrite the
      // existing dream-feed path. Notification handlers should build
      // the deep link as `/dreams/post/<id>` for any post type.

      // Create an event — Bucket C of the Create an event review. Lets
      // the event_created (migration 223) and future event_reminder_24h
      // notifications route straight to the events list. eventId is
      // optional; current EventsScreen does not yet auto-open the
      // bottom sheet for a specific event — that's a tracked follow-up.
      // The route is registered at root level (mirroring CommunityHub)
      // so the URL loads even when the user isn't on the Community tab.
      Events: "event/:eventId?",

      // Host a gathering — Bucket C of the Host-a-gathering review. Lets
      // future notifications (gathering_created via migration 231,
      // gathering_reminder_24h via migration 232's cron + Edge Function)
      // route the user straight into the create flow. communityId is
      // optional — if a push payload omits it, the screen treats the
      // empty string as missing and createGathering will short-circuit
      // (showToast on the empty-communityId guard). Future iteration
      // can route the deep link to a CommunityPicker first when the
      // communityId is absent. The route is registered at root level
      // so the URL loads regardless of which tab the user is on.
      CreateGathering: "gatherings/create/:communityId?",

      // Trip public page — Bucket A.5 of the Create-a-trip wizard audit.
      // The wizard generates a `shareable_slug` on publish (migration 066
      // added the slug column + unique index). Sharing that URL needs a
      // route on this side to land on TripPublicPage with the slug
      // parameter. App.tsx registers `TripPublicPage` accepting
      // { slug?: string; tripId?: string } — slug is what we use here.
      // Bucket C will add organizer/participant/payment notifications
      // that deep-link into this same path.
      TripPublicPage: "trip/:slug",
      // Member-trip-status Bucket C.5 — deep link to a participant's trip
      // dashboard. trip_payment_due / trip_payment_late /
      // trip_payment_reminder_unpaid / trip_participant_confirmed pushes
      // can now route the user straight to their own status screen.
      MyTripStatus: "trips/my/:tripId",
      // Publish-trip Bucket A.1 — alias for the plural URL form.
      // TripPublishSuccessScreen historically generated share links with
      // `tandaxn.com/trips/${slug}` (plural). Any link already shared in
      // the wild from before A.2 would dead-end if we don't catch it.
      // Same screen component, different route name so React Navigation
      // accepts both linking entries (one URL pattern per route name).
      // `generateTripShareUrl` below emits the singular form going forward.
      TripPublicPageAlt: "trips/:slug",
    },
  },
};

// ─── Trip share URLs ─────────────────────────────────────────────────────────
// Publish-trip Bucket A.1 — single canonical builder used by every share
// surface (TripPublishSuccessScreen, TripPublicPage hero, future
// OrganizerTripDashboard share tile). Emits the singular `/trip/<slug>`
// path so the link resolves via the `TripPublicPage` linking entry above.
// The plural form is still accepted on incoming traffic via `TripPublicPageAlt`.
export function generateTripShareUrl(slug: string): string {
  return `${WEB_LINK_PREFIXES[0]}/trip/${slug}`;
}

// Parse invite URL and extract data
export function parseInviteUrl(url: string): InviteData | null {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path || "";
    const params = parsed.queryParams || {};

    // Circle invite: /invite/circle/:id?name=...&emoji=...&inviter=...
    if (path.startsWith("invite/circle/")) {
      const circleId = path.replace("invite/circle/", "");
      return {
        type: "circle",
        id: circleId,
        name: (params.name as string) || "Savings Circle",
        emoji: (params.emoji as string) || "💰",
        invitedBy: (params.inviter as string) || "",
        inviterName: (params.inviterName as string) || "A friend",
        contribution: params.contribution ? Number(params.contribution) : undefined,
        frequency: (params.frequency as string) || "monthly",
        members: params.members ? Number(params.members) : undefined,
      };
    }

    // Community invite: /invite/community/:id?name=...&icon=...
    if (path.startsWith("invite/community/")) {
      const communityId = path.replace("invite/community/", "");
      return {
        type: "community",
        id: communityId,
        name: (params.name as string) || "Community",
        emoji: (params.icon as string) || "👥",
        invitedBy: (params.inviter as string) || "",
        inviterName: (params.inviterName as string) || "A friend",
        members: params.members ? Number(params.members) : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing invite URL:", error);
    return null;
  }
}

// Generate invite URL for sharing
export function generateCircleInviteUrl(
  circleId: string,
  circleName: string,
  circleEmoji: string,
  inviterId: string,
  inviterName: string,
  contribution?: number,
  frequency?: string,
  memberCount?: number
): string {
  const baseUrl = WEB_LINK_PREFIXES[0]; // Use primary domain
  const params = new URLSearchParams({
    name: circleName,
    emoji: circleEmoji,
    inviter: inviterId,
    inviterName: inviterName,
  });

  if (contribution) params.set("contribution", contribution.toString());
  if (frequency) params.set("frequency", frequency);
  if (memberCount) params.set("members", memberCount.toString());

  return `${baseUrl}/invite/circle/${circleId}?${params.toString()}`;
}

export function generateCommunityInviteUrl(
  communityId: string,
  communityName: string,
  communityIcon: string,
  inviterId: string,
  inviterName: string,
  memberCount?: number
): string {
  const baseUrl = WEB_LINK_PREFIXES[0];
  const params = new URLSearchParams({
    name: communityName,
    icon: communityIcon,
    inviter: inviterId,
    inviterName: inviterName,
  });

  if (memberCount) params.set("members", memberCount.toString());

  return `${baseUrl}/invite/community/${communityId}?${params.toString()}`;
}

// Handle initial URL when app opens from link
export async function getInitialURL(): Promise<string | null> {
  const url = await Linking.getInitialURL();
  return url;
}

// Subscribe to incoming links while app is open
export function subscribeToLinks(callback: (url: string) => void) {
  const subscription = Linking.addEventListener("url", ({ url }) => {
    callback(url);
  });

  return () => subscription.remove();
}
