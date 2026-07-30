// ═══════════════════════════════════════════════════════════════════════════
// lib/personaVerify.ts — WEB path (react-native-web target)
// ═══════════════════════════════════════════════════════════════════════════
//
// Persona's React Native SDK (@persona-inc/inquiry-react-native) is a
// native module — importing it in a web bundle breaks the build.
// Metro auto-selects THIS file for the web target (extension: .ts)
// while personaVerify.native.ts wins on iOS/Android.
//
// Web flow: open the Persona hosted verification URL in a new browser
// tab. Persona's webhook fires on completion regardless of which
// surface (SDK or hosted) the user used. The client-side callback
// mechanism here just tells us the user LEFT for the hosted flow — the
// authoritative outcome comes from the webhook once Persona finishes.
// ═══════════════════════════════════════════════════════════════════════════

import { Linking } from "react-native";
import { supabase } from "./supabase";

export type PersonaResult =
  | { ok: true; kind: "web_opened"; inquiryId: string; hostedUrl: string }
  | { ok: false; error: string };

export async function startPersonaVerification(): Promise<PersonaResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "persona-create-inquiry",
      { body: {} }, // user_id is derived server-side from JWT
    );
    if (error) return { ok: false, error: error.message };
    if (!data?.inquiryId || !data?.hostedUrl) {
      return { ok: false, error: "Persona did not return a hosted URL" };
    }

    // Open in a new tab. Linking.openURL under react-native-web maps to
    // window.open with the current tab as opener.
    await Linking.openURL(data.hostedUrl);

    return { ok: true, kind: "web_opened", inquiryId: data.inquiryId, hostedUrl: data.hostedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
