// =============================================================================
// config/ai-prompts.ts -- prompt-style -> chat input placeholder copy.
//
// The full AI-chat surface for SyncStream doesn't exist yet; once it
// does, the SyncRoomScreen chat input will read its placeholder from
// here based on room_settings.ai_prompt_style. Adding a real prompt
// template per style (the system prompt the LLM gets) is the
// follow-up; for now this is just the user-facing hint copy.
// =============================================================================

export const AI_PROMPT_PLACEHOLDERS: Record<string, string> = {
  general: "Ask anything about what's playing…",
  post_sermon_discussion: "Share a takeaway from the message…",
  movie_trivia: "Spot something? Drop trivia or a guess…",
  discussion_questions: "What's confusing? Ask for a clarification…",
  q_and_a: "Submit a question for the host…",
};

export function getAiPlaceholder(style: string | null | undefined): string {
  return (style && AI_PROMPT_PLACEHOLDERS[style]) || AI_PROMPT_PLACEHOLDERS.general;
}
