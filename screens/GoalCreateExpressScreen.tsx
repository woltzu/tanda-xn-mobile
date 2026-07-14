// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalCreateExpressScreen.tsx — one-screen express goal creation.
// ══════════════════════════════════════════════════════════════════════════════
//
// Default entry from the Home screen's "Create Goal" CTA. Replaces the 4-step
// V2 wizard (Category → Type → Create → Success) with a single form whose
// only required fields are name + target amount. Savings type defaults to
// Flexible; everything else (target date, monthly contribution, auto-deposit,
// link-a-circle) is collapsed into an "Advanced" expander with sensible
// pre-fills.
//
// On Create: calls the atomic `create_goal` RPC via useGoalActions.createGoal,
// navigation.replaces straight to GoalDetailV2 with `justCreated: true` so
// the detail screen can render an inline celebration. The old success-screen
// detour is gone.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useGoalActions } from "../hooks/useGoalActions";
import { useCircles } from "../context/CirclesContext";
import { supabase } from "../lib/supabase";

type SavingsType = "flexible" | "emergency" | "locked";

const AMOUNT_SUGGESTIONS = [200, 500, 1000, 5000] as const;

// Tier metadata — copied from the V2 wizard (GoalCreateScreen line 75+) so
// the express screen exposes the same APY/penalty rules the user will see
// throughout the rest of the V2 flow.
const TIERS: Record<SavingsType, {
  emoji: string;
  apy: number;
  minBalance: number;
  withdrawalRule: string;
  penaltyPercent: number;
}> = {
  flexible: {
    emoji: "🔓",
    apy: 0,
    minBalance: 0,
    withdrawalRule: "Withdraw anytime",
    penaltyPercent: 0,
  },
  emergency: {
    emoji: "🛡️",
    apy: 2,
    minBalance: 500,
    withdrawalRule: "Valid emergencies only",
    penaltyPercent: 10,
  },
  locked: {
    emoji: "🔒",
    apy: 4,
    minBalance: 1000,
    withdrawalRule: "At maturity only",
    penaltyPercent: 10,
  },
};

