import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { Alert, AppState, Platform } from "react-native";
import i18n from "i18next";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { eventService } from "../services/EventService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { navigationRef } from "../lib/navigation";
import { showToast } from "../components/Toast";
import { KYCVerificationEngine } from "../services/KYCVerificationEngine";
import type {
  KYCStatus,
  KYCVerification,
} from "../services/KYCVerificationEngine";
import { clearDeferredAction } from "../lib/deferredAction";

// Platform-aware redirect URLs for Supabase Auth emails.
// Use Linking.createURL() on native so the scheme matches the runtime:
//   - Expo Go (dev):                    exp://192.168.x.x:8081/--/<path>
//   - Dev client / production build:    tandaxn://<path>
// The previous hardcoded `tandaxn://${path}` URL did NOT work in Expo Go
// (Expo Go doesn't claim the custom scheme), so confirmation links never
// opened the app there and users got stuck on "waiting verification".
// All three prefixes (exp://, tandaxn://, https://v0-tanda-xn.vercel.app/)
// must be in the Supabase Auth dashboard's allowed redirect URLs.
export const getEmailRedirectUrl = (path: string) => {
  if (Platform.OS === "web") {
    return `https://v0-tanda-xn.vercel.app/${path}`;
  }
  return Linking.createURL(path);
};

// P0 (kyc-trigger review): minimal projection of kyc_verifications onto
// the in-memory user. Fetched once on SIGNED_IN/INITIAL_SESSION and
// refreshable via refreshKyc(). Lives here so the gate can decide
// synchronously at button-press time without firing a query.
//
// `null` covers both "loading" and "no kyc row on file" — KYCGate
// treats null as "unverified" which is the safe default (block).
// Once the screen-level hook (useKYCStatus) is available we may
// migrate this to a discriminated loading/missing/loaded triple,
// but the simpler nullable keeps the gate logic obvious.
type KycSummary = {
  status: KYCStatus;
  tier: number;
  completedAt: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  xnScore: number;
  // null until first hydration; replaced by KycSummary or null after.
  kyc?: KycSummary | null;
};

// Set on the context between a successful password check and a completed
// TOTP challenge. When non-null, isAuthenticated is forced false so the
// app keeps rendering the auth stack (specifically MfaChallengeScreen)
// even though supabase.auth already has an AAL1 session. Cleared by
// verifyMfaAndComplete (upgrade path) or cancelMfaChallenge (sign back
// out and return to Login).
export type PendingMfa = {
  factorId: string;
  email: string;
};

