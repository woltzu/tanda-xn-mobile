import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
  Image,
  TextInput,
  RefreshControl,
  Linking,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
// Phase 2 (migration 258) — tiered profile visibility. useProfileView
// calls get_profile_view which projects through a per-viewer filter.
// For self this returns the full set; for other viewers fields the
// caller isn't allowed to see come back as NULL. useProfile still owns
// the editable form fields (country, round_up_increment, …) that the
// view RPC doesn't surface.
import { useProfileView } from "../hooks/useProfileView";
import AvatarPicker from "../components/AvatarPicker";
import { useXnScoreFromBundle } from "../hooks/useXnScore";
import { useWallet } from "../context/WalletContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdvanceDashboard } from "../hooks/useAdvanceDashboard";
// Phase 2 Bucket A — Member Access Tiers governance role (member /
// verified_member / elder_i / _ii / _iii). Drives the role badge in
// the header and the elder-only Governance section below.
import { useRoles } from "../hooks/useRoles";
// Phase 2 Bucket C — gate Delete account row on critical tier (delete_account
// RPC also raises, but client-side gate gives a better UX than an error toast).
import { useResolutionStatus } from "../hooks/useResolutionStatus";
// Phase 1A: Verified Provider Network — surfaces "Become a provider" if
// the user has no provider row yet, or "Provider dashboard" if they do.
import { useProviderDashboard } from "../hooks/useProviders";
import { supabase } from "../lib/supabase";
import { XnScoreEngine, Vouch } from "../services/XnScoreEngine";
import { showToast } from "../components/Toast";
import { resetDashboardTour } from "../components/DashboardTourOverlay";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useEventTracker } from "../hooks/useEventTracker";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { colors } from "../theme/tokens";

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

