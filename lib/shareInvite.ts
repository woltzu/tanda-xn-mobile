import { Share, Alert, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { generateCircleInviteUrl, generateCommunityInviteUrl } from "./deepLinking";

interface ShareCircleInviteParams {
  circleId: string;
  circleName: string;
  circleEmoji: string;
  userId: string;
  userName: string;
  contribution?: number;
  frequency?: string;
  memberCount?: number;
}

interface ShareCommunityInviteParams {
  communityId: string;
  communityName: string;
  communityIcon: string;
  userId: string;
  userName: string;
  memberCount?: number;
}

/**
 * Share a circle invite link
 */
export async function shareCircleInvite({
  circleId,
  circleName,
  circleEmoji,
  userId,
  userName,
  contribution,
  frequency,
  memberCount,
}: ShareCircleInviteParams): Promise<boolean> {
  const inviteUrl = generateCircleInviteUrl(
    circleId,
    circleName,
    circleEmoji,
    userId,
    userName,
    contribution,
    frequency,
    memberCount
  );

  const message = `${userName} invited you to join "${circleName}" ${circleEmoji} on TandaXn!\n\n${
    contribution ? `💰 $${contribution}/${frequency || "month"}\n` : ""
  }${memberCount ? `👥 ${memberCount} members\n` : ""}\nJoin the circle and start saving together:\n${inviteUrl}`;

  try {
    const result = await Share.share({
      message,
      title: `Join ${circleName} on TandaXn`,
      url: Platform.OS === "ios" ? inviteUrl : undefined,
    });

    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error sharing invite:", error);
    return false;
  }
}

/**
 * Share a community invite link
 */
export async function shareCommunityInvite({
  communityId,
  communityName,
  communityIcon,
  userId,
  userName,
  memberCount,
}: ShareCommunityInviteParams): Promise<boolean> {
  const inviteUrl = generateCommunityInviteUrl(
    communityId,
    communityName,
    communityIcon,
    userId,
    userName,
    memberCount
  );

  const message = `${userName} invited you to join "${communityName}" ${communityIcon} on TandaXn!\n\n${
    memberCount ? `👥 ${memberCount.toLocaleString()} members\n` : ""
  }\nJoin the community:\n${inviteUrl}`;

  try {
    const result = await Share.share({
      message,
      title: `Join ${communityName} on TandaXn`,
      url: Platform.OS === "ios" ? inviteUrl : undefined,
    });

    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error sharing invite:", error);
    return false;
  }
}

/**
 * Copy circle invite link to clipboard
 */
export async function copyCircleInviteLink({
  circleId,
  circleName,
  circleEmoji,
  userId,
  userName,
  contribution,
  frequency,
  memberCount,
}: ShareCircleInviteParams): Promise<void> {
  const inviteUrl = generateCircleInviteUrl(
    circleId,
    circleName,
    circleEmoji,
    userId,
    userName,
    contribution,
    frequency,
    memberCount
  );

  await Clipboard.setStringAsync(inviteUrl);
  Alert.alert("Link Copied!", "The invite link has been copied to your clipboard.");
}

/**
 * Copy community invite link to clipboard
 */
export async function copyCommunityInviteLink({
  communityId,
  communityName,
  communityIcon,
  userId,
  userName,
  memberCount,
}: ShareCommunityInviteParams): Promise<void> {
  const inviteUrl = generateCommunityInviteUrl(
    communityId,
    communityName,
    communityIcon,
    userId,
    userName,
    memberCount
  );

  await Clipboard.setStringAsync(inviteUrl);
  Alert.alert("Link Copied!", "The invite link has been copied to your clipboard.");
}

/**
 * Generate a short invite code from circle ID
 */
export function generateInviteCode(circleId: string): string {
  // Take first 8 characters and convert to uppercase
  return circleId.substring(0, 8).toUpperCase();
}

/**
 * Generate QR code data for a circle invite
 */
export function getCircleQRData({
  circleId,
  circleName,
  circleEmoji,
  userId,
  userName,
  contribution,
  frequency,
  memberCount,
}: ShareCircleInviteParams): string {
  return generateCircleInviteUrl(
    circleId,
    circleName,
    circleEmoji,
    userId,
    userName,
    contribution,
    frequency,
    memberCount
  );
}