// signIn return contract. Callers (LoginScreen) branch on requiresMfa to
// route into MfaChallenge before the app tree swaps.
export type SignInResult = {
  requiresMfa: boolean;
  factorId?: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // True iff the active session's auth.users.email_confirmed_at is set.
  // Drives the EmailVerificationScreen gate in App.tsx and the
  // verification-status pill in SettingsMainScreen. Falls through to
  // false when there's no session.
  isEmailVerified: boolean;
  isLocked: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  // True iff a refresh token is stashed in the keystore — the LoginScreen
  // uses this (plus the two booleans above) to decide whether to render
  // the biometric sign-in button.
  hasStoredRefreshToken: boolean;
  // Returns { requiresMfa: true, factorId } when Supabase reports a
  // verified TOTP factor is enrolled — LoginScreen then routes to
  // MfaChallenge. Otherwise { requiresMfa: false } and the app tree
  // swaps to authenticated as usual.
  signIn: (email: string, password: string) => Promise<SignInResult>;
  // Set between password check and TOTP challenge; null otherwise.
  pendingMfa: PendingMfa | null;
  // Complete the AAL1 → AAL2 upgrade. On success clears pendingMfa; the
  // existing session is upgraded in place so the auth listener has
  // already set user/session — the app tree swaps as soon as
  // isAuthenticated flips true.
  verifyMfaAndComplete: (code: string) => Promise<void>;
  // Abort the challenge (user tapped Cancel). Signs out to drop the
  // stashed AAL1 session and clears pendingMfa.
  cancelMfaChallenge: () => Promise<void>;
  // Callable from any screen when it catches an auth error indicating the
  // refresh token is stale ("Invalid Refresh Token", "refresh_token_not_found",
  // AuthApiError with a 401). Kicks off the same "Session expired" alert +
  // Login reset the auto-expiry path uses, but without waiting for Supabase
  // to spontaneously fire SIGNED_OUT (which sometimes never happens if the
  // stale token surfaces on a specific RPC/select rather than on the
  // proactive refresh timer).
  notifySessionExpired: () => Promise<void>;
  // P2 (logout review): scope controls how broadly the JWT revocation
  // hits Supabase. 'local' (default) ends only this device's session;
  // 'global' revokes every refresh token tied to this user — useful
  // when the user suspects another device is compromised.
  // Return value flags whether the Supabase network call failed; on
  // offline, all local cleanup still runs and the caller can surface
  // a "signed out locally" toast.
  // Replays the keystore-stored refresh token through Supabase, gated by
  // the biometric prompt. Returns false on any failure path (no token,
  // user cancelled, refresh expired) so the LoginScreen can fall back
  // to password without surfacing a hard error.
  signInWithBiometrics: () => Promise<boolean>;
  // Idempotent opt-in: sets biometricsEnabled = true, persists the flag,
  // and re-stamps the keystore with the current refresh_token so a
  // first-login opt-in succeeds even if the refresh-token write at
  // sign-in time was skipped for any reason.
  enableBiometrics: () => Promise<boolean>;
  // Has this user been shown the post-login opt-in modal yet? Avoids
  // re-prompting on every sign-in.
  hasAskedBiometricOptIn: () => Promise<boolean>;
  markBiometricOptInAsked: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  // Social-login P0 — Google + Apple via Supabase OAuth (web flow on all
  // platforms; native Apple Sign-In deferred). Throws Error('CANCELLED')
  // if the user closes the in-app browser without completing. The
  // resulting session lands via onAuthStateChange SIGNED_IN.
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;
  verifyOTP: (phone: string, token: string) => Promise<void>;
  signOut: (opts?: SignOutOpts) => Promise<SignOutResult>;
  // P1 (session-persistence review): true when we believe the device
  // has no working connectivity to Supabase. Drives the OfflineBanner.
  // Detected via window 'online'/'offline' events on web, AppState
  // 'change' + a short-timeout HEAD probe on native (no NetInfo dep).
  isOffline: boolean;
  // Forces a connectivity probe + supabase.auth.refreshSession() round
  // trip. Returns true if both succeed (banner can dismiss), false
  // otherwise. The OfflineBanner's Retry button calls this.
  retryRefresh: () => Promise<boolean>;
  signUp: (
    email: string,
    password: string,
    name: string,
    phone?: string
  ) => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  // P2 (profile review): kick off Supabase's phone-change flow. Sends
  // an SMS OTP to the new number. The user is then sent through
  // OTPScreen with from='profile_edit' which calls verifyPhoneFromProfile.
  requestPhoneChange: (newPhone: string) => Promise<void>;
  // P2 (profile review): complete the phone-change flow + flip
  // profiles.phone_verified = true. Used by OTPScreen for from='profile_edit'.
  verifyPhoneFromProfile: (phone: string, token: string) => Promise<void>;
  // P2 (profile review): request a Supabase-managed email change.
  // Triggers a confirmation link to the new address; auth.users.email is
  // updated only after the user clicks the link. Until then the new
  // address sits on auth.users.new_email and the UI shows "Pending".
  requestEmailChange: (newEmail: string) => Promise<void>;
  updateXnScore: (score: number) => Promise<void>;
  // P0 (kyc-trigger review): re-hydrate user.kyc after a status change.
  // Called from KYCHub after a successful flip to approved and from
  // any screen that needs the freshest projection. No-op if no session.
  refreshKyc: () => Promise<void>;
  lockApp: () => void;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPassword: (password: string) => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BIOMETRICS_ENABLED_KEY = "@tandaxn_biometrics_enabled";
// Refresh token stashed in the keystore on every successful password sign-in.
// requireAuthentication gates retrieval behind the OS biometric prompt.
const REFRESH_TOKEN_KEY = "tandaxn_refresh_token";
// Tracks whether we've ever surfaced the post-login biometric opt-in modal
// to this user. Stored under user.id-suffixed key to scope per-account.
const BIOMETRIC_OPTIN_ASKED_KEY = "@tandaxn_biometric_optin_asked";
// Non-secret mirror flag so LoginScreen can render the biometric button
// without prompting biometric on every app start. Set "true" when we
// SecureStore.setItemAsync the refresh token; removed when we delete it.
const HAS_REFRESH_TOKEN_FLAG_KEY = "@tandaxn_has_refresh_token";
// P0 (legal-docs review): signup checkbox flips this on. Drained on
// SIGNED_IN — calls record_legal_acceptance RPC for terms_of_service +
// privacy_policy. The flag covers the email-confirmation path (signUp
// returns no session, so we can't record yet; we record after the user
// clicks the verification link and AuthCallback establishes a session).
const PENDING_SIGNUP_ACCEPTANCE_KEY = "@tandaxn/pending_signup_acceptance";

// ── Sign-out whitelist ───────────────────────────────────────────────────────
// signOut() purges AsyncStorage of everything except these — user
// preferences should survive a logout (locale, biometric prefs, the
// remember-me identifier feeding ForgotPassword pre-fill, etc.), while
// cached financial state, score data, and the refresh-token flag get
// dropped along with the JWT.
//
// EXACT keys: matched literally. PREFIXES: matched with startsWith(),
// for namespaces that include a user id suffix (e.g. onboarding state
// keyed per-user). Per-user keying means preserving them across
// sign-outs cannot leak between users — different ids, different keys.
const PRESERVE_ON_SIGNOUT_EXACT: readonly string[] = [
  "@tandaxn/last_login_identifier",  // remember-me identifier (LoginScreen + ForgotPassword)
  "@tandaxn_language",               // locale preference
  "@tandaxn_theme",                  // theme preference
  "@tandaxn_biometrics_enabled",     // user opt-in to biometrics
  "@tandaxn_biometric_optin_asked",  // "we already asked" UX flag
  "@tandaxn_preferences",            // generic prefs blob
];

const PRESERVE_ON_SIGNOUT_PREFIXES: readonly string[] = [
  "@tandaxn_currency_",      // currency settings
  "@tandaxn_onboarding_",    // per-user onboarding flags
  "@tandaxn_tooltips_shown_", // per-user tooltip-shown flags
];

const shouldPreserveOnSignout = (key: string): boolean =>
  PRESERVE_ON_SIGNOUT_EXACT.includes(key) ||
  PRESERVE_ON_SIGNOUT_PREFIXES.some((p) => key.startsWith(p));

export type SignOutOpts = { scope?: "local" | "global" };
export type SignOutResult = { offline: boolean };

// ── Temporary session (P2, session-persistence review) ──────────────────────
// LoginScreen stamps this key with `Date.now() + TEMPORARY_SESSION_DURATION_MS`
// when the user signs in with "Remember me" unchecked. AuthContext checks it
// on mount, on app foreground, and via a scheduled setTimeout — when the
// stamp is in the past, the user is signed out automatically with a toast.
//
// Not on the P0-logout whitelist by design: a manual sign-out should clear
// the stamp (and the multiRemove in AuthContext.signOut does that
// automatically since the key isn't whitelisted).
export const SESSION_EXPIRES_AT_KEY = "@tandaxn_session_expires_at";
export const TEMPORARY_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

// P0 (session-persistence review): module-scope helper invoked by the
// onAuthStateChange listener when SIGNED_OUT fires WITHOUT the
// isManualSignOutRef flag set — i.e. Supabase auto-revoked the session
// (refresh-token expiry, 401 on token refresh). Surfaces an Alert and
// resets the nav stack to Login. The navigationRef.isReady() guard
// covers the cold-boot case where the NavigationContainer hasn't
// mounted yet — there's nowhere to reset to, but the Alert still
// fires so the user gets the message on the next paint.
function handleAutoSessionExpiry() {
  try {
    Alert.alert(
      i18n.t("auth.session_expired_title"),
      i18n.t("auth.session_expired_body"),
    );
  } catch (e) {
    console.warn("[AuthContext] auto-expiry Alert failed", e);
  }
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }
}

