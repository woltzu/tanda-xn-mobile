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

      // Main app screens
      MainTabs: {
        screens: {
          Home: "home",
          Circles: "circles",
          Wallet: "wallet",
          Community: "community",
          Profile: "profile",
        },
      },

      // Detail screens
      CircleDetail: "circle/:circleId",
      CommunityHub: "community/:communityId",
      GoalsHub: "goals",
      CreateGoal: "goals/create",
    },
  },
};

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
