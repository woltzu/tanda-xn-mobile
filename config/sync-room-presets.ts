// =============================================================================
// config/sync-room-presets.ts -- presets per room_type.
//
// Keep in sync with migration 128's back-fill block. The server stores
// per-room overrides in sync_rooms.room_settings JSONB; the client
// applies these presets at create time and falls back to them when
// reading a row whose row_settings doesn't carry a particular key.
//
// Editing this file:
//   * Adding a new room type: add an entry here AND update the CHECK
//     constraint + the back-fill block in a new migration.
//   * Tweaking a setting: bump the version of just that row's stored
//     room_settings via a one-shot UPDATE, or wait for new rooms.
// =============================================================================

export type RoomType =
  | "general"
  | "worship"
  | "movie_night"
  | "study_group"
  | "town_hall";

export type SkipVoterRole = "anyone" | "host_only";

export interface RoomSettings {
  auto_skip_allowed: boolean;
  skip_voter_role: SkipVoterRole;
  reaction_emojis: string[];
  remix_available_post_service: boolean;
  ai_prompt_style: string;
  vibe_labels?: string[];
}

export const DEFAULT_REACTION_EMOJIS = ["👍", "😂", "😮", "❤️", "🔥"];

export const ROOM_TYPE_PRESETS: Record<
  RoomType,
  { label: string; emoji: string; description: string; settings: RoomSettings }
> = {
  general: {
    label: "General",
    emoji: "💬",
    description: "Anyone can vote to skip. Default reactions.",
    settings: {
      auto_skip_allowed: true,
      skip_voter_role: "anyone",
      reaction_emojis: DEFAULT_REACTION_EMOJIS,
      remix_available_post_service: false,
      ai_prompt_style: "general",
    },
  },
  worship: {
    label: "Worship",
    emoji: "🙏",
    description: "Skip disabled. Reverent reactions. Remix after service.",
    settings: {
      auto_skip_allowed: false,
      skip_voter_role: "host_only",
      reaction_emojis: ["🙏", "❤️", "😢", "🕊️"],
      remix_available_post_service: true,
      ai_prompt_style: "post_sermon_discussion",
      vibe_labels: ["reverent", "celebratory", "solemn", "joyful"],
    },
  },
  movie_night: {
    label: "Movie Night",
    emoji: "🎬",
    description: "Majority skip vote. Reactions tuned for movies.",
    settings: {
      auto_skip_allowed: true,
      skip_voter_role: "anyone",
      reaction_emojis: ["😂", "🔥", "💀", "🎬"],
      remix_available_post_service: false,
      ai_prompt_style: "movie_trivia",
    },
  },
  study_group: {
    label: "Study Group",
    emoji: "📚",
    description: "Teacher controls skip. Discussion-style reactions.",
    settings: {
      auto_skip_allowed: true,
      skip_voter_role: "host_only",
      reaction_emojis: ["🙋", "📚", "✨"],
      remix_available_post_service: false,
      ai_prompt_style: "discussion_questions",
    },
  },
  town_hall: {
    label: "Town Hall",
    emoji: "🗳️",
    description: "Host controls skip. Yes / no / vote reactions.",
    settings: {
      auto_skip_allowed: true,
      skip_voter_role: "host_only",
      reaction_emojis: ["👍", "👎", "🗳️"],
      remix_available_post_service: false,
      ai_prompt_style: "q_and_a",
    },
  },
};

/**
 * Merges stored room_settings against the preset for that type, so
 * missing keys on legacy rows still resolve to a usable default. Pass
 * `room.room_type` and `room.room_settings` straight through.
 */
export function resolveRoomSettings(
  type: RoomType | string | null | undefined,
  stored: Partial<RoomSettings> | null | undefined,
): RoomSettings {
  const t = (type as RoomType) in ROOM_TYPE_PRESETS ? (type as RoomType) : "general";
  const preset = ROOM_TYPE_PRESETS[t].settings;
  return {
    auto_skip_allowed:
      stored?.auto_skip_allowed ?? preset.auto_skip_allowed,
    skip_voter_role: stored?.skip_voter_role ?? preset.skip_voter_role,
    reaction_emojis:
      stored?.reaction_emojis && stored.reaction_emojis.length > 0
        ? stored.reaction_emojis
        : preset.reaction_emojis,
    remix_available_post_service:
      stored?.remix_available_post_service ??
      preset.remix_available_post_service,
    ai_prompt_style: stored?.ai_prompt_style ?? preset.ai_prompt_style,
    vibe_labels: stored?.vibe_labels ?? preset.vibe_labels,
  };
}