// P0 (legal-docs review): record the new member's acceptance of the
// active Terms of Service + Privacy Policy via the
// record_legal_acceptance RPC (migration 178). Fire-and-forget — a
// failure here MUST NOT break the signup. The screen has already
// shown its own checkbox-required validation, so the worst case if
// this never lands is the member is prompted to re-accept once the
// LegalDocumentsScreen pending banner picks them up later.
//
// Called from two places:
//   1. signUp() itself, when Supabase returned a session immediately
//      (email-confirmation disabled).
//   2. the onAuthStateChange SIGNED_IN handler below, draining the
//      PENDING_SIGNUP_ACCEPTANCE_KEY flag set by signUp() when no
//      session was returned (email-confirmation enabled path).
async function recordSignupAcceptances(): Promise<void> {
  const language = i18n.language || "en";
  const deviceInfo = `${Platform.OS} ${Platform.Version}`;
  for (const docType of ["terms_of_service", "privacy_policy"] as const) {
    try {
      await supabase.rpc("record_legal_acceptance", {
        p_document_type: docType,
        p_language_viewed: language,
        p_device_info: deviceInfo,
      });
    } catch (e) {
      console.warn(
        `[AuthContext] record_legal_acceptance(${docType}) failed`,
        (e as Error)?.message,
      );
    }
  }
  // Mig 353 — Twilio A2P 10DLC audit trail. The SMS-consent checkbox is
  // MANDATORY on SignupScreen (validation blocks submit if unchecked),
  // so any user reaching this helper post-SIGNED_IN implicitly ticked
  // it. Only stamps when the column is still NULL — a returning user
  // whose signup timestamp already landed doesn't overwrite it.
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (uid) {
      await supabase
        .from("profiles")
        .update({ sms_consent_granted_at: new Date().toISOString() })
        .eq("id", uid)
        .is("sms_consent_granted_at", null);
    }
  } catch (e) {
    console.warn(
      "[AuthContext] sms_consent_granted_at stamp failed",
      (e as Error)?.message,
    );
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Helper to convert Supabase user to our User type
const formatUser = (supabaseUser: SupabaseUser | null): User | null => {
  if (!supabaseUser) return null;

  // Try to get the name from various sources
  const name =
    supabaseUser.user_metadata?.name ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.display_name ||
    // Fallback: extract name from email (part before @)
    (supabaseUser.email ? supabaseUser.email.split("@")[0] : null) ||
    "User";

  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email || "",
    phone: supabaseUser.phone,
    xnScore: supabaseUser.user_metadata?.xn_score || 75, // Default score for testing (75 unlocks all features)
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  // P1 (session-persistence review): drives the OfflineBanner. Seeded
  // optimistically from navigator.onLine on web (when known), false
  // elsewhere. The listener effects below keep it in sync.
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine === false;
    }
    return false;
  });
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [hasStoredRefreshToken, setHasStoredRefreshToken] = useState(false);
  // 2FA gate. When non-null the user has passed the password check but
  // still owes a TOTP code. isAuthenticated is forced false in that
  // window so App.tsx keeps rendering the auth stack (MfaChallenge).
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  // P0 (kyc-trigger review): fetch the live verification row for the
  // given user and project it onto user.kyc. Fire-and-forget — the
  // catch silently leaves user.kyc as-is so a transient query failure
  // doesn't accidentally flip a verified user to "unverified" in the
  // gate. setUser uses the functional form so we never clobber a
  // concurrent profile mutation (e.g. updateProfile).
  const fetchAndApplyKyc = useCallback(async (userId: string) => {
    try {
      const verification: KYCVerification | null =
        await KYCVerificationEngine.getVerification(userId);
      setUser((prev) => {
        if (!prev || prev.id !== userId) return prev;
        return {
          ...prev,
          kyc: verification
            ? {
                status: verification.status,
                tier: verification.kycTier,
                completedAt:
                  verification.status === "approved"
                    ? (verification as { verifiedAt?: string }).verifiedAt ??
                      null
                    : null,
              }
            : null,
        };
      });
    } catch (e) {
      console.warn(
        "[AuthContext] fetchAndApplyKyc failed",
        (e as Error)?.message,
      );
    }
  }, []);

  // Exposed on the context so KYCHub can rehydrate immediately after a
  // status flip without waiting for the realtime subscription inside
  // useKYCStatus (which fires on a different cadence).
  const refreshKyc = useCallback(async () => {
    if (!user?.id) return;
    await fetchAndApplyKyc(user.id);
  }, [user?.id, fetchAndApplyKyc]);

  // Check biometrics availability and settings
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        // Check if device supports biometrics
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricsAvailable(compatible && enrolled);

        // Check if user has enabled biometrics
        const enabled = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
        setBiometricsEnabledState(enabled === "true");

        // Mirror flag — does the keystore have a refresh token we can replay
        // through Supabase? AsyncStorage probe avoids prompting biometric
        // on every app start; the actual SecureStore read happens later, on
        // signInWithBiometrics().
        const hasTokenFlag = await AsyncStorage.getItem(
          HAS_REFRESH_TOKEN_FLAG_KEY,
        );
        setHasStoredRefreshToken(hasTokenFlag === "true");
      } catch (error) {
        console.error("Error checking biometrics:", error);
      }
    };

    checkBiometrics();
  }, []);

  // P2 (profile review): on first session for each user, read
  // profiles.timezone — if null, write the device IANA timezone (e.g.
  // "America/Los_Angeles"). This is best-effort: failures are
  // swallowed, and we use a per-user-id Set ref to avoid hammering the
  // table on every render. The DB itself acts as the "have we done
  // this?" flag — once a row has a non-null timezone the effect is a
  // no-op on subsequent loads.
  const timezoneSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (timezoneSetRef.current.has(uid)) return;
    timezoneSetRef.current.add(uid);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", uid)
          .maybeSingle();
        if (error || !data) return;
        if (data.timezone) return; // already set, leave it alone

        // Intl is available on all modern RN runtimes (Hermes ≥0.70).
        // Wrap in try in case a low-end Android build is missing it.
        let tz: string | null = null;
        try {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
        } catch {
          /* no Intl — skip */
        }
        if (!tz) return;

        await supabase
          .from("profiles")
          .update({ timezone: tz })
          .eq("id", uid);
      } catch (e) {
        console.warn("[AuthContext] auto-set timezone failed", e);
      }
    })();
  }, [user?.id]);

  // Handle deep link auth callbacks (email verification, password reset)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        const parsedUrl = Linking.parse(url);

        // PKCE flow: Supabase appends ?code=... to the redirect URL.
        // (The current client uses implicit flow by default, but accept both
        // shapes so a future switch to flowType:'pkce' doesn't require
        // touching this handler.)
        const code = parsedUrl.queryParams?.code as string | undefined;
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Error exchanging code for session:", error);
          } else if (data.session) {
            setSession(data.session);
            setUser(formatUser(data.user));
            setIsLocked(false);
          }
          return;
        }

        // Implicit flow (current default): tokens come back in the URL hash.
        if (
          url.includes("access_token") ||
          url.includes("refresh_token") ||
          url.includes("type=")
        ) {
          const fragment = url.split("#")[1];
          if (fragment) {
            const params = new URLSearchParams(fragment);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) {
                console.error("Error setting session from deep link:", error);
              } else if (data.session) {
                setSession(data.session);
                setUser(formatUser(data.user));
                setIsLocked(false);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error handling auth deep link:", error);
      }
    };

    // Handle initial URL when app opens
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for incoming deep links while app is open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(formatUser(session?.user ?? null));
      setIsLoading(false);
      // P0 (kyc-trigger review): hydrate user.kyc on cold start when a
      // session already exists. SIGNED_IN won't fire for restored
      // sessions, so this is the only chance to load kyc for a user
      // who reopens the app — otherwise the gate stays in its initial
      // null state until the user navigates to KYCHub.
      if (session?.user?.id) {
        void fetchAndApplyKyc(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event);
      setSession(session);
      setUser(formatUser(session?.user ?? null));
      setIsLoading(false);
      // Reset lock state on new login
      if (session) {
        setIsLocked(false);
      }

      // Record a row in login_events for SIGNED_IN or INITIAL_SESSION so
      // the stress engine's Signal C (login_drop) has data to compute
      // rolling 7d-vs-23d frequency from. Fire-and-forget — we never
      // block the auth flow on this.
      //
      // De-dup is per (user_id, app instance): once we've recorded a
      // particular user this app run, we don't record again on
      // TOKEN_REFRESHED, biometric unlock re-mount, etc. SIGNED_OUT
      // clears the ref so a fresh sign-in records again.
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session?.user?.id
      ) {
        // New session started — clear the once-per-session latch so a
        // future expiry can fire its alert again.
        autoExpiryHandledRef.current = false;
        if (lastRecordedUserIdRef.current !== session.user.id) {
          lastRecordedUserIdRef.current = session.user.id;
          recordLoginEvent(session.user.id);
        }
        // P0 (kyc-trigger review): hydrate user.kyc whenever a fresh
        // session lands. Covers email-confirmation signups, post-OTP
        // flows, biometric re-auth, and password sign-in. Idempotent
        // — the fetcher writes through setUser only if the userId
        // matches, so a concurrent SIGNED_OUT race is harmless.
        void fetchAndApplyKyc(session.user.id);
        // P0 (legal-docs review): drain the pending signup-acceptance
        // flag once we have a real session. Covers the email-confirm
        // path where signUp() couldn't write the audit row directly.
        // Removing the key before the RPC call guarantees it doesn't
        // fire twice if the SIGNED_IN event re-runs.
        AsyncStorage.getItem(PENDING_SIGNUP_ACCEPTANCE_KEY)
          .then(async (flag) => {
            if (flag === "true") {
              await AsyncStorage.removeItem(PENDING_SIGNUP_ACCEPTANCE_KEY);
              await recordSignupAcceptances();
            }
          })
          .catch(() => {
            /* best-effort; the next sign-in will retry */
          });
      } else if (event === "SIGNED_OUT") {
        lastRecordedUserIdRef.current = null;
        // P0 (session-persistence review): SIGNED_OUT fires for two
        // reasons — the user tapped Sign Out, or Supabase auto-revoked
        // (refresh-token expiry / 401). signOut() raises the manual
        // flag right before the network call so we can tell the two
        // apart here. autoExpiryHandledRef gates re-entry within a
        // single signed-out epoch.
        if (
          !isManualSignOutRef.current &&
          !autoExpiryHandledRef.current
        ) {
          autoExpiryHandledRef.current = true;
          handleAutoSessionExpiry();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // P1 (session-persistence review): keep isOffline in sync. Two paths,
  // one per platform — both gracefully degrade if their primitive isn't
  // available, leaving isOffline at its initial value (false).
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      const onOnline = () => {
        setIsOffline(false);
        // When the network returns, eagerly refresh the session so the
        // banner doesn't have to wait for the user to tap Retry.
        supabase.auth.refreshSession().catch(() => {
          /* swallow — retry is up to the user */
        });
      };
      const onOffline = () => setIsOffline(true);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    }

    // Native path: probe on every AppState transition into "active".
    // This catches re-foregrounding after a long background where the
    // refresh token has likely lapsed if the device was offline.
    const checkAndUpdate = async () => {
      const ok = await probeConnectivity();
      setIsOffline(!ok);
      if (ok) {
        supabase.auth.refreshSession().catch(() => {
          /* swallow */
        });
      }
    };
    // Initial check at mount on native — web's `online` event doesn't
    // exist there, so the initial-false seed needs explicit confirmation.
    checkAndUpdate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkAndUpdate();
    });
    return () => subscription.remove();
  }, [probeConnectivity]);

  // P2 (session-persistence review): temporary-session enforcement.
  // When LoginScreen stamped SESSION_EXPIRES_AT_KEY (the user signed
  // in with "Remember me" unchecked), this effect:
  //   1) Checks the stamp on mount and on every transition to an
  //      authenticated session.
  //   2) If past expiry → sign the user out + toast + route to Login.
  //   3) If not yet expired → schedule a precise setTimeout so the
  //      sign-out fires at the exact moment even if the user keeps
  //      the app foregrounded the whole hour.
  //   4) Re-checks on every AppState 'active' transition so a session
  //      that expired while the app was backgrounded is caught the
  //      moment the user returns.
  //
  // signOut is reached via a ref so the effect doesn't re-subscribe
  // every render (signOut isn't memoised, and re-subscribing AppState
  // on every render would churn the listener).
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useEffect(() => {
    if (!session) return;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const expire = async () => {
      // Defensive re-read in case a manual sign-out raced the timer
      // and already purged the key.
      try {
        const raw = await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
        if (!raw) return;
        const expAt = parseInt(raw, 10);
        if (!Number.isFinite(expAt) || expAt > Date.now()) return;
      } catch {
        return;
      }
      try {
        showToast(i18n.t("auth.temporary_session_expired_body"), "info");
      } catch {
        /* toast unavailable — proceed with sign-out anyway */
      }
      try {
        await signOutRef.current();
      } catch {
        /* even on sign-out failure, push to Login below */
      }
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    };

    const check = async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
      } catch {
        return;
      }
      if (cancelled || !raw) return;
      const expiresAt = parseInt(raw, 10);
      if (!Number.isFinite(expiresAt)) return;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      // Cancel any existing pending timer before scheduling the next
      // one (covers re-check after AppState 'active' transitions).
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        if (!cancelled) expire();
      }, remaining);
    };

    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      sub.remove();
    };
  }, [session]);

  // Refs for login-event recording dedup (Stress Signal C).
  // lastRecordedUserIdRef tracks the most recently logged-event user_id
  // for THIS app instance — survives across React strict-mode double-mounts
  // and TOKEN_REFRESHED events. Cleared on SIGNED_OUT.
  const lastRecordedUserIdRef = useRef<string | null>(null);

  // P0 (session-persistence review): distinguishes user-initiated
  // sign-out from automatic session expiry (refresh-token failure).
  // signOut() flips this true before calling supabase.auth.signOut so
  // the onAuthStateChange listener can recognise the resulting
  // SIGNED_OUT event as ours and skip the "Session expired" alert.
  const isManualSignOutRef = useRef<boolean>(false);
  // Latch: once the auto-expiry handler has fired this app instance,
  // suppress repeats (Supabase can fire SIGNED_OUT more than once if
  // the refresh path is racing). Reset on next SIGNED_IN.
  const autoExpiryHandledRef = useRef<boolean>(false);

  // P1 (session-persistence review): lightweight HEAD probe to the
  // Supabase project URL with a 3-second timeout. Used to detect
  // connectivity on native (no NetInfo dep) and to verify a Retry tap
  // before attempting the heavier refreshSession round-trip.
  // Returns true when the endpoint responded at all (any status,
  // even 4xx — it just means the network reached Supabase).
  const probeConnectivity = useCallback(async (): Promise<boolean> => {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 3000);
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "HEAD",
        signal: ctrl.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  // Forces a connectivity probe + refreshSession. Surface for the
  // OfflineBanner's Retry button. Bumps isOffline state based on the
  // outcome so the banner can dismiss / persist accordingly.
  const retryRefresh = useCallback(async (): Promise<boolean> => {
    const online = await probeConnectivity();
    if (!online) {
      setIsOffline(true);
      return false;
    }
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        // Reach was OK but refresh itself failed (token revoked,
        // server error). We're not offline — clear the flag — but the
        // caller should fall through to the sign-in path.
        setIsOffline(false);
        return false;
      }
      setIsOffline(false);
      return true;
    } catch {
      // refreshSession threw — probably network blip between probe and
      // refresh call. Leave isOffline true so the banner persists.
      setIsOffline(true);
      return false;
    }
  }, [probeConnectivity]);

  const recordLoginEvent = useCallback(async (userId: string) => {
    try {
      const sessionId =
        `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const { error } = await supabase.from("login_events").insert({
        user_id: userId,
        session_id: sessionId,
        source: "auth_state_change",
        platform: Platform.OS,
      });
      if (error) {
        // Swallow — login event recording must never break sign-in. The
        // unique partial index on (user_id, session_id) would reject a
        // true dup but our generated session_id avoids that.
        console.log("[login_events] insert failed:", error.message);
      }
    } catch (err: any) {
      console.log("[login_events] insert threw:", err?.message);
    }
  }, []);

  // Lock the app (without signing out)
  const lockApp = useCallback(() => {
    if (session) {
      setIsLocked(true);
    }
  }, [session]);

  // Unlock with biometrics
  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!biometricsAvailable || !biometricsEnabled) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to unlock TandaXn",
        fallbackLabel: "Use password",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return false;
    }
  }, [biometricsAvailable, biometricsEnabled]);

  // Unlock with password — verifies the password by re-signing-in against
  // Supabase, then ONLY flips the lock flag. Session and user updates are
  // left to the onAuthStateChange listener (which fires after a successful
  // signInWithPassword) so we don't race two state-setter chains.
  //
  // The session manipulation in the previous version was the source of the
  // "loops back to Login" bug: setting session in BOTH places caused
  // React to batch updates in an order that could transiently render
  // isAuthenticated as false, and because the lock used to be a full
  // navigator REPLACE (not an overlay), the Stack remounted at "Splash"
  // and could land the user on the auth stack. The overlay change in
  // App.tsx makes that path impossible regardless, but this simpler unlock
  // is also more correct.
  const unlockWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!user?.email) return false;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });
        if (error || !data.session) {
          console.warn("Password unlock failed:", error?.message);
          return false;
        }
        // Auth listener will set session/user. We just dismiss the lock.
        setIsLocked(false);
        return true;
      } catch (err: any) {
        console.error("Password unlock error:", err?.message ?? err);
        return false;
      }
    },
    [user?.email]
  );

  // Sign in via stored refresh token, gated by the biometric prompt.
  // The OS will surface Face ID / Touch ID before SecureStore returns the
  // token. Any failure (no token, user cancels, refresh expired) returns
  // false so the LoginScreen can fall back to password without noise.
  const signInWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, {
        requireAuthentication: true,
      });
      if (!refreshToken) return false;

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error || !data.session) {
        // Refresh token is stale — clear the mirror flag so the LoginScreen
        // stops rendering the biometric button until the next successful
        // password login re-stashes a fresh token.
        await AsyncStorage.removeItem(HAS_REFRESH_TOKEN_FLAG_KEY);
        setHasStoredRefreshToken(false);
        return false;
      }

      setSession(data.session);
      setUser(formatUser(data.user));
      setIsLocked(false);
      eventService.trackAuth('login', 'success', 'biometric');

      // Re-stash the rotated refresh token (Supabase rotates on refresh).
      if (data.session.refresh_token) {
        SecureStore.setItemAsync(
          REFRESH_TOKEN_KEY,
          data.session.refresh_token,
          { requireAuthentication: true },
        ).catch(() => undefined);
      }
      return true;
    } catch (error: any) {
      console.warn("Biometric sign-in failed:", error?.message ?? error);
      return false;
    }
  }, []);

  // First-time opt-in: enables the biometric setting and re-stashes the
  // current session's refresh token in case the post-signIn write was
  // skipped (e.g., user signed in before biometric was enabled).
  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const current = session?.refresh_token;
      if (!current) return false;

      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, current, {
        requireAuthentication: true,
      });
      await AsyncStorage.setItem(HAS_REFRESH_TOKEN_FLAG_KEY, "true");
      await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, "true");
      setHasStoredRefreshToken(true);
      setBiometricsEnabledState(true);
      return true;
    } catch (error: any) {
      console.error("enableBiometrics failed:", error?.message ?? error);
      return false;
    }
  }, [session]);

  // One-shot prompt control — used by LoginScreen / HomeScreen after the
  // first password sign-in to surface the opt-in modal only once per user.
  const hasAskedBiometricOptIn = useCallback(async (): Promise<boolean> => {
    try {
      const stamp = await AsyncStorage.getItem(BIOMETRIC_OPTIN_ASKED_KEY);
      return stamp === "true";
    } catch {
      return true; // fail-closed: don't nag on storage errors
    }
  }, []);

  const markBiometricOptInAsked = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(BIOMETRIC_OPTIN_ASKED_KEY, "true");
    } catch {
      /* swallow — best-effort */
    }
  }, []);

  // Enable/disable biometrics
  const setBiometricsEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      try {
        await AsyncStorage.setItem(
          BIOMETRICS_ENABLED_KEY,
          enabled ? "true" : "false"
        );
        setBiometricsEnabledState(enabled);
      } catch (error) {
        console.error("Error setting biometrics preference:", error);
      }
    },
    []
  );

  // Sign in with email and password. Returns { requiresMfa } so the
  // caller can route into MfaChallenge before the app tree swaps.
  const signIn = async (
    email: string,
    password: string,
  ): Promise<SignInResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // ── AAL gate ────────────────────────────────────────────────────
      // Supabase returns a session at AAL1 even for MFA-enrolled users;
      // getAuthenticatorAssuranceLevel tells us whether an AAL2 factor
      // exists that we still need to satisfy. When it does, we set
      // pendingMfa (which forces isAuthenticated=false) instead of
      // completing the sign-in — the LoginScreen then routes to
      // MfaChallenge. The AAL1 session stays live in supabase.auth so
      // mfa.challengeAndVerify can upgrade it in place without another
      // password round-trip. A failure at this probe should NOT abort
      // the sign-in (e.g. old client + brand-new project); fall through
      // to the non-MFA path.
      try {
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (
          aal?.currentLevel === "aal1" &&
          aal?.nextLevel === "aal2"
        ) {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = factors?.totp?.find((f) => f.status === "verified");
          if (totp) {
            // Do NOT set session/user or stash biometric refresh token
            // yet — the AAL1 session lands in supabase.auth via the
            // onAuthStateChange listener, but pendingMfa keeps
            // isAuthenticated false until the code is verified.
            setPendingMfa({ factorId: totp.id, email });
            eventService.trackAuth("login", "success", "email_mfa_required");
            return { requiresMfa: true, factorId: totp.id };
          }
        }
      } catch (e) {
        console.warn(
          "[AuthContext] AAL probe failed — proceeding without MFA",
          (e as Error)?.message,
        );
      }

      setSession(data.session);
      setUser(formatUser(data.user));
      setIsLocked(false);
      eventService.trackAuth('login', 'success', 'email');

      // Stash the refresh token in the keystore for biometric re-entry.
      // requireAuthentication gates retrieval behind the OS biometric prompt
      // so the token is never returned to JS land without a successful
      // Face ID / Touch ID match. Fire-and-forget: a keystore write
      // failure must NOT fail the login itself.
      if (data.session?.refresh_token) {
        SecureStore.setItemAsync(
          REFRESH_TOKEN_KEY,
          data.session.refresh_token,
          { requireAuthentication: true },
        )
          .then(() =>
            AsyncStorage.setItem(HAS_REFRESH_TOKEN_FLAG_KEY, "true"),
          )
          .then(() => setHasStoredRefreshToken(true))
          .catch((e) =>
            console.warn("Failed to stash refresh token:", e?.message ?? e),
          );
      }

      return { requiresMfa: false };
    } catch (error: any) {
      console.error("Sign in error:", error);
      eventService.trackAuth('login', 'failure', 'email', {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Completes the AAL1 → AAL2 upgrade. Called by MfaChallengeScreen
  // after the user enters the 6-digit code. On success the existing
  // session is upgraded in place (no new tokens issued from our side —
  // Supabase re-signs the JWT with aal='aal2') and pendingMfa clears,
  // which flips isAuthenticated true and swaps the app tree.
  const verifyMfaAndComplete = useCallback(
    async (code: string): Promise<void> => {
      if (!pendingMfa) throw new Error("No pending MFA challenge");
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingMfa.factorId,
        code,
      });
      if (error) {
        eventService.trackAuth("login", "failure", "mfa_challenge", {
          code: error.code,
          message: error.message,
        });
        throw error;
      }
      // Refresh the session object we hold — the JWT that came back
      // from the challenge carries the aal2 claim.
      const { data: refreshed } = await supabase.auth.getSession();
      if (refreshed?.session) setSession(refreshed.session);
      setUser(formatUser(refreshed?.session?.user ?? null));
      setIsLocked(false);
      setPendingMfa(null);
      eventService.trackAuth("login", "success", "mfa_challenge");
    },
    [pendingMfa],
  );

  // User tapped Cancel on the MfaChallenge screen. Sign out to drop the
  // stashed AAL1 session (otherwise it'd stay on device and let anyone
  // with the phone unlock into an unfinished sign-in) and clear the
  // pending state. The listener SIGNED_OUT will fall through the
  // "manual" path and skip the session-expired Alert.
  const cancelMfaChallenge = useCallback(async (): Promise<void> => {
    isManualSignOutRef.current = true;
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn(
        "[AuthContext] signOut during cancelMfaChallenge failed",
        (e as Error)?.message,
      );
    } finally {
      isManualSignOutRef.current = false;
      setPendingMfa(null);
    }
  }, []);

  // Sign in with phone (sends OTP)
  const signInWithPhone = async (phone: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;
      eventService.trackAuth('login', 'success', 'phone_otp');
    } catch (error: any) {
      console.error("Phone sign in error:", error);
      eventService.trackAuth('login', 'failure', 'phone_otp', {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Social login (Google + Apple) ──────────────────────────────────
  // Unified web-OAuth flow on all platforms. Mobile opens an in-app
  // browser via WebBrowser.openAuthSessionAsync; the callback URL
  // delivers access/refresh tokens in its fragment, which we hand to
  // supabase.auth.setSession. Web uses Supabase's built-in redirect.
  // Native Apple Sign-In (expo-apple-authentication / signInWithIdToken)
  // is intentionally NOT used here so the flow stays single-path and
  // works on Android + web without platform-shimming.
  const signInWithOAuth = async (
    provider: "google" | "apple",
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const redirectTo = getEmailRedirectUrl("auth/callback");

      // Web path: Supabase handles the in-page redirect. The browser
      // navigates to the provider and back to redirectTo; the new page
      // load picks up the session from AsyncStorage.
      if (Platform.OS === "web") {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        });
        if (error) throw error;
        eventService.trackAuth("login", "success", `oauth_${provider}`);
        return;
      }

      // Native path: skipBrowserRedirect returns the authorization URL
      // instead of trying to navigate (we have no browser to redirect).
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("OAuth provider did not return a URL");

      // Open the provider's auth page in the in-app browser; resolves
      // when the user is redirected back to redirectTo.
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") {
        throw new Error("CANCELLED");
      }
      if (result.type !== "success" || !result.url) {
        throw new Error("OAuth flow did not complete");
      }

      // Supabase returns tokens in the URL hash fragment.
      const fragmentStart = result.url.indexOf("#");
      const fragment =
        fragmentStart >= 0 ? result.url.slice(fragmentStart + 1) : "";
      const params = new URLSearchParams(fragment);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) {
        throw new Error("OAuth callback did not include session tokens");
      }

      // Hand the session to Supabase; the existing onAuthStateChange
      // listener fires SIGNED_IN and updates session/user state.
      const { error: setErr } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (setErr) throw setErr;
      eventService.trackAuth("login", "success", `oauth_${provider}`);
    } catch (error: any) {
      if (error?.message !== "CANCELLED") {
        console.error("OAuth sign in error:", error);
      }
      eventService.trackAuth("login", "failure", `oauth_${provider}`, {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async (phone: string, token: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) throw error;

      setSession(data.session);
      setUser(formatUser(data.user));
      setIsLocked(false);
      eventService.trackAuth('login', 'success', 'otp_verify');
    } catch (error: any) {
      console.error("OTP verification error:", error);
      eventService.trackAuth('login', 'failure', 'otp_verify', {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async (
    opts?: SignOutOpts,
  ): Promise<SignOutResult> => {
    setIsLoading(true);
    let offline = false;
    // P0 (session-persistence review): mark this sign-out as
    // user-initiated BEFORE the network call. The onAuthStateChange
    // listener checks this ref when SIGNED_OUT fires so it can suppress
    // the "Session expired" alert for the manual path. Reset in
    // `finally` regardless of success / failure.
    isManualSignOutRef.current = true;
    try {
      eventService.trackAuth('logout', 'success');
      // Flush event buffer BEFORE revoking the JWT. Otherwise the next flush
      // hits user_events with a stale token, gets 401, and trips
      // EventService's 5-minute self-pause (which silently drops events).
      await eventService.flush();

      // P0 (logout review): purge non-preference AsyncStorage keys before
      // revoking the JWT. The whitelist preserves user settings (locale,
      // theme, biometric opt-in, remember-me identifier, etc.); everything
      // else — cached financial state, score data, Supabase JS's own
      // session-token key — goes here. Best-effort: a getAllKeys/
      // multiRemove failure is logged but doesn't block sign-out.
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const toRemove = allKeys.filter((k) => !shouldPreserveOnSignout(k));
        if (toRemove.length > 0) {
          await AsyncStorage.multiRemove(toRemove);
        }
      } catch (e) {
        console.warn(
          "[AuthContext] AsyncStorage cleanup on sign-out failed",
          e,
        );
      }

      // P0 (kyc-trigger review): drop any deferred action so it can't
      // leak into the next user's session. The blanket multiRemove
      // above already covers it (the key isn't on the preserve list)
      // but calling the typed helper here keeps the intent visible
      // and survives any future change to the whitelist.
      await clearDeferredAction();

      // P2 (logout review): wrap the network call in its own catch so an
      // offline failure (e.g. no connectivity, Supabase 5xx) doesn't block
      // local cleanup. The user always ends up signed out on this device;
      // the offline flag bubbles up so the screen can surface a toast.
      try {
        const { error } = await supabase.auth.signOut({
          scope: opts?.scope ?? "local",
        });
        if (error) throw error;
      } catch (netErr) {
        offline = true;
        console.warn(
          "[AuthContext] supabase.auth.signOut failed — proceeding with local cleanup",
          netErr,
        );
      }

      // Purge the keystore-stashed refresh token and the mirror flag so the
      // biometric button stops rendering. Best-effort — don't fail logout
      // if keystore delete blips.
      try {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      } catch {
        /* ignore */
      }
      try {
        await AsyncStorage.removeItem(HAS_REFRESH_TOKEN_FLAG_KEY);
      } catch {
        /* ignore */
      }
      setHasStoredRefreshToken(false);

      setSession(null);
      setUser(null);
      setIsLocked(false);
      return { offline };
    } catch (error: any) {
      console.error("Sign out error:", error);
      eventService.trackAuth('logout', 'failure', undefined, {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
      isManualSignOutRef.current = false;
    }
  };

  // Callable escape hatch for callers that catch a stale-token error
  // ("Invalid Refresh Token", AuthApiError 401) from a Supabase RPC /
  // select. Supabase's auto-refresh normally fires SIGNED_OUT on refresh
  // failure — but if the stale token surfaces mid-operation the
  // SIGNED_OUT event can lag or never come, leaving the user staring
  // at a broken screen while their session is dead. Kicks the same
  // "Session expired" alert + Login reset the auto-expiry path uses.
  //
  // Does NOT set isManualSignOutRef, so the SIGNED_OUT listener
  // (see line 618) will still recognise this as auto and run
  // handleAutoSessionExpiry(). A local supabase.auth.signOut() network
  // failure is also fine — we call the expiry handler + null out
  // React state as a fallback so the tree unmounts either way.
  const notifySessionExpired = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn(
        "[AuthContext] notifySessionExpired supabase.auth.signOut failed — running fallback",
        e,
      );
      if (!autoExpiryHandledRef.current) {
        autoExpiryHandledRef.current = true;
        handleAutoSessionExpiry();
      }
      setSession(null);
      setUser(null);
    }
  };

  // Sign up with email and password
  const signUp = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone,
        options: {
          data: {
            name,
            full_name: name,
            xn_score: 25, // Starting XnScore — grows through activity
          },
          // Redirect to /auth/confirm (AuthCallbackScreen) after email
          // verification — that screen reads the auth tokens from the URL
          // hash/query and navigates forward. Not /verify-email (that's the
          // pre-click waiting room).
          emailRedirectTo: getEmailRedirectUrl("auth/confirm"),
        },
      });

      if (error) throw error;

      // If email confirmation is required, user won't be logged in yet
      if (data.session) {
        setSession(data.session);
        setUser(formatUser(data.user));
        setIsLocked(false);
        // P0 (legal-docs review): session is live → record acceptance
        // synchronously. Helper swallows its own errors, so signup
        // still succeeds even if the RPC isn't deployed yet or the
        // active legal_documents rows aren't populated.
        void recordSignupAcceptances();
      } else {
        // P0 (legal-docs review): no session yet (email confirmation
        // path). Set the flag so the SIGNED_IN handler can drain it
        // once AuthCallback establishes the session post-verify.
        try {
          await AsyncStorage.setItem(PENDING_SIGNUP_ACCEPTANCE_KEY, "true");
        } catch (e) {
          console.warn(
            "[AuthContext] failed to write pending signup-acceptance flag",
            (e as Error)?.message,
          );
        }
      }
      eventService.trackAuth('signup', 'success', 'email');
    } catch (error: any) {
      console.error("Sign up error:", error);
      eventService.trackAuth('signup', 'failure', 'email', {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // P2 (profile review): single source of truth. We write only to the
  // `profiles` table here; migration 167's trg_sync_profile_to_auth
  // copies full_name → auth.users.raw_user_meta_data and phone →
  // auth.users.phone. After the write we refresh `user` from
  // auth.getUser() so consumers (which still read from the formatted
  // `user`) see the new values without a sign-out / reload.
  //
  // Note: we intentionally do NOT route phone changes through
  // supabase.auth.updateUser({ phone }) here — that would kick off
  // Supabase's OTP confirmation flow, which is the wrong UX when the
  // caller is e.g. ProfileScreen's "Save" button for a name change.
  // Phone *verification* is a separate flow (requestPhoneChange) so
  // each writer surface can opt in deliberately.
  const updateProfile = async (data: { name?: string; phone?: string }) => {
    if (!user?.id) throw new Error("Not authenticated");
    setIsLoading(true);
    try {
      const updates: Record<string, any> = {};
      if (data.name !== undefined) updates.full_name = data.name;
      if (data.phone !== undefined) updates.phone = data.phone || null;
      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;

      // Pull the freshly synced auth.users row so the in-memory `user`
      // reflects the trigger's write to raw_user_meta_data / phone.
      const { data: refreshed } = await supabase.auth.getUser();
      if (refreshed?.user) setUser(formatUser(refreshed.user));
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // P2 (profile review): kick off the phone-change SMS flow. Supabase
  // stamps auth.users.phone_change + .phone_change_token and sends an
  // OTP to the *new* number — the existing phone (if any) stays
  // active until the OTP succeeds.
  const requestPhoneChange = async (newPhone: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: newPhone });
      if (error) throw error;
    } catch (error: any) {
      console.error("Request phone change error:", error);
      // Rewrite the two failure modes that surface to the toast so users
      // don't see raw supabase-js error strings:
      //   * "Unable to get SMS provider" — GoTrue can't reach Twilio
      //     because the project's SMS provider isn't configured (or the
      //     Twilio secret is unset). Not a user-fixable problem.
      //   * "SMS rate limit exceeded" — GoTrue throttled us.
      // Anything else falls through with the original error preserved for
      // the console breadcrumb but a generic message for the user.
      const raw = String(error?.message ?? "");
      let friendly: string | null = null;
      if (/unable to get sms provider/i.test(raw)) {
        friendly = "Phone verification is temporarily unavailable. Please try again later or contact support.";
      } else if (/sms.*rate limit|rate limit.*sms/i.test(raw)) {
        friendly = "Too many verification requests. Please wait a few minutes and try again.";
      }
      if (friendly) {
        const rewritten = new Error(friendly) as Error & { code?: string };
        rewritten.code = "sms_unavailable";
        throw rewritten;
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // P2 (profile review): completes the SMS OTP issued by
  // requestPhoneChange and flips profiles.phone_verified = true. After
  // this returns, the sync trigger has already copied the new phone
  // into profiles.phone (Supabase's own flow updated auth.users.phone),
  // so we only need to update the verified flag here.
  const verifyPhoneFromProfile = async (phone: string, token: string) => {
    if (!user?.id) throw new Error("Not authenticated");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "phone_change",
      });
      if (error) throw error;

      // Mirror auth.users.phone onto profiles + flip phone_verified. We
      // write phone explicitly so the trigger short-circuit ("nothing
      // changed") still allows the verified flag through.
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ phone, phone_verified: true })
        .eq("id", user.id);
      if (profErr) throw profErr;

      if (data?.user) setUser(formatUser(data.user));
      eventService.trackAuth("login", "success", "phone_change_verify");
    } catch (error: any) {
      console.error("Verify phone from profile error:", error);
      eventService.trackAuth("login", "failure", "phone_change_verify", {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // P2 (profile review): triggers a Supabase confirmation email to
  // newEmail. auth.users.email stays on the current address until the
  // user clicks the link; auth.users.new_email holds the pending value
  // (which the UI renders as a "Pending verification" badge). The
  // confirmation flow lives in AuthCallbackScreen.
  const requestEmailChange = async (newEmail: string) => {
    setIsLoading(true);
    try {
      // emailRedirectTo mirrors what signUp does at line ~1454 — the
      // confirmation link Supabase mails will now deep-link back into
      // the app at /auth/confirm (AuthCallbackScreen), which reads the
      // tokens from the URL and completes the auth flow. Without this
      // the link opens whatever the project's default Site URL is.
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: getEmailRedirectUrl("auth/confirm") },
      );
      if (error) throw error;
    } catch (error: any) {
      console.error("Request email change error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update XnScore (for testing/admin purposes)
  const updateXnScore = async (score: number) => {
    setIsLoading(true);
    try {
      const { data: updatedUser, error } = await supabase.auth.updateUser({
        data: {
          xn_score: score,
        },
      });

      if (error) throw error;

      setUser(formatUser(updatedUser.user));
    } catch (error) {
      console.error("Update XnScore error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        // pendingMfa gates this false — the AAL1 session lives in
        // supabase.auth (so the listener already set user/session) but
        // we don't consider the sign-in complete until the TOTP code
        // has been verified.
        isAuthenticated: !!session && !!user && !pendingMfa,
        // Supabase stamps email_confirmed_at when the magic-link target
        // (auth/confirm) resolves successfully. The string is present
        // and non-null on a verified session; missing on a fresh signup
        // session that hasn't completed the link yet.
        isEmailVerified: !!session?.user?.email_confirmed_at,
        isLocked,
        biometricsEnabled,
        biometricsAvailable,
        signIn,
        signInWithPhone,
        signInWithOAuth,
        verifyOTP,
        signOut,
        signUp,
        updateProfile,
        requestPhoneChange,
        verifyPhoneFromProfile,
        requestEmailChange,
        updateXnScore,
        refreshKyc,
        lockApp,
        unlockWithBiometrics,
        unlockWithPassword,
        setBiometricsEnabled,
        hasStoredRefreshToken,
        signInWithBiometrics,
        enableBiometrics,
        hasAskedBiometricOptIn,
        markBiometricOptInAsked,
        isOffline,
        retryRefresh,
        pendingMfa,
        verifyMfaAndComplete,
        cancelMfaChallenge,
        notifySessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
