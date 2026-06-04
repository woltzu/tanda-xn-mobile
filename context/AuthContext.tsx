import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { eventService } from "../services/EventService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Linking from "expo-linking";

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

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  xnScore: number;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name: string,
    phone?: string
  ) => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  updateXnScore: (score: number) => Promise<void>;
  lockApp: () => void;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPassword: (password: string) => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BIOMETRICS_ENABLED_KEY = "@tandaxn_biometrics_enabled";

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
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

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
      } catch (error) {
        console.error("Error checking biometrics:", error);
      }
    };

    checkBiometrics();
  }, []);

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
        if (lastRecordedUserIdRef.current !== session.user.id) {
          lastRecordedUserIdRef.current = session.user.id;
          recordLoginEvent(session.user.id);
        }
      } else if (event === "SIGNED_OUT") {
        lastRecordedUserIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refs for login-event recording dedup (Stress Signal C).
  // lastRecordedUserIdRef tracks the most recently logged-event user_id
  // for THIS app instance — survives across React strict-mode double-mounts
  // and TOKEN_REFRESHED events. Cleared on SIGNED_OUT.
  const lastRecordedUserIdRef = useRef<string | null>(null);

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

  // Unlock with password (re-authenticate with Supabase)
  const unlockWithPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!user?.email) return false;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });

        if (error) {
          console.error("Password unlock error:", error);
          return false;
        }

        if (data.session) {
          setSession(data.session);
          setIsLocked(false);
          return true;
        }

        return false;
      } catch (error) {
        console.error("Password unlock error:", error);
        return false;
      }
    },
    [user?.email]
  );

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

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSession(data.session);
      setUser(formatUser(data.user));
      setIsLocked(false);
      eventService.trackAuth('login', 'success', 'email');
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
  const signOut = async () => {
    setIsLoading(true);
    try {
      eventService.trackAuth('logout', 'success');
      // Flush event buffer BEFORE revoking the JWT. Otherwise the next flush
      // hits user_events with a stale token, gets 401, and trips
      // EventService's 5-minute self-pause (which silently drops events).
      await eventService.flush();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setUser(null);
      setIsLocked(false);
    } catch (error: any) {
      console.error("Sign out error:", error);
      eventService.trackAuth('logout', 'failure', undefined, {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
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

  // Update user profile
  const updateProfile = async (data: { name?: string; phone?: string }) => {
    setIsLoading(true);
    try {
      const updates: { data?: Record<string, string>; phone?: string } = {};

      if (data.name) {
        updates.data = {
          name: data.name,
          full_name: data.name,
        };
      }

      if (data.phone) {
        updates.phone = data.phone;
      }

      const { data: updatedUser, error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      setUser(formatUser(updatedUser.user));
    } catch (error) {
      console.error("Update profile error:", error);
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
        isAuthenticated: !!session && !!user,
        isLocked,
        biometricsEnabled,
        biometricsAvailable,
        signIn,
        signInWithPhone,
        verifyOTP,
        signOut,
        signUp,
        updateProfile,
        updateXnScore,
        lockApp,
        unlockWithBiometrics,
        unlockWithPassword,
        setBiometricsEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