// Default target = 6 months from today. Keeps the math hint sensible until
// the user explicitly picks a date.
function defaultTargetDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Months between today and a target date, rounded down. Used for the
// "$X/month" suggestion.
function monthsBetween(target: Date): number {
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

export default function GoalCreateExpressScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { createGoal, suggestGoalAmount } = useGoalActions();
  const { myCircles } = useCircles();

  // Route params. Previously this file walked navigation.getState()
  // .routes.find(r => r.name === "GoalCreateExpress") to hunt for the
  // params — a fragile pattern that broke after commit b5a15d1
  // registered GoalCreateExpress on BOTH HomeStack and the root
  // Stack. The manual walk could return the wrong entry (a stale
  // HomeStack history from a prior "New Goal" tap), whose params was
  // {}. Result: the template picker's navigate handed off templateId
  // correctly, but the screen kept reading the wrong stack's entry
  // and pre-fill was silently blank. useRoute() is the canonical
  // React-Navigation hook and always returns the params of THIS
  // mount instance regardless of duplicate registrations elsewhere
  // in the tree.
  const route = useRoute();
  const params = (route.params ?? {}) as {
    suggestedName?: string;
    suggestedAmount?: number;
    templateId?: string;
    overrideTargetCents?: number | null;
  };
  const prefillName = params.suggestedName;
  const prefillAmount = params.suggestedAmount;
  const templateId = params.templateId;
  const overrideTargetCents = params.overrideTargetCents;

  // ── Form state ──────────────────────────────────────────────────────────
  // Start with prefill (or empty) — the async template fetch below will
  // fill in name/amount when it resolves. Functional setState guards
  // against clobbering user input if the fetch loses a race against
  // typing.
  const [name, setName] = useState(prefillName ?? "");
  const [amount, setAmount] = useState(
    prefillAmount ? String(prefillAmount) : "",
  );

  // Fetched template row. Shape mirrors the fields the rest of this
  // screen reads (name for the badge, category + provider_categories for
  // the post-create UPDATE, id for the template_usage log).
  const [template, setTemplate] = useState<{
    id: string;
    category: string;
    name: string;
    default_target_cents: number | null;
    provider_categories: string[] | null;
  } | null>(null);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("goal_templates")
        .select("id, category, name, default_target_cents, provider_categories")
        .eq("id", templateId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Log and surface — the previous silent early-return let RLS
        // denies and network hiccups pass through as "blank form" bugs
        // that were impossible to triage from the outside.
        console.warn(
          "[GoalCreateExpress] template fetch failed for",
          templateId,
          ":",
          error.message,
        );
        return;
      }
      if (!data) {
        console.warn(
          "[GoalCreateExpress] no goal_templates row for",
          templateId,
        );
        return;
      }
      const finalTargetCents =
        overrideTargetCents ?? (data.default_target_cents as number | null);
      setTemplate({
        id: data.id as string,
        category: data.category as string,
        name: data.name as string,
        default_target_cents: finalTargetCents,
        provider_categories:
          (data.provider_categories as string[] | null) ?? null,
      });
      // Populate name only if the user hasn't typed anything yet.
      setName((current) => (current === "" ? (data.name as string) : current));
      if (finalTargetCents != null) {
        setAmount((current) =>
          current === "" ? String(Math.round(finalTargetCents / 100)) : current,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, overrideTargetCents]);

  // P2 — median target across past goals. Loaded lazily on first amount
  // focus so we don't spend a round-trip for users who never reach the
  // form. null = "no signal yet" (chip hidden); 0 = "no past goals".
  const [medianTarget, setMedianTarget] = useState<number | null>(null);
  const [medianLoading, setMedianLoading] = useState(false);
  const handleAmountFocus = async () => {
    if (medianTarget !== null || medianLoading) return;
    setMedianLoading(true);
    const { data } = await suggestGoalAmount();
    setMedianTarget(data ?? 0);
    setMedianLoading(false);
  };
  const showMedianChip =
    medianTarget !== null && medianTarget > 0 && (parseFloat(amount) || 0) === 0;

  // P2 — title category suggestion. Map common keywords (case-insensitive)
  // to a category label; show a chip when there's a clear match.
  const titleCategory = useMemo<string | null>(() => {
    const haystack = name.toLowerCase();
    if (haystack.length < 3) return null;
    const matches: { kw: string[]; cat: string }[] = [
      { kw: ["bali", "trip", "travel", "vacation", "flight"], cat: "Travel" },
      { kw: ["home", "house", "apartment", "down payment", "mortgage"], cat: "Home" },
      { kw: ["wedding", "engagement", "honeymoon"], cat: "Wedding" },
      { kw: ["emergency", "rainy day", "safety"], cat: "Emergency" },
      { kw: ["phone", "laptop", "macbook", "gadget", "tv"], cat: "Electronics" },
      { kw: ["school", "tuition", "college", "course", "degree"], cat: "Education" },
      { kw: ["car", "bike", "vehicle"], cat: "Transport" },
      { kw: ["business", "startup", "shop", "store"], cat: "Business" },
    ];
    for (const { kw, cat } of matches) {
      if (kw.some((k) => haystack.includes(k))) return cat;
    }
    return null;
  }, [name]);
  const [savingsType, setSavingsType] = useState<SavingsType>("flexible");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [targetDate, setTargetDate] = useState<Date>(defaultTargetDate());
  const [targetDateTouched, setTargetDateTouched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [autoDepositEnabled, setAutoDepositEnabled] = useState(false);
  const [autoDepositDay, setAutoDepositDay] = useState<number>(1);

  const [linkedCircleId, setLinkedCircleId] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Phase 2B (templates) — post-create intermediate state. When the
  // create came from a template AND providers exist for that category +
  // user country, show a banner before the auto-navigate so the user
  // can jump into the provider list with chips pre-filtered.
  const [postCreate, setPostCreate] = useState<{
    goalId: string;
    providerCount: number;
    initialCategory: string | null;
    initialCountry: string | null;
  } | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const numericAmount = parseFloat(amount) || 0;
  const monthsToTarget = monthsBetween(targetDate);
  const suggestedMonthly =
    numericAmount > 0 ? Math.ceil(numericAmount / monthsToTarget) : 0;

  const isValid = name.trim().length >= 2 && numericAmount > 0;

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAmountChange = (txt: string) => {
    setAmount(txt.replace(/[^0-9.]/g, ""));
  };

  const handleSelectTier = (t: SavingsType) => {
    setSavingsType(t);
  };

  const handleCreate = async () => {
    if (!isValid || isCreating) return;
    setErrorMsg(null);
    setIsCreating(true);
    try {
      const { data: goal, error } = await createGoal({
        name: name.trim(),
        targetAmount: numericAmount,
        savingsType,
        targetDate: targetDateTouched ? toIsoDate(targetDate) : null,
        monthlyContribution: suggestedMonthly > 0 ? suggestedMonthly : undefined,
        autoDepositEnabled,
        autoDepositDay: autoDepositEnabled ? autoDepositDay : null,
        linkedCircleId: linkedCircleId ?? null,
      } as any);

      if (error || !goal) {
        const msg = (error as any)?.message ?? "create_failed";
        setErrorMsg(msg);
        return;
      }

      // Phase 4 — stamp the goal's category + suggested provider
      // category from the template. createGoal doesn't take these yet,
      // so do it as a follow-up UPDATE. Best-effort: failure here is
      // logged, not user-facing — the goal was created successfully.
      if (template) {
        try {
          await supabase
            .from("user_savings_goals")
            .update({
              category: template.category,
              provider_category:
                template.provider_categories?.[0] ?? null,
            })
            .eq("id", (goal as any).id);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[GoalCreateExpress] template stamp failed:", e);
        }

        // Phase 2B — log template usage + check for matching providers.
        // Both are best-effort: usage failure is silent (analytics-only),
        // provider-count failure falls through to the normal navigate.
        try {
          await supabase.from("template_usage").insert({
            template_id: (template as any).id,
            user_id: (goal as any).user_id ?? undefined,
            goal_id: (goal as any).id,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[GoalCreateExpress] template_usage insert failed:", e);
        }

        try {
          // Pull user country once so the provider query and the
          // route param can use the same value.
          let userCountry: string | null = null;
          if ((goal as any).user_id) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("country")
              .eq("id", (goal as any).user_id)
              .maybeSingle();
            const c = (prof?.country as string | null) ?? null;
            userCountry = c ? c.toUpperCase().slice(0, 2) : null;
          }
          const cats = (template as any).provider_categories as string[] | null;
          if (cats && cats.length > 0) {
            let countQuery = supabase
              .from("providers")
              .select("id", { count: "exact", head: true })
              .eq("verification_status", "verified")
              .eq("is_active", true)
              .in("category", cats);
            if (userCountry) countQuery = countQuery.eq("country", userCountry);
            const { count } = await countQuery;
            if (count && count > 0) {
              setPostCreate({
                goalId: (goal as any).id,
                providerCount: count,
                initialCategory: cats[0],
                initialCountry: userCountry,
              });
              return;
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[GoalCreateExpress] provider count failed:", e);
        }
      }

      // Replace so the user's back button goes to the Goals hub, not the
      // empty express form. Carries `justCreated` so the detail screen can
      // render the inline celebration banner.
      const nav = navigation as unknown as {
        replace?: (n: string, p?: Record<string, unknown>) => void;
      };
      const params = { goalId: goal.id, justCreated: true } as const;
      if (typeof nav.replace === "function") {
        nav.replace(Routes.GoalDetailV2, params);
      } else {
        navigation.navigate(Routes.GoalDetailV2, params);
      }
    } catch (e: any) {
      console.error("[GoalCreateExpress] create failed:", e?.message ?? e);
      Alert.alert(
        t("create_goal_express.alert_error_title"),
        t("create_goal_express.alert_error_body"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const continueToGoal = () => {
    if (!postCreate) return;
    const nav = navigation as unknown as {
      replace?: (n: string, p?: Record<string, unknown>) => void;
    };
    const params = { goalId: postCreate.goalId, justCreated: true } as const;
    if (typeof nav.replace === "function") {
      nav.replace(Routes.GoalDetailV2, params);
    } else {
      navigation.navigate(Routes.GoalDetailV2, params);
    }
  };

  const browseProviders = () => {
    if (!postCreate) return;
    navigation.navigate(Routes.ProviderList as any, {
      goalId: postCreate.goalId,
      initialCategory: postCreate.initialCategory,
      initialCountry: postCreate.initialCountry,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (postCreate) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ width: 38 }} />
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {t("create_goal_express.header_title")}
              </Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.postCreateWrap}>
          <Text style={styles.postCreateEmoji}>🎉</Text>
          <Text style={styles.postCreateTitle}>
            {t("create_goal_express.post_create_title")}
          </Text>
          <Text style={styles.postCreateBody}>
            {t("create_goal_express.post_create_body")}
          </Text>

          <View style={styles.providerBanner}>
            <View style={styles.providerBannerIcon}>
              <Ionicons name="storefront-outline" size={20} color="#5B21B6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerBannerTitle}>
                {t("create_goal_express.provider_suggestion", {
                  count: postCreate.providerCount,
                })}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, { marginTop: 18 }]}
            onPress={browseProviders}
          >
            <Text style={styles.createBtnText}>
              {t("create_goal_express.browse_providers")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={continueToGoal}
          >
            <Text style={styles.continueBtnText}>
              {t("create_goal_express.continue_to_goal")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {t("create_goal_express.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("create_goal_express.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Phase 4 — template badge. Renders only when the user
              arrived from the goal-template browser; non-blocking
              indicator that the form is pre-filled and editable. */}
          {template ? (
            <View style={styles.templateBadge}>
              <Text style={styles.templateBadgeIcon}>📋</Text>
              <Text style={styles.templateBadgeText} numberOfLines={1}>
                {t("create_goal_express.template_badge", { name: template.name })}
              </Text>
            </View>
          ) : null}

          {/* ── Name ───────────────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_goal_express.label_name")}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("create_goal_express.placeholder_name")}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              maxLength={60}
            />
            {/* P2 — title category chip. Shows when a keyword matches
                so the user can see "we read this as Travel" without
                having to think about category taxonomy. Tapping nudges
                the title with the canonical category label. */}
            {titleCategory ? (
              <TouchableOpacity
                style={styles.p2Chip}
                onPress={() =>
                  setName(
                    t("create_goal_express.title_suggested_format", {
                      category: titleCategory,
                    }),
                  )
                }
                accessibilityRole="button"
              >
                <Ionicons name="sparkles-outline" size={12} color="#0A2342" />
                <Text style={styles.p2ChipText}>
                  {t("create_goal_express.title_suggest_chip", {
                    category: titleCategory,
                  })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Target amount ─────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_goal_express.label_amount")}
              <Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                onFocus={handleAmountFocus}
                placeholder="1000"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text style={styles.currencySuffix}>USD</Text>
            </View>
            {/* P2 — median target chip. Only shows when the user has past
                goals AND hasn't typed an amount yet. Tapping fills the
                field with the median value. */}
            {showMedianChip ? (
              <TouchableOpacity
                style={styles.p2Chip}
                onPress={() => setAmount(String(Math.round(medianTarget!)))}
                accessibilityRole="button"
              >
                <Ionicons name="trending-up-outline" size={12} color="#0A2342" />
                <Text style={styles.p2ChipText}>
                  {t("create_goal_express.median_chip", {
                    amount: `$${Math.round(medianTarget!).toLocaleString()}`,
                  })}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.amountSuggestRow}>
              {AMOUNT_SUGGESTIONS.map((s) => {
                const selected = numericAmount === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.amountSuggestChip,
                      selected && styles.amountSuggestChipSelected,
                    ]}
                    onPress={() => setAmount(String(s))}
                  >
                    <Text
                      style={[
                        styles.amountSuggestChipText,
                        selected && styles.amountSuggestChipTextSelected,
                      ]}
                    >
                      ${s.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {numericAmount > 0 && monthsToTarget > 0 ? (
              <Text style={styles.helpText}>
                {t("create_goal_express.monthly_hint", {
                  amount: suggestedMonthly,
                  date: formatDateLabel(targetDate),
                })}
              </Text>
            ) : null}
          </View>

          {/* ── Savings type expander ──────────────────────────────────── */}
          <TouchableOpacity
            style={styles.typeExpanderHead}
            onPress={() => setShowTypePicker((s) => !s)}
            accessibilityRole="button"
          >
            <View style={styles.typeExpanderHeadLeft}>
              <Text style={styles.typeExpanderEmoji}>
                {TIERS[savingsType].emoji}
              </Text>
              <View>
                <Text style={styles.typeExpanderTitle}>
                  {t(`create_goal_express.tier_${savingsType}_name`)}
                </Text>
                <Text style={styles.typeExpanderSub}>
                  {t("create_goal_express.tier_apy_hint", {
                    apy: TIERS[savingsType].apy,
                  })}
                </Text>
              </View>
            </View>
            <Ionicons
              name={showTypePicker ? "chevron-up" : "chevron-down"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>
          {showTypePicker ? (
            <View style={styles.tierGrid}>
              {(["flexible", "emergency", "locked"] as SavingsType[]).map((t1) => {
                const tier = TIERS[t1];
                const selected = savingsType === t1;
                return (
                  <TouchableOpacity
                    key={t1}
                    style={[styles.tierCard, selected && styles.tierCardSelected]}
                    onPress={() => handleSelectTier(t1)}
                  >
                    <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                    <Text style={styles.tierName}>
                      {t(`create_goal_express.tier_${t1}_name`)}
                    </Text>
                    <Text style={styles.tierApy}>
                      {tier.apy === 0
                        ? t("create_goal_express.tier_no_apy")
                        : t("create_goal_express.tier_apy", { apy: tier.apy })}
                    </Text>
                    <Text style={styles.tierRule}>{tier.withdrawalRule}</Text>
                    {tier.minBalance > 0 ? (
                      <Text style={styles.tierMeta}>
                        {t("create_goal_express.tier_min", {
                          min: tier.minBalance,
                        })}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* ── Advanced settings expander ────────────────────────────── */}
          <TouchableOpacity
            style={styles.advancedHeader}
            onPress={() => setShowAdvanced((s) => !s)}
          >
            <Text style={styles.advancedTitle}>
              {t("create_goal_express.advanced_title")}
            </Text>
            <Ionicons
              name={showAdvanced ? "chevron-up" : "chevron-down"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showAdvanced ? (
            <View style={styles.advancedBody}>
              {/* Target date */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_goal_express.label_target_date")}
                </Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#0A2342" />
                  <Text style={styles.dateBtnText}>
                    {formatDateLabel(targetDate)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {showDatePicker ? (
                  <DateTimePicker
                    value={targetDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={(() => {
                      const m = new Date();
                      m.setDate(m.getDate() + 1);
                      return m;
                    })()}
                    onChange={(_e, selected) => {
                      setShowDatePicker(Platform.OS === "ios");
                      if (selected) {
                        setTargetDate(selected);
                        setTargetDateTouched(true);
                      }
                    }}
                  />
                ) : null}
              </View>

              {/* Auto-deposit toggle */}
              <View style={styles.field}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setAutoDepositEnabled((v) => !v)}
                >
                  <View style={styles.toggleLeft}>
                    <Text style={styles.toggleTitle}>
                      {t("create_goal_express.label_auto_deposit")}
                    </Text>
                    <Text style={styles.toggleSub}>
                      {t("create_goal_express.help_auto_deposit")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.toggleTrack,
                      autoDepositEnabled && styles.toggleTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        autoDepositEnabled && styles.toggleThumbOn,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
                {autoDepositEnabled ? (
                  <View style={styles.dayPickerRow}>
                    {[1, 5, 15, 28].map((d) => {
                      const selected = autoDepositDay === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.dayChip,
                            selected && styles.dayChipSelected,
                          ]}
                          onPress={() => setAutoDepositDay(d)}
                        >
                          <Text
                            style={[
                              styles.dayChipText,
                              selected && styles.dayChipTextSelected,
                            ]}
                          >
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              {/* Link a circle — only when the user has at least one */}
              {myCircles.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.label}>
                    {t("create_goal_express.label_link_circle")}
                  </Text>
                  <View style={styles.circleChipRow}>
                    <TouchableOpacity
                      style={[
                        styles.circleChip,
                        linkedCircleId === null && styles.circleChipSelected,
                      ]}
                      onPress={() => setLinkedCircleId(null)}
                    >
                      <Text
                        style={[
                          styles.circleChipText,
                          linkedCircleId === null && styles.circleChipTextSelected,
                        ]}
                      >
                        {t("create_goal_express.no_circle")}
                      </Text>
                    </TouchableOpacity>
                    {myCircles.slice(0, 6).map((c) => {
                      const selected = linkedCircleId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.circleChip,
                            selected && styles.circleChipSelected,
                          ]}
                          onPress={() =>
                            setLinkedCircleId(selected ? null : c.id)
                          }
                        >
                          <Text style={styles.circleChipEmoji}>
                            {c.emoji || "🔄"}
                          </Text>
                          <Text
                            style={[
                              styles.circleChipText,
                              selected && styles.circleChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.createBtn,
              (!isValid || isCreating) && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={!isValid || isCreating}
            accessibilityRole="button"
          >
            {isCreating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.createBtnText}>
                {t("create_goal_express.btn_create")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  flex1: { flex: 1 },

  header: {
    paddingTop: Platform.OS === "android" ? 16 : 0,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  scrollContent: { padding: 20, paddingBottom: 160 },

  field: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  required: { color: "#DC2626" },
  helpText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 8,
    fontStyle: "italic",
  },
  // P2 — soft teal suggestion chip used for both title and amount hints.
  p2Chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  p2ChipText: { fontSize: 11, fontWeight: "700", color: "#0A2342" },

  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    paddingVertical: 12,
  },
  currencySuffix: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
    fontWeight: "600",
  },
  amountSuggestRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  amountSuggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amountSuggestChipSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  amountSuggestChipText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  amountSuggestChipTextSelected: { color: "#00897B" },

  typeExpanderHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  typeExpanderHeadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  typeExpanderEmoji: { fontSize: 24 },
  typeExpanderTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  typeExpanderSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  tierGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tierCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  tierCardSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
    borderWidth: 2,
  },
  tierEmoji: { fontSize: 22, marginBottom: 4 },
  tierName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2342",
    textAlign: "center",
  },
  tierApy: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00897B",
    marginTop: 2,
  },
  tierRule: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },
  tierMeta: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
    fontStyle: "italic",
  },

  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  advancedTitle: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  advancedBody: { marginBottom: 12 },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateBtnText: {
    flex: 1,
    fontSize: 14,
    color: "#0A2342",
    fontWeight: "500",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  toggleLeft: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  toggleSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    padding: 2,
  },
  toggleTrackOn: { backgroundColor: "#00C6AE" },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbOn: { alignSelf: "flex-end" },

  dayPickerRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  dayChipSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
    borderWidth: 2,
  },
  dayChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  dayChipTextSelected: { color: "#00897B" },

  circleChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  circleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxWidth: "100%",
  },
  circleChipSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
    borderWidth: 2,
  },
  circleChipEmoji: { fontSize: 14 },
  circleChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
    maxWidth: 110,
  },
  circleChipTextSelected: { color: "#00897B" },

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  errorText: { fontSize: 12, color: "#DC2626", flex: 1 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  createBtn: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnDisabled: { backgroundColor: "#E5E7EB" },
  createBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  templateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  templateBadgeIcon: { fontSize: 14 },
  templateBadgeText: { fontSize: 12, fontWeight: "700", color: "#5B21B6" },

  postCreateWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  postCreateEmoji: { fontSize: 56 },
  postCreateTitle: { fontSize: 22, fontWeight: "800", color: "#0A2342", marginTop: 16, textAlign: "center" },
  postCreateBody: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 8, lineHeight: 20 },
  providerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 14,
    padding: 14,
    alignSelf: "stretch",
  },
  providerBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  providerBannerTitle: { fontSize: 14, fontWeight: "800", color: "#5B21B6" },
  continueBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  continueBtnText: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
});
