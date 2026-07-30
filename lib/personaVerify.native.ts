// ═══════════════════════════════════════════════════════════════════════════
// lib/personaVerify.native.ts — iOS / Android path
// ═══════════════════════════════════════════════════════════════════════════
//
// Uses @persona-inc/inquiry-react-native SDK. Metro auto-selects this
// file for iOS/Android; personaVerify.ts wins on web (SDK is native-
// only).
//
// Flow:
//   1. Call persona-create-inquiry EF → get inquiryId + sessionToken.
//   2. Hand both to the SDK. It launches Persona's in-app camera flow
//      (ID capture, selfie, liveness check, facial match).
//   3. On complete/canceled/error, resolve the promise. The
//      authoritative outcome comes from the webhook that runs against
//      Persona's servers — this callback only tells us the user
//      dismissed the SDK.
//
// Requires an EAS build (dev-client, preview, or production) — the SDK
// won't work in Expo Go. Run `npx expo install @persona-inc/inquiry-
// react-native` before the next EAS build so package.json + native
// linkage are in sync.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";

export type PersonaResult =
  | { ok: true; kind: "completed"; inquiryId: string; status: string }
  | { ok: true; kind: "canceled"; inquiryId: string }
  | { ok: false; error: string };

export async function startPersonaVerification(): Promise<PersonaResult> {
  // Step 1: create the inquiry on our backend.
  let inquiryId: string;
  let sessionToken: string | null;
  try {
    const { data, error } = await supabase.functions.invoke(
      "persona-create-inquiry",
      { body: {} },
    );
    if (error) return { ok: false, error: error.message };
    if (!data?.inquiryId) {
      return { ok: false, error: "Persona did not return an inquiry id" };
    }
    inquiryId = data.inquiryId as string;
    sessionToken = (data.sessionToken as string | null) ?? null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Step 2: hand off to the SDK. Wrapped in a Promise that resolves on
  // any terminal callback (complete / canceled / error).
  return new Promise<PersonaResult>((resolve) => {
    try {
      // Dynamic require so the web bundle (which uses personaVerify.ts)
      // never touches this file; even under Metro's aggressive
      // resolution this is a safety net for any consumer that manually
      // imports .native.ts.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const persona = require("@persona-inc/inquiry-react-native");
      const InquiryBuilder = persona.Inquiry ?? persona.default?.Inquiry;
      const Environment = persona.Environment ?? persona.default?.Environment;
      if (!InquiryBuilder) {
        resolve({
          ok: false,
          error: "Persona SDK loaded but Inquiry builder not found",
        });
        return;
      }

      const environment = __DEV__
        ? Environment?.SANDBOX ?? "sandbox"
        : Environment?.PRODUCTION ?? "production";

      const builder = InquiryBuilder.fromInquiry(inquiryId, {
        sessionToken: sessionToken ?? undefined,
      })
        .environment(environment)
        .onComplete(
          ({ inquiryId: id, status }: { inquiryId: string; status: string }) => {
            resolve({ ok: true, kind: "completed", inquiryId: id, status });
          },
        )
        .onCanceled(({ inquiryId: id }: { inquiryId: string }) => {
          resolve({ ok: true, kind: "canceled", inquiryId: id });
        })
        .onError((err: unknown) => {
          resolve({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      builder.build().start();
    } catch (e) {
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