// Empty FlatList sentinel — see the identical comment in HomeScreen.
const PROFILE_FLAT_DATA: readonly never[] = [];
const renderProfileFlatItem = () => null;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { t } = useTranslation();
  const { user, signOut, updateProfile } = useAuth();
  // P1 (profile review): central fetch with 60 s cache. Replaces the
  // ad-hoc supabase.from('profiles').select(...) round-trip the screen
  // used to run on every mount.
  // Open profile Bucket B — pull `loading` so the "Complete your
  // profile" banner can stay hidden while the cache populates, and
  // pull each context's refresh method so pull-to-refresh fans out
  // in parallel.
  const { profile, loading: profileLoading, refetch: refetchProfile } =
    useProfile();
  // Phase 2 (migration 258) — tiered view. For the current user this
  // returns the SELF projection (all visible fields). The display-name /
  // email / avatar surfaces on the header card source from here so the
  // screen renders the same canonical values it would when a co-community
  // peer views this profile (modulo redacted fields). Editable form fields
  // still come from useProfile because the view RPC doesn't surface them.
  const {
    profile: viewProfile,
    isLoading: viewProfileLoading,
    refresh: refreshViewProfile,
  } = useProfileView(user?.id);
  // Bucket A — XnScoreContext retired; read the real score from the
  // shared bundle the ScoreHub fills. `score` is `number | null` while
  // the bundle is loading; the row below renders an em-dash for null.
  const { score, refresh: refreshScore } = useXnScoreFromBundle();
  const { balance: walletBalance, refreshWallet } = useWallet();
  // Moderation P0 (2026-06-13): platform-admin tools section. Hidden for
  // non-admins; surfaces both the moderation queue and the AI ops health
  // monitor (previously dev-only). Source of truth is admin_users via
  // public.is_admin() — see migration 114.
  const { isAdmin } = useIsAdmin();
  // Phase 2 Bucket A — role badge + governance section gating.
  const { role, isElder, honorScore } = useRoles(user?.id);
  // Phase 2 Bucket C — used by handleDeleteAccount to short-circuit
  // before the RPC if the user is in critical tier.
  const { isCritical } = useResolutionStatus(user?.id);
  // Autopay-review P0 (2026-06-15): autopay only makes sense if the
  // user has an active advance. Hide the Payment Settings section
  // entirely when there's nothing to configure, so the menu row no
  // longer routes users to a mock-only screen.
  const { data: advanceDashboard } = useAdvanceDashboard();
  const { isProvider } = useProviderDashboard();
  const hasActiveAdvance =
    (advanceDashboard?.active_advances?.length ?? 0) > 0;

  // Send-Money P2 (2026-06-14): round-up sends preference. Stored in
  // profiles.round_up_increment (migration 154). 0 = off, 1/5/10 = round
  // every send up to the next dollar / $5 / $10 and sweep the delta into
  // the user's "Round-up Savings" goal.
  const [roundUpIncrement, setRoundUpIncrement] = useState<number>(0);
  const [roundUpModalOpen, setRoundUpModalOpen] = useState(false);
  // Sign-out in-flight flag — drives the button spinner and disabled state.
  // Reset to false in the catch branch so the user can retry; on success
  // the navigation.reset unmounts the screen, no cleanup needed.
  const [isSigningOut, setIsSigningOut] = useState(false);

  // KYC badge — fetched via migration 268's get_kyc_status RPC.
  // null while loading; one of 'none' | 'pending' | 'verified' | 'rejected'
  // once resolved. Re-fetched on focus so returning from KYCHub shows the
  // fresh status.
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  // Vouches state — hoisted here so both the header trust badge and the
  // inline VouchesSection share one fetch. Refreshed on focus and after
  // every revoke round-trip.
  const [vouchesReceived, setVouchesReceived] = useState<Vouch[]>([]);
  const [vouchesGiven, setVouchesGiven] = useState<Vouch[]>([]);
  const [vouchesLoading, setVouchesLoading] = useState(true);

  const refreshVouches = useCallback(async () => {
    if (!user?.id) {
      setVouchesLoading(false);
      return;
    }
    setVouchesLoading(true);
    try {
      const [r, g] = await Promise.all([
        XnScoreEngine.getVouchesReceived(user.id).catch(
          () => [] as Vouch[],
        ),
        XnScoreEngine.getVouchesGiven(user.id).catch(() => [] as Vouch[]),
      ]);
      setVouchesReceived(
        (r || []).filter((v) => v.vouch_status === "active"),
      );
      setVouchesGiven(
        (g || []).filter((v) => v.vouch_status === "active"),
      );
    } finally {
      setVouchesLoading(false);
    }
  }, [user?.id]);

  const handleRevokeVouch = useCallback(
    (vouchId: string, name: string) => {
      Alert.alert(
        "Revoke vouch",
        `Revoke your vouch for ${name}? Their XnScore will drop by the vouch value and yours will drop by 0.5.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              try {
                await XnScoreEngine.revokeVouch(vouchId);
                await refreshVouches();
              } catch (err: any) {
                Alert.alert(
                  "Revoke failed",
                  err?.message || "Please try again.",
                );
              }
            },
          },
        ],
      );
    },
    [refreshVouches],
  );
  // P1 (profile review): avatar + name editing surfaces.
  const [avatarErrored, setAvatarErrored] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState<string>("");
  // Phase 2 (migration 258) — display-tier sources. viewProfile is the
  // canonical projection; fall back to useProfile / auth user only while
  // viewProfile is still loading so the header doesn't flash empty on
  // cold start.
  const avatarUrl =
    viewProfile?.avatar_url ?? profile?.avatar_url ?? null;
  const displayName =
    viewProfile?.full_name ??
    viewProfile?.display_name ??
    user?.name ??
    "";
  const displayEmail = viewProfile?.email ?? user?.email ?? "";

  // ──────────────────────────────────────────────────────────────────
  // Open profile Bucket B — pull-to-refresh + focus refetch.
  // ──────────────────────────────────────────────────────────────────
  // Focus refetch: after editing avatar / name / country in
  // PersonalInfoScreen, the user navigates back here. Without this the
  // useProfile cache could be stale for up to 60s; refetch on focus
  // makes the change land instantly.
  //
  // Bucket C — also emit telemetry on every focus. trackScreenView
  // self-dedupes consecutive same-screen views inside EventService, so
  // navigation A→Profile→A→Profile counts as two opens (correct), but
  // a focus loop on the same screen mount doesn't double-fire.
  const { trackScreenView, track } = useEventTracker();
  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      trackScreenView("Profile");
      track({
        eventType: "profile_opened",
        eventCategory: "settings",
        eventAction: "opened",
      });
      // Refresh KYC status on every focus — covers the case where the
      // user just finished a verification flow in KYCHub and is now back
      // here. Best-effort: a failure leaves the badge at its prior
      // value (or hidden if never resolved).
      (async () => {
        try {
          const { data, error } = await supabase.rpc("get_kyc_status");
          if (error) return;
          const next = (data as { status?: string } | null)?.status;
          if (typeof next === "string") setKycStatus(next);
        } catch {
          /* best-effort */
        }
      })();
      // Refresh vouches on focus so a vouch just created / revoked
      // elsewhere (e.g. VouchMemberScreen) shows the latest state.
      refreshVouches();
    }, [refetchProfile, trackScreenView, track, refreshVouches]),
  );

  // Pull-to-refresh: fans out the three context refetches in parallel.
  // Local refreshing state (decoupled from any of the contexts' own
  // loading flags) drives the indicator alone — the per-card loading
  // surfaces inside the menu don't reappear during the pull.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refetchProfile(),
        refreshViewProfile(),
        refreshScore(),
        refreshWallet(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, refreshViewProfile, refreshScore, refreshWallet]);

  // Open profile Bucket B — required-fields completeness signal.
  // Drives the "Complete your profile" banner below the header.
  // Optional date_of_birth is excluded for P0 (it's required for KYC
  // separately; surfacing it here would double-prompt).
  const PROFILE_REQUIRED_FIELDS: Array<keyof NonNullable<typeof profile>> = [
    "avatar_url",
    "full_name",
    "country",
    "phone",
  ];
  const completedCount = profile
    ? PROFILE_REQUIRED_FIELDS.filter((k) => {
        const v = profile[k];
        return typeof v === "string" ? v.trim().length > 0 : v != null;
      }).length
    : 0;
  const totalCount = PROFILE_REQUIRED_FIELDS.length;
  const showCompletionBanner =
    !profileLoading && profile !== null && completedCount < totalCount;
  // Sync the locally-cached round-up state from the central profile
  // hook. We keep the local state so the round-up modal can update
  // optimistically before refetch lands.
  useEffect(() => {
    if (typeof profile?.round_up_increment === "number") {
      setRoundUpIncrement(profile.round_up_increment);
    }
    setAvatarErrored(false);
  }, [profile?.round_up_increment, profile?.avatar_url]);

  const saveRoundUp = async (next: number) => {
    if (!user?.id) return;
    const prev = roundUpIncrement;
    setRoundUpIncrement(next); // optimistic
    setRoundUpModalOpen(false);
    const { error } = await supabase
      .from("profiles")
      .update({ round_up_increment: next })
      .eq("id", user.id);
    if (error) {
      setRoundUpIncrement(prev);
      Alert.alert(
        t("profile.round_up_save_failed_title"),
        error.message,
      );
    }
  };

  const roundUpLabel = (n: number): string =>
    n === 0
      ? t("profile.round_up_off")
      : t("profile.round_up_value", { n: `$${n}` });

  // P1 (profile review): inline name editor on the header card. Tap
  // name → swap to TextInput → blur or "Done" → save via the same
  // updateProfile() the PersonalInfoScreen uses. Refetch hits
  // useProfile()'s cache buster.
  const beginEditingName = () => {
    setDraftName(displayName);
    setEditingName(true);
  };
  const commitName = async () => {
    const next = draftName.trim();
    setEditingName(false);
    if (!next || next === displayName) return;
    try {
      await updateProfile({ name: next });
      // Refetch both the raw-columns hook (useProfile) and the tiered
      // view (useProfileView) so the header re-renders with the new name
      // sourced from the canonical view RPC.
      await Promise.allSettled([refetchProfile(), refreshViewProfile()]);
      showToast(t("profile.name_saved_toast"), "success");
    } catch (err: any) {
      showToast(err?.message ?? t("profile.name_save_failed_toast"), "error");
    }
  };
  const cancelEditingName = () => {
    setEditingName(false);
    setDraftName("");
  };

  // Store submission — Contact Support row. Opens the OS mail client to
  // support@tandaxn.com. Failing openURL (no mail app configured) falls
  // through to an Alert showing the address so the user can copy it.
  const handleContactSupport = useCallback(async () => {
    const url = "mailto:support@tandaxn.com";
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("no-mail-handler");
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t("profile.contact_support"),
        "support@tandaxn.com",
        [{ text: t("common.ok") }],
      );
    }
  }, [t]);

  // Phase 2 Bucket C — Delete account. Two-step confirmation, then RPC.
  // Critical-tier users are blocked client-side via useResolutionStatus
  // (the isCritical branch); the server-side delete_account RPC double-
  // checks and raises if a critical user somehow gets through (e.g.,
  // stale local state). On success, sign out + restart auth flow — the
  // user_deletion_requests cron processes the actual data drop 30 days
  // later.
  const handleDeleteAccount = async () => {
    if (isCritical) {
      const msg = t("resolution_center.cannot_delete_account");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(msg);
      } else {
        Alert.alert(t("account.delete_blocked_title"), msg, [
          { text: t("common.ok") },
          {
            text: t("resolution_center.go_to_resolution"),
            onPress: () => navigation.navigate("ResolutionCenter"),
          },
        ]);
      }
      return;
    }
    const proceed = async () => {
      try {
        const { error: e } = await supabase.rpc("delete_account", {
          p_reason: "User-initiated deletion from Profile screen",
        });
        if (e) throw new Error(e.message);
        showToast(t("account.delete_success"));
        // Sign out so the session can't continue against a queued-for-
        // deletion account. The 30-day window means the user can email
        // support to cancel before processing.
        await signOut();
      } catch (err: any) {
        const body = err?.message ?? t("account.delete_failed");
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert(body);
        } else {
          Alert.alert(t("account.delete_failed_title"), body);
        }
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(t("account.delete_confirm"))) await proceed();
    } else {
      Alert.alert(
        t("account.delete_confirm_title"),
        t("account.delete_confirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("account.delete_confirm_yes"), style: "destructive", onPress: proceed },
        ],
      );
    }
  };

  const handleSignOut = async () => {
    console.log("[ProfileScreen] sign out tapped");

    // P2 (logout review): three-way confirmation. The user can sign
    // out only this device (default) or revoke every session attached
    // to the user (global scope). Alert.alert button callbacks are
    // flaky on react-native-web, so web uses two chained
    // window.confirms; native uses a single 3-button Alert.
    const choice: { confirmed: boolean; global: boolean } =
      Platform.OS === "web"
        ? (typeof window !== "undefined" && typeof window.confirm === "function"
            ? (() => {
                const proceed = window.confirm(
                  t("profile.sign_out_confirm_body"),
                );
                if (!proceed) return { confirmed: false, global: false };
                const allDevices = window.confirm(
                  t("profile.sign_out_all_devices"),
                );
                return { confirmed: true, global: allDevices };
              })()
            : { confirmed: true, global: false })
        : await new Promise<{ confirmed: boolean; global: boolean }>(
            (resolve) => {
              Alert.alert(
                t("profile.sign_out_confirm_title"),
                t("profile.sign_out_confirm_body"),
                [
                  {
                    text: t("common.cancel"),
                    style: "cancel",
                    onPress: () =>
                      resolve({ confirmed: false, global: false }),
                  },
                  {
                    text: t("profile.sign_out"),
                    onPress: () =>
                      resolve({ confirmed: true, global: false }),
                  },
                  {
                    text: t("profile.sign_out_all_devices"),
                    style: "destructive",
                    onPress: () =>
                      resolve({ confirmed: true, global: true }),
                  },
                ],
                {
                  cancelable: true,
                  onDismiss: () =>
                    resolve({ confirmed: false, global: false }),
                },
              );
            },
          );

    if (!choice.confirmed) {
      console.log("[ProfileScreen] sign out cancelled");
      return;
    }

    setIsSigningOut(true);
    try {
      // P0 (logout review): drive sign-out through the AuthContext so the
      // whitelist AsyncStorage purge actually runs — the previous direct
      // supabase.auth.signOut() bypassed it. AuthContext flushes events,
      // purges non-preference keys, then revokes the JWT.
      // P2: pass the user's scope choice and read the offline flag from
      // the result. Offline still navigates (the local session is gone);
      // we just surface a toast so the user knows the revocation will
      // sync when they're back online.
      console.log(
        `[ProfileScreen] calling AuthContext.signOut scope=${
          choice.global ? "global" : "local"
        }`,
      );
      const { offline } = await signOut({
        scope: choice.global ? "global" : "local",
      });
      if (offline) {
        showToast(t("profile.sign_out_offline_toast"), "info");
      }
      // Route straight to Login — Welcome is a marketing intro screen
      // that's irrelevant for someone who just signed out; they almost
      // always want to sign back in.
      console.log("[ProfileScreen] signOut complete, navigating to Login");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      // No need to setIsSigningOut(false) — navigation.reset unmounts
      // this screen, the state goes with it.
    } catch (err: any) {
      console.error("[ProfileScreen] sign out error", err);
      // Re-enable the button so the user can retry without re-tapping
      // the menu, then surface the error.
      setIsSigningOut(false);
      const msg = err?.message ?? t("profile.sign_out_failed_default");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(`${t("profile.sign_out_failed_title")}: ${msg}`);
      } else {
        Alert.alert(t("profile.sign_out_failed_title"), msg);
      }
    }
  };

  // i18n: menuItems is built inside the component so t() reads the
  // current language on every render. Each section uses a translated
  // section title; each item a translated label.
  const menuItems = [
    {
      section: t("profile.section_account"),
      items: [
        { icon: "person-outline", label: t("profile.item_personal_info"), onPress: () => navigation.navigate("PersonalInfo") },
        // Permanent entry point for the Resolution Center — fallback for
        // users whose account is restricted but who miss / mistap the
        // red CriticalBanner at the very top of every screen. Also
        // useful for users NOT currently restricted who want to check
        // their status. Same destination as the banner. Falls back to
        // English if the i18n key isn't defined yet in the current
        // locale (adding it across all locale files is a follow-up).
        { icon: "shield-outline", label: t("profile.item_account_status", { defaultValue: "Account status" }), onPress: () => navigation.navigate("ResolutionCenter") },
        { icon: "shield-checkmark-outline", label: t("profile.item_security"), onPress: () => navigation.navigate("SecuritySettings") },
        { icon: "card-outline", label: t("profile.item_payment_methods"), onPress: () => navigation.navigate("LinkedAccounts") },
        { icon: "arrow-redo-outline", label: t("profile.item_payout_destination"), onPress: () => navigation.navigate("PayoutPreferences", undefined) },
        { icon: "wallet-outline", label: t("profile.item_wallet"), value: `$${walletBalance.toFixed(2)}`, onPress: () => navigation.navigate("WalletMain") },
        // P0 (notification-prefs review, 2026-06-15): the "Notifications"
        // row used to live here and on Settings → both routed to the
        // same screen. Profile now stays focused on identity/money
        // (per the profile P1 review) and Settings owns Notifications.
        // Send-Money P2 — round-up jar preference. Row shows the current
        // setting; tapping it opens the picker.
        { icon: "trending-up-outline", label: t("profile.item_round_up"), value: roundUpLabel(roundUpIncrement), onPress: () => setRoundUpModalOpen(true) },
      ],
    },
    {
      section: t("profile.section_trust"),
      items: [
        // Honor Bucket A — Honor System screen retired; the entry now
        // routes to the real Honor Score Overview (real data + 3-pillar
        // breakdown + canonical tier ladder).
        { icon: "ribbon-outline", label: t("profile.item_honor_system"), onPress: () => navigation.navigate("HonorScoreOverview") },
        { icon: "hand-right-outline", label: t("profile.item_vouch"), onPress: () => navigation.navigate("VouchMember") },
        // Member-trip-status Bucket A.3 — participants need a back-door
        // entry to their joined trips. Sits in the trust section since
        // it's a "your commitments" surface, not a discovery one.
        { icon: "briefcase-outline", label: t("profile.item_my_trips"), onPress: () => navigation.navigate("MyTrips") },
        // Phase 2 (migration 264 scaffold) — entry to the substitute
        // dashboard. Houses the availability toggle and a read-only
        // directory; rotation activation lands in a follow-up bucket.
        { icon: "swap-horizontal-outline", label: t("profile.item_substitute"), onPress: () => navigation.navigate("SubstituteDashboard") },
      ],
    },
    // Verified Provider Network (Phase 1A). Single row that switches
    // between "Become a provider" (entry to the application wizard) and
    // "Provider dashboard" (placeholder Alert until Phase 1B ships the
    // dashboard surface). Always includes a "Browse providers" entry so
    // diaspora-side users without a provider record can still discover.
    {
      section: t("profile.section_provider_network"),
      items: [
        { icon: "storefront-outline", label: t("profile.item_browse_providers"), onPress: () => navigation.navigate("ProviderList") },
        isProvider
          ? {
              icon: "speedometer-outline",
              label: t("profile.item_provider_dashboard"),
              onPress: () => navigation.navigate("ProviderDashboard"),
            }
          : {
              icon: "add-circle-outline",
              label: t("profile.item_become_provider"),
              onPress: () => navigation.navigate("ProviderApplication"),
            },
      ],
    },
    {
      section: t("profile.section_community"),
      items: [
        { icon: "people-circle-outline", label: t("profile.item_my_communities"), onPress: () => navigation.navigate("MyCommunities") },
        // Circle Contribution Autopay — Phase 0 (2026-06-15). Always
        // visible because eligibility depends on the user's circle
        // membership, which the management screen surfaces (empty
        // state walks the user through adding their first config).
        { icon: "repeat-outline", label: t("profile.item_circle_autopay"), onPress: () => navigation.navigate("CircleAutopayManagement") },
      ],
    },
    // Autopay-review P0 (2026-06-15): only render this section when the
    // user has at least one active advance — the linked AutopaySetup
    // screen has no useful state for users without an advance and used
    // to lead to a mock-only page.
    ...(hasActiveAdvance
      ? [
          {
            section: t("profile.section_payment_settings"),
            items: [
              { icon: "repeat-outline", label: t("profile.item_autopay_setup"), onPress: () => navigation.navigate("AutopaySetup") },
            ],
          },
        ]
      : []),
    {
      section: t("profile.section_preferences"),
      items: [
        { icon: "globe-outline", label: t("profile.item_language"), onPress: () => navigation.navigate("LanguageRegion") },
        { icon: "people-outline", label: t("profile.item_communities"), onPress: () => navigation.navigate("CommunityPreferences") },
        { icon: "eye-off-outline", label: t("profile.item_privacy"), onPress: () => navigation.navigate("PrivacySettings") },
        // Stripe Connect entry intentionally hidden from user-facing UI.
        // Payouts will surface as a generic "Withdraw to bank" flow once
        // built; Connect stays as an implementation detail. The
        // StripeConnectScreen route is still registered in App.tsx and
        // reachable via deep link for debugging / future organizer flows.
        { icon: "cog-outline", label: t("profile.item_all_settings"), onPress: () => navigation.navigate("Settings") },
        // Store-submission review — a visible support entry is a Play /
        // App Store requirement. Opens mailto:support@tandaxn.com with an
        // Alert fallback when no mail handler is installed.
        { icon: "mail-outline", label: t("profile.contact_support"), onPress: handleContactSupport },
        // Re-open the first-launch Dashboard tour. Clears the seen flag,
        // sets the force-show flag, then pops back to the Home tab so
        // DashboardScreen regains focus → DashboardTourOverlay's
        // useFocusEffect picks up the force flag and renders the tour.
        {
          icon: "play-circle-outline",
          label: t("dashboard_tour.reopen_button"),
          onPress: async () => {
            await resetDashboardTour();
            navigation.navigate("Dashboard");
          },
        },
        // Phase 2 Bucket C — Delete account. Routes through delete_account
        // RPC which queues a user_deletion_requests row for the 4am cron
        // and blocks critical-tier users. Sits in Preferences (not its own
        // section) so it's not the first thing a user sees.
        { icon: "trash-outline", label: t("account.delete_account_label"), onPress: handleDeleteAccount },
      ],
    },
    // P1 (profile review): "Support" section removed — Help, FAQ,
    // Referral, Donation, About, Legal Documents now live behind the
    // existing "All Settings" entry in the Preferences section above.
    // Keeps the Profile screen focused on identity + money rather than
    // being a settings dump.
    // Phase 2 Bucket A — Governance section. Elder-only. Houses the
    // elder_nominations review queue and the standalone vouch_member
    // form. Sits above admin tools because it's role-based (not the
    // app-admin flag) and is intended to be a regular elder workflow,
    // not an exceptional admin one.
    ...(isElder
      ? [
          {
            section: t("profile.section_governance"),
            items: [
              {
                icon: "ribbon-outline",
                label: t("profile.item_elder_nominations"),
                onPress: () => navigation.navigate("ElderNominations"),
              },
              {
                icon: "shield-half-outline",
                label: t("profile.item_issue_vouch"),
                onPress: () => navigation.navigate("IssueExposureVouch"),
              },
            ],
          },
        ]
      : []),
    // Moderation P0 (2026-06-13): admin-only tools section. Appended at
    // the bottom of the menu so it never shadows a member-facing item.
    ...(isAdmin
      ? [
          {
            section: t("profile.section_admin_tools"),
            items: [
              {
                icon: "grid-outline",
                label: t("admin.title"),
                onPress: () => navigation.navigate("AdminHub"),
              },
              {
                icon: "shield-checkmark-outline",
                label: t("profile.item_moderation_queue"),
                onPress: () => navigation.navigate("AdminModeration"),
              },
              // Phase 2C — staged-disbursement verification queue.
              // Goal owners self-approve owner-method milestones inline;
              // elder/admin-method milestones land here for review.
              {
                icon: "clipboard-outline",
                label: t("profile.item_verification_queue"),
                onPress: () => navigation.navigate("AdminVerificationQueue"),
              },
              // Phase 5 (templates 2A) — community goal-template submissions.
              {
                icon: "albums-outline",
                label: t("profile.item_template_queue"),
                onPress: () => navigation.navigate("AdminTemplateQueue"),
              },
              {
                icon: "document-text-outline",
                label: t("profile.item_audit_trail"),
                onPress: () => navigation.navigate("PlatformAuditTrail"),
              },
              {
                icon: "pulse-outline",
                label: t("profile.item_ai_jobs_health"),
                onPress: () => navigation.navigate("AIJobsHealth"),
              },
              {
                icon: "bar-chart-outline",
                label: t("profile.item_advance_portfolio"),
                onPress: () => navigation.navigate("AdminDashboard"),
              },
            ],
          },
        ]
      : []),
  ];

  // Phase 2 (migration 258) — cold-load spinner. While the view RPC is
  // resolving for the first time (no cached profile yet), surface a
  // centered spinner rather than flashing an empty header card.
  if (viewProfileLoading && !viewProfile) {
    return (
      <View style={[styles.container, styles.centeredFill]}>
        <ActivityIndicator size="large" color={colors.accentTeal} />
      </View>
    );
  }
  // Defensive: get_profile_view always returns at least the anon
  // projection for any logged-in viewer, so on the user's own profile
  // this branch should never fire. Kept so the screen degrades cleanly
  // if the RPC errors (e.g. ID drift after a delete_account queued row
  // was processed and the session token outlived the row).
  if (!viewProfileLoading && !viewProfile && user?.id) {
    return (
      <View style={[styles.container, styles.centeredFill]}>
        <Ionicons name="person-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.unavailableTitle}>
          {t("profile.unavailable_title")}
        </Text>
        <Text style={styles.unavailableBody}>
          {t("profile.unavailable_body")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Outer surface: FlashList carrying the whole screen in
          ListHeaderComponent. FlashList runs its own virtualization
          + gesture path so the FlatList-only knobs are dropped and
          the AppFlashList wrapper handles the defaults. */}
      <AppFlashList
        data={PROFILE_FLAT_DATA}
        renderItem={renderProfileFlatItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentTeal}
            colors={[colors.accentTeal]}
          />
        }
        ListHeaderComponent={
          <View>
        {/* Header */}
        <LinearGradient colors={[colors.primaryNavy, "#143654"]} style={styles.header}>
          <Text style={styles.headerTitle}>{t("profile.header")}</Text>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* P1: tap avatar → picker. Whole circle is the hit
                target; visual is the avatar itself. */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setAvatarPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("avatar_picker.title")}
            >
              {avatarUrl && !avatarErrored ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  onError={() => setAvatarErrored(true)}
                />
              ) : (
                <LinearGradient
                  colors={[colors.accentTeal, "#00A896"]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {(displayName || "U").charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              <View style={styles.avatarEditChip}>
                <Ionicons name="camera" size={12} color={colors.cardBg} />
              </View>
            </TouchableOpacity>

            {/* P1: inline name editing. Tap → TextInput; blur or
                submit → updateProfile + toast. Esc-equivalent: tap
                away to commit (mobile back-press won't fire here). */}
            {editingName ? (
              <TextInput
                style={styles.userNameInput}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={commitName}
                onBlur={commitName}
                placeholder={t("profile.default_user")}
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={64}
              />
            ) : (
              <TouchableOpacity
                onPress={beginEditingName}
                accessibilityRole="button"
              >
                <Text style={styles.userName}>
                  {displayName || t("profile.default_user")}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.userEmail}>{displayEmail}</Text>

            {/* Phase 2 Bucket A — role badge. Hidden for the default
                'member' tier to avoid noise (every new user starts
                there). Shows the translated role name otherwise so
                verified_member / elder_i / _ii / _iii get visible
                identity affordances. */}
            {role && role !== "member" ? (
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={11} color={colors.cardBg} />
                <Text style={styles.roleBadgeText}>{t(`role.${role}`)}</Text>
              </View>
            ) : null}

            {/* Trust badge — shows when the user has at least one active
                vouch received. Non-interactive; the full vouch list lives
                in the VouchesSection card below. */}
            {vouchesReceived.length > 0 ? (
              <View style={styles.trustBadge}>
                <Ionicons name="ribbon" size={11} color={colors.cardBg} />
                <Text style={styles.roleBadgeText}>
                  {vouchesReceived.length === 1
                    ? "1 vouch received"
                    : `${vouchesReceived.length} vouches received`}
                </Text>
              </View>
            ) : null}

            {/* KYC badge — tap routes to KYCHub. Hidden while the status
                fetch is still pending so we don't flash a wrong label. */}
            {kycStatus ? (
              <TouchableOpacity
                onPress={() => navigation.navigate("KYCHub")}
                style={[
                  styles.kycBadge,
                  kycStatus === "verified" && styles.kycBadgeVerified,
                  kycStatus === "rejected" && styles.kycBadgeRejected,
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name={
                    kycStatus === "verified"
                      ? "checkmark-circle"
                      : kycStatus === "rejected"
                      ? "alert-circle"
                      : "id-card-outline"
                  }
                  size={11}
                  color={colors.cardBg}
                />
                <Text style={styles.roleBadgeText}>
                  {t(`kyc_badge.${kycStatus}`)}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Open profile Bucket B.4 — slim XnScore row replaces the
                badge + "View details" button. Score Hub is now the
                canonical destination for scoring, so this routes there
                instead of XnScoreDashboard. Removes the duplicate
                entry point (Home's pulse icon also navigates to
                ScoreHub). */}
            <TouchableOpacity
              onPress={() => navigation.navigate("ScoreHub")}
              style={styles.xnScoreSlimRow}
              accessibilityRole="button"
              accessibilityLabel={`${t("profile.xn_score_label")} ${score ?? ""}`}
            >
              <Text style={styles.xnScoreSlimText}>
                {t("profile.xn_score_label")}: {score ?? "—"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.cardBg} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Open profile Bucket B.3 — Complete-your-profile banner.
            Non-dismissible per P0 spec; reappears every visit until all
            required fields are filled. Gated on !profileLoading and on
            a non-null profile so the banner doesn't flash during the
            first 60s cache populate. */}
        {showCompletionBanner ? (
          <TouchableOpacity
            style={styles.completionBanner}
            onPress={() => navigation.navigate("PersonalInfo")}
            accessibilityRole="button"
            accessibilityLabel={t("profile.complete_banner_cta")}
          >
            <View style={styles.completionBannerIcon}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={colors.primaryNavy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.completionBannerTitle}>
                {t("profile.complete_banner_title")}
              </Text>
              <Text style={styles.completionBannerBody}>
                {t("profile.complete_banner_body", {
                  completed: completedCount,
                  total: totalCount,
                })}
              </Text>
            </View>
            <View style={styles.completionBannerCta}>
              <Text style={styles.completionBannerCtaText}>
                {t("profile.complete_banner_cta")}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primaryNavy} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Phase 2 (migration 262) — honor decay warning banner. Shows when
            the elder's honor_score is within 50 points of the demotion
            threshold for their tier, or already below it. Thresholds match
            demote_inactive_elders(): 700 / 600 / 500 for elder_iii / _ii / _i. */}
        {(() => {
          if (!isElder || honorScore == null) return null;
          const threshold =
            role === "elder_iii" ? 700 :
            role === "elder_ii"  ? 600 :
            role === "elder_i"   ? 500 : null;
          if (threshold == null) return null;
          const isBelow = honorScore < threshold;
          const isNear  = !isBelow && honorScore - threshold <= 50;
          if (!isBelow && !isNear) return null;
          return (
            <View style={[
              styles.honorWarningBanner,
              isBelow ? styles.honorWarningBannerBelow : styles.honorWarningBannerNear,
            ]}>
              <Ionicons
                name={isBelow ? "warning" : "alert-circle-outline"}
                size={20}
                color={isBelow ? "#991B1B" : colors.warningLabel}
              />
              <Text style={[
                styles.honorWarningText,
                { color: isBelow ? "#991B1B" : colors.warningLabel },
              ]}>
                {t(isBelow ? "elder.honor_warning_below" : "elder.honor_warning_near", {
                  score: honorScore,
                  role: t(`role.${role}`, { defaultValue: role }),
                  threshold,
                })}
              </Text>
            </View>
          );
        })()}

        {/* Vouches — inline summary + top-3 lists for received/given.
            Data hoisted to the parent so the header trust badge and the
            list share one fetch. Revoke button per given vouch calls
            mig 337's revoke_xnscore_vouch RPC. */}
        <VouchesSection
          received={vouchesReceived}
          given={vouchesGiven}
          loading={vouchesLoading}
          onRevoke={handleRevokeVouch}
        />

        {/* Menu Sections */}
        <View style={styles.content}>
          {menuItems.map((section, sectionIdx) => (
            <View key={sectionIdx} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.section}</Text>
              <View style={styles.menuCard}>
                {section.items.map((item, itemIdx) => (
                  <TouchableOpacity
                    key={itemIdx}
                    style={[
                      styles.menuItem,
                      itemIdx < section.items.length - 1 ? styles.menuItemBorder : null,
                    ]}
                    onPress={item.onPress}
                  >
                    <View style={styles.menuItemLeft}>
                      <View style={styles.menuIconContainer}>
                        <Ionicons name={item.icon as any} size={20} color={colors.primaryNavy} />
                      </View>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.menuItemRight}>
                      {(item as any).value ? (
                        <Text style={styles.menuItemValue}>{(item as any).value}</Text>
                      ) : null}
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
            onPress={handleSignOut}
            disabled={isSigningOut}
            accessibilityRole="button"
            accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
          >
            {isSigningOut ? (
              <>
                <ActivityIndicator size="small" color={colors.errorText} />
                <Text style={styles.signOutText}>
                  {t("profile.sign_out_in_progress")}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.errorText} />
                <Text style={styles.signOutText}>{t("profile.sign_out")}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* App Version */}
          <Text style={styles.versionText}>{t("profile.version")}</Text>
        </View>
          </View>
        }
      />

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.cardBg} />
        <Text style={styles.floatingHelpText}>{t("common.help")}</Text>
      </TouchableOpacity>

      {/* P1 (profile review): avatar picker. Self-renders to null
          when not visible. Updates push back through useProfile()'s
          refetch so the header avatar re-renders with the new URL. */}
      <AvatarPicker
        visible={avatarPickerOpen}
        hasExisting={!!avatarUrl}
        onClose={() => setAvatarPickerOpen(false)}
        onUpdated={async () => {
          await Promise.allSettled([refetchProfile(), refreshViewProfile()]);
        }}
      />

      {/* Send-Money P2 — round-up picker. Tap the Account row to open. */}
      <Modal
        visible={roundUpModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRoundUpModalOpen(false)}
      >
        <Pressable
          style={styles.roundUpBackdrop}
          onPress={() => setRoundUpModalOpen(false)}
        >
          <Pressable style={styles.roundUpSheet} onPress={() => {}}>
            <View style={styles.roundUpHandle} />
            <Text style={styles.roundUpTitle}>
              {t("profile.round_up_title")}
            </Text>
            <Text style={styles.roundUpBody}>
              {t("profile.round_up_body")}
            </Text>
            {[0, 1, 5, 10].map((inc) => {
              const isActive = roundUpIncrement === inc;
              return (
                <TouchableOpacity
                  key={inc}
                  style={[
                    styles.roundUpOption,
                    isActive && styles.roundUpOptionActive,
                  ]}
                  onPress={() => saveRoundUp(inc)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons
                    name={isActive ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={isActive ? colors.accentTeal : colors.textSecondary}
                  />
                  <Text style={styles.roundUpOptionText}>
                    {roundUpLabel(inc)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────
// VouchesSection — dumb display card. Data + onRevoke callback come
// from the parent so the header trust badge and this list share one
// fetch. Renders the Revoke button on each given-vouch row (System A
// revoke — mig 337 revoke_xnscore_vouch — reverses both score
// adjustments).
// ──────────────────────────────────────────────────────────────────────
function VouchesSection({
  received,
  given,
  loading,
  onRevoke,
}: {
  received: Vouch[];
  given: Vouch[];
  loading: boolean;
  onRevoke: (vouchId: string, name: string) => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={vouchStyles.wrapper}>
        <View style={vouchStyles.card}>
          <ActivityIndicator color={colors.accentTeal} />
        </View>
      </View>
    );
  }

  const isEmpty = received.length === 0 && given.length === 0;

  return (
    <View style={vouchStyles.wrapper}>
      <Text style={vouchStyles.sectionLabel}>
        {t("profile.item_vouch", { defaultValue: "Vouches" })}
      </Text>
      <View style={vouchStyles.card}>
        <View style={vouchStyles.countRow}>
          <View style={vouchStyles.countBlock}>
            <Text style={vouchStyles.countNum}>{received.length}</Text>
            <Text style={vouchStyles.countLabel}>Received</Text>
          </View>
          <View style={vouchStyles.countDivider} />
          <View style={vouchStyles.countBlock}>
            <Text style={vouchStyles.countNum}>{given.length}</Text>
            <Text style={vouchStyles.countLabel}>Given</Text>
          </View>
        </View>

        {isEmpty ? (
          <Text style={vouchStyles.emptyText}>
            No active vouches yet. Vouch for someone from the Trust menu.
          </Text>
        ) : (
          <>
            {received.length > 0 && (
              <View style={vouchStyles.list}>
                <Text style={vouchStyles.listHeading}>Received from</Text>
                {received.slice(0, 3).map((v) => (
                  <VouchRow
                    key={v.id}
                    name={v.voucher_name || "Unknown"}
                    avatarUrl={v.voucher_avatar}
                    dateISO={v.created_at}
                  />
                ))}
                {received.length > 3 ? (
                  <Text style={vouchStyles.moreText}>
                    +{received.length - 3} more
                  </Text>
                ) : null}
              </View>
            )}
            {given.length > 0 && (
              <View style={vouchStyles.list}>
                <Text style={vouchStyles.listHeading}>You vouched for</Text>
                {given.slice(0, 3).map((v) => {
                  const name = v.vouchee_name || "Unknown";
                  return (
                    <VouchRow
                      key={v.id}
                      name={name}
                      avatarUrl={v.vouchee_avatar}
                      dateISO={v.created_at}
                      onRevoke={() => onRevoke(v.id, name)}
                    />
                  );
                })}
                {given.length > 3 ? (
                  <Text style={vouchStyles.moreText}>
                    +{given.length - 3} more
                  </Text>
                ) : null}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function VouchRow({
  name,
  avatarUrl,
  dateISO,
  onRevoke,
}: {
  name: string;
  avatarUrl?: string;
  dateISO: string;
  onRevoke?: () => void;
}) {
  return (
    <View style={vouchStyles.row}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={vouchStyles.avatar} />
      ) : (
        <View style={[vouchStyles.avatar, vouchStyles.avatarFallback]}>
          <Text style={vouchStyles.avatarText}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={vouchStyles.rowName}>{name}</Text>
        <Text style={vouchStyles.rowDate}>
          {new Date(dateISO).toLocaleDateString()}
        </Text>
      </View>
      {onRevoke ? (
        <TouchableOpacity
          onPress={onRevoke}
          style={vouchStyles.revokeButton}
          accessibilityRole="button"
          accessibilityLabel={`Revoke vouch for ${name}`}
        >
          <Text style={vouchStyles.revokeButtonText}>Revoke</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const vouchStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  countBlock: {
    flex: 1,
    alignItems: "center",
  },
  countNum: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  countLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  countDivider: {
    width: 1,
    backgroundColor: colors.borderColor,
    marginHorizontal: 12,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  list: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  listHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: "700",
  },
  rowName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  rowDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  moreText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  revokeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.errorText,
  },
  revokeButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.errorText,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  centeredFill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 6,
  },
  unavailableBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.cardBg,
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.cardBg,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.cardBg,
    marginBottom: 4,
  },
  userNameInput: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.cardBg,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.5)",
    minWidth: 180,
    textAlign: "center",
  },
  avatarEditChip: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryNavy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 20,
  },
  // ----- Open profile Bucket B.4 — slim XnScore row -----
  // Replaces the old xnScoreContainer + xnScoreBadge + improveButton
  // cluster with a single tappable row that routes to ScoreHub.
  xnScoreSlimRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
  },
  xnScoreSlimText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  // Phase 2 Bucket A — role badge styles. Self-contained pill so the
  // badge can live inside the navy header without leaking outside.
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,198,174,0.85)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.cardBg,
    letterSpacing: 0.3,
  },
  // KYC badge — same pill shape as roleBadge, neutral navy/grey for
  // the unverified + pending states; teal for verified, red for
  // rejected. Reuses roleBadgeText for the label.
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  kycBadgeVerified: { backgroundColor: "rgba(0,198,174,0.85)" },
  kycBadgeRejected: { backgroundColor: "rgba(220,38,38,0.85)" },
  // Trust badge — shown in the header when the user has at least one
  // active vouch received. Same pill shape as roleBadge/kycBadge for
  // visual consistency; purple tint to differentiate from teal (score)
  // and green (verified KYC).
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.85)",
  },
  // ----- Open profile Bucket B.3 — Complete-your-profile banner -----
  // Lives between the navy LinearGradient header and the white content
  // section. Tap routes to PersonalInfoScreen so the user can fill in
  // whatever's missing. Non-dismissible per P0 spec — disappears
  // automatically once completedCount === totalCount.
  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: -10,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FFF7E6",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  completionBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(10,35,66,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  completionBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginBottom: 2,
  },
  completionBannerBody: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 16,
  },
  completionBannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  completionBannerCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  honorWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  honorWarningBannerNear: {
    backgroundColor: colors.warningBg,
    borderColor: "#FCD34D",
  },
  honorWarningBannerBelow: {
    backgroundColor: colors.errorBg,
    borderColor: "#FCA5A5",
  },
  honorWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  content: {
    padding: 20,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.primaryNavy,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuItemValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accentTeal,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.errorBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.errorText,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.cardBg,
  },
  // Send-Money P2 — round-up picker styles
  roundUpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.55)",
    justifyContent: "flex-end",
  },
  roundUpSheet: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  roundUpHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  roundUpTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginBottom: 4,
  },
  roundUpBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  roundUpOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
  },
  roundUpOptionActive: {
    borderColor: colors.accentTeal,
    backgroundColor: colors.tealTintBg,
  },
  roundUpOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
});
