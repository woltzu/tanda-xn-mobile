// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateCircleExpressScreen.tsx — one-screen "express" create flow.
// ══════════════════════════════════════════════════════════════════════════════
//
// Default create entry from the Circles tab. Collapses the 5-step wizard
// (Start → Details → Schedule → Invite → Success) into a single form with
// sensible defaults derived from the user's most recent circle (when one
// exists). The full wizard is still reachable via the "Advanced setup"
// link on CirclesV2Screen for users who need every option (beneficiary,
// recurring, Elder community, etc.).
//
// Required-only path (the common case):
//   name → amount → member count chip → Create
// Everything else (frequency, start date, rotation, grace period) has a
// smart default and is tucked behind the "Advanced ▾" expander.
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
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useCircles } from "../context/CirclesContext";
import MemberInviteSheet, {
  InvitedContact,
} from "../components/MemberInviteSheet";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
type Rotation = "xnscore" | "random" | "manual";

const QUICK_MEMBER_COUNTS = [5, 6, 8, 10, 12] as const;
const AMOUNT_SUGGESTIONS = [50, 100, 200, 500] as const;

// AsyncStorage key for the one-shot "first-create explainer" modal.
const FIRST_SEEN_KEY = "@tandaxn_express_first_seen";

// Suggest a follow-up name like "{previous} 2" or increment a trailing
// number. Returns empty string when there's no prior circle to base on.
function suggestNextName(prevName: string): string {
  const base = prevName.trim();
  if (!base) return "";
  const m = base.match(/^(.+?)\s+(\d+)$/);
  if (m) return `${m[1]} ${parseInt(m[2], 10) + 1}`;
  return `${base} 2`;
}

// Pre-fill the start date with the next sensible boundary for the chosen
// frequency:
//   - daily             → tomorrow
//   - weekly / biweekly → next Monday
//   - monthly           → 1st of next month
function nextStartDateFor(freq: Frequency): Date {
  const now = new Date();
  if (freq === "daily") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (freq === "weekly" || freq === "biweekly") {
    const d = new Date(now);
    const dow = d.getDay(); // 0 = Sun
    const days = ((8 - dow) % 7) || 7;
    d.setDate(d.getDate() + days);
    return d;
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function CreateCircleExpressScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { myCircles, createCircle, networkUserIds } = useCircles();

  // ── Smart defaults from the user's most recent circle ────────────────────
  // If they've created/joined before, copy amount + frequency + memberCount
  // from the latest one. Otherwise fall back to the catalogued defaults
  // (USD 100, monthly, 6 members).
  const lastCircle = useMemo(() => {
    if (myCircles.length === 0) return null;
    return [...myCircles].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }, [myCircles]);

  const seedAmount = lastCircle?.amount ?? 100;
  const seedFrequency: Frequency =
    lastCircle?.frequency === "daily" ||
    lastCircle?.frequency === "weekly" ||
    lastCircle?.frequency === "biweekly"
      ? (lastCircle.frequency as Frequency)
      : "monthly";
  const seedMemberCount = lastCircle?.memberCount ?? 6;
  // Seed the Advanced section too — payout order and grace period inherit
  // from the user's most recent circle so a "same setup as last time" tap
  // really is one tap.
  const seedRotation: Rotation =
    lastCircle?.rotationMethod === "random" ||
    lastCircle?.rotationMethod === "manual"
      ? (lastCircle.rotationMethod as Rotation)
      : "xnscore";
  const seedGrace =
    typeof lastCircle?.gracePeriodDays === "number"
      ? lastCircle.gracePeriodDays
      : 2;

  // Suggested name based on the previous circle's name. Shown as the
  // placeholder so the user can tap to accept or type their own.
  const nameSuggestion = useMemo(
    () => (lastCircle ? suggestNextName(lastCircle.name) : ""),
    [lastCircle],
  );

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(String(seedAmount));
  const [memberCount, setMemberCount] = useState(seedMemberCount);
  const [showCustomCount, setShowCustomCount] = useState(
    !QUICK_MEMBER_COUNTS.includes(seedMemberCount as any),
  );
  const [customCountText, setCustomCountText] = useState(
    showCustomCount ? String(seedMemberCount) : "",
  );

  const [invitedContacts, setInvitedContacts] = useState<InvitedContact[]>([]);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(seedFrequency);
  const [startDate, setStartDate] = useState<Date>(nextStartDateFor(seedFrequency));
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rotationMethod, setRotationMethod] = useState<Rotation>(seedRotation);
  const [gracePeriodDays, setGracePeriodDays] = useState(seedGrace);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-shot first-create explainer. Reads/writes the AsyncStorage flag so
  // the modal only ever shows on the very first visit to this screen.
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(FIRST_SEEN_KEY)
      .then((v) => {
        if (!v) setShowFirstTimeModal(true);
      })
      .catch(() => {
        // If AsyncStorage is unavailable, just skip the modal rather than
        // nag every launch. Worst case the user misses one onboarding hint.
      });
  }, []);
  const dismissFirstTimeModal = () => {
    setShowFirstTimeModal(false);
    AsyncStorage.setItem(FIRST_SEEN_KEY, "1").catch(() => undefined);
  };

  // Warn (inline) if the user is about to reuse one of their existing
  // circle names — most likely a typo or a second instance they meant to
  // distinguish. Not a hard block; the create button still works.
  const nameAlreadyUsed = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length < 2) return false;
    return myCircles.some((c) => c.name.toLowerCase() === trimmed);
  }, [name, myCircles]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSelectMemberChip = (n: number) => {
    setMemberCount(n);
    setShowCustomCount(false);
    setCustomCountText("");
  };

  const handlePickCustomCount = () => {
    setShowCustomCount(true);
    if (!customCountText) setCustomCountText(String(memberCount));
  };

  const handleCustomCountChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, "");
    setCustomCountText(cleaned);
    const n = parseInt(cleaned, 10);
    if (!isNaN(n) && n >= 2) setMemberCount(n);
  };

  const handleFrequencyChange = (f: Frequency) => {
    setFrequency(f);
    // Auto-recompute the start date for the new cadence UNLESS the user
    // has explicitly picked one — we don't want to wipe their choice.
    if (!startDateTouched) setStartDate(nextStartDateFor(f));
  };

  const handleAmountChange = (txt: string) => {
    setAmount(txt.replace(/[^0-9.]/g, ""));
  };

  const handleRemoveInvitee = (id: string) => {
    setInvitedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleOpenAdvancedWizard = () => {
    // The full wizard preserves its own draft system; jumping to it from
    // express does not carry state across (different shapes). The user
    // would start over there — that's the intended trade-off for the
    // power options the wizard exposes.
    navigation.navigate(Routes.CreateCircleStart);
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const numericAmount = parseFloat(amount) || 0;
  const isValid =
    name.trim().length >= 2 &&
    numericAmount > 0 &&
    memberCount >= 2 &&
    memberCount <= 100;

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!isValid || isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      const newCircle = await createCircle({
        name: name.trim(),
        type: "traditional",
        amount: numericAmount,
        frequency,
        memberCount,
        startDate: toIsoDate(startDate),
        rotationMethod,
        gracePeriodDays,
        invitedMembers: invitedContacts.map((c, idx) => ({
          id: idx + 1,
          name: c.name,
          phone: c.phone,
        })),
        createdBy: "", // overwritten server-side by auth.uid()
        emoji: "🔄",
      });

      // Prefer `replace` so the user's back button goes to the Circles
      // tab, not the empty form. Falls back to `navigate` if the active
      // navigator doesn't expose replace (defensive — stack does).
      const nav = navigation as unknown as {
        replace?: (name: string, params?: Record<string, unknown>) => void;
      };
      if (typeof nav.replace === "function") {
        nav.replace(Routes.CircleDetail, { circleId: newCircle.id });
      } else {
        navigation.navigate(Routes.CircleDetail, { circleId: newCircle.id });
      }
    } catch (e: any) {
      console.error("[CreateCircleExpress] create failed:", e?.message ?? e);
      setError(e?.message ?? "create_failed");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        <LinearGradient
          colors={["#0A2342", "#143654"]}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", { defaultValue: "Back" })}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {t("create_circle_express.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("create_circle_express.header_subtitle")}
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
          {/* ── Name ───────────────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_name")}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={[styles.input, nameAlreadyUsed && styles.inputWarn]}
              value={name}
              onChangeText={setName}
              placeholder={
                nameSuggestion ||
                t("create_circle_express.placeholder_name")
              }
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              maxLength={60}
            />
            {nameAlreadyUsed ? (
              <Text style={styles.warnText}>
                {t("create_circle_express.warn_name_taken")}
              </Text>
            ) : nameSuggestion && name.length === 0 ? (
              <TouchableOpacity
                onPress={() => setName(nameSuggestion)}
                accessibilityRole="button"
                style={styles.nameSuggestRow}
              >
                <Text style={styles.nameSuggestText}>
                  {t("create_circle_express.name_suggestion_prompt", {
                    suggestion: nameSuggestion,
                  })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Amount ─────────────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_amount")}
              <Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="100"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text style={styles.currencySuffix}>USD</Text>
            </View>
            <Text style={styles.helpText}>
              {t("create_circle_express.help_amount")}
            </Text>
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
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.amountSuggestChipText,
                        selected && styles.amountSuggestChipTextSelected,
                      ]}
                    >
                      ${s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Member count ───────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_member_count")}
            </Text>
            <View style={styles.chipRow}>
              {QUICK_MEMBER_COUNTS.map((n) => {
                const isSel = !showCustomCount && memberCount === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, isSel && styles.chipSelected]}
                    onPress={() => handleSelectMemberChip(n)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSel && styles.chipTextSelected,
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.chip,
                  showCustomCount && styles.chipSelected,
                ]}
                onPress={handlePickCustomCount}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.chipText,
                    showCustomCount && styles.chipTextSelected,
                  ]}
                >
                  {t("create_circle_express.member_count_custom")}
                </Text>
              </TouchableOpacity>
            </View>
            {showCustomCount ? (
              <TextInput
                style={[styles.input, styles.customCountInput]}
                value={customCountText}
                onChangeText={handleCustomCountChange}
                placeholder={t(
                  "create_circle_express.member_count_custom_placeholder",
                )}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={3}
              />
            ) : null}
            {memberCount >= 2 && numericAmount > 0 ? (
              <Text style={styles.helpText}>
                {t("create_circle_express.member_math_hint", {
                  count: memberCount,
                  amount: numericAmount.toFixed(0),
                  pot: (numericAmount * memberCount).toFixed(0),
                })}
              </Text>
            ) : null}
          </View>

          {/* ── Add members ────────────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_members")}
            </Text>
            <TouchableOpacity
              style={styles.addMembersBtn}
              onPress={() => setShowInviteSheet(true)}
              accessibilityRole="button"
            >
              <Ionicons name="people" size={18} color="#00C6AE" />
              <Text style={styles.addMembersText}>
                {invitedContacts.length > 0
                  ? t("create_circle_express.add_more_members")
                  : t("create_circle_express.add_members")}
              </Text>
            </TouchableOpacity>
            {invitedContacts.length > 0 ? (
              <View style={styles.inviteeChipRow}>
                {invitedContacts.map((c) => (
                  <View key={c.id} style={styles.inviteeChip}>
                    {c.isOnTandaXn ? (
                      <View style={styles.inviteeChipDot} />
                    ) : null}
                    <Text style={styles.inviteeChipText} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveInvitee(c.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "create_circle_express.remove_invitee",
                        { name: c.name },
                      )}
                    >
                      <Ionicons name="close" size={14} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* ── Advanced settings (collapsible) ────────────────────────── */}
          <TouchableOpacity
            style={styles.advancedHeader}
            onPress={() => setShowAdvanced((s) => !s)}
            accessibilityRole="button"
          >
            <Text style={styles.advancedTitle}>
              {t("create_circle_express.advanced_title")}
            </Text>
            <Ionicons
              name={showAdvanced ? "chevron-up" : "chevron-down"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showAdvanced ? (
            <View style={styles.advancedBody}>
              {/* Frequency */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_express.label_frequency")}
                </Text>
                <View style={styles.chipRow}>
                  {(["daily", "weekly", "biweekly", "monthly"] as Frequency[]).map((f) => {
                    const isSel = frequency === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.chip, isSel && styles.chipSelected]}
                        onPress={() => handleFrequencyChange(f)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSel && styles.chipTextSelected,
                          ]}
                        >
                          {t(`create_circle_express.freq_${f}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Start date */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_express.label_start_date")}
                </Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#0A2342" />
                  <Text style={styles.dateBtnText}>
                    {formatDateLabel(startDate)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {showDatePicker ? (
                  <DateTimePicker
                    value={startDate}
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
                        setStartDate(selected);
                        setStartDateTouched(true);
                      }
                    }}
                  />
                ) : null}
              </View>

              {/* Rotation method */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_express.label_rotation")}
                </Text>
                <View style={styles.chipRow}>
                  {(["xnscore", "random", "manual"] as Rotation[]).map((r) => {
                    const isSel = rotationMethod === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.chip, isSel && styles.chipSelected]}
                        onPress={() => setRotationMethod(r)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSel && styles.chipTextSelected,
                          ]}
                        >
                          {t(`create_circle_express.rotation_${r}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Grace period */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_express.label_grace")}
                </Text>
                <View style={styles.chipRow}>
                  {[0, 1, 2, 3].map((g) => {
                    const isSel = gracePeriodDays === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[styles.chip, isSel && styles.chipSelected]}
                        onPress={() => setGracePeriodDays(g)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSel && styles.chipTextSelected,
                          ]}
                        >
                          {g === 0
                            ? t("create_circle_express.grace_none")
                            : t("create_circle_express.grace_days", { count: g })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>
                {t("create_circle_express.error_create_failed")}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Sticky Create button ─────────────────────────────────────── */}
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
                {t("create_circle_express.btn_create")}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.wizardLink}
            onPress={handleOpenAdvancedWizard}
            accessibilityRole="link"
          >
            <Text style={styles.wizardLinkText}>
              {t("create_circle_express.advanced_wizard_link")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Members bottom-sheet ───────────────────────────────────────── */}
      <MemberInviteSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        initialSelected={invitedContacts}
        networkUserIds={networkUserIds}
        onDone={(picks) => {
          setInvitedContacts(picks);
          setShowInviteSheet(false);
        }}
      />

      {/* ── First-create explainer (one-shot, AsyncStorage-gated) ─────── */}
      <Modal
        visible={showFirstTimeModal}
        transparent
        animationType="fade"
        onRequestClose={dismissFirstTimeModal}
      >
        <Pressable
          style={styles.firstTimeBackdrop}
          onPress={dismissFirstTimeModal}
        >
          <Pressable style={styles.firstTimeCard} onPress={() => {}}>
            <View style={styles.firstTimeIcon}>
              <Ionicons name="people" size={28} color="#00C6AE" />
            </View>
            <Text style={styles.firstTimeTitle}>
              {t("create_circle_express.intro_title")}
            </Text>
            <Text style={styles.firstTimeBody}>
              {t("create_circle_express.intro_body")}
            </Text>
            <Text style={styles.firstTimeBody}>
              {t("create_circle_express.intro_steps")}
            </Text>
            <TouchableOpacity
              style={styles.firstTimeBtn}
              onPress={dismissFirstTimeModal}
              accessibilityRole="button"
            >
              <Text style={styles.firstTimeBtnText}>
                {t("create_circle_express.intro_btn")}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginTop: 6,
    fontStyle: "italic",
  },

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
  customCountInput: { marginTop: 10 },
  inputWarn: { borderColor: "#F59E0B", borderWidth: 2 },
  warnText: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 6,
  },
  nameSuggestRow: { paddingVertical: 6, marginTop: 4 },
  nameSuggestText: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "600",
  },
  amountSuggestRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
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

  // First-create explainer modal
  firstTimeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  firstTimeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    maxWidth: 360,
    gap: 12,
  },
  firstTimeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  firstTimeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    textAlign: "center",
  },
  firstTimeBody: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  firstTimeBtn: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 4,
    alignSelf: "stretch",
    alignItems: "center",
  },
  firstTimeBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
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

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
    borderWidth: 2,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  chipTextSelected: { color: "#00897B" },

  addMembersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
    borderStyle: "dashed",
  },
  addMembersText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  inviteeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  inviteeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxWidth: "100%",
  },
  inviteeChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00C6AE",
  },
  inviteeChipText: {
    fontSize: 12,
    color: "#0A2342",
    fontWeight: "500",
    maxWidth: 140,
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
    marginBottom: 14,
  },
  advancedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
  },
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

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    marginTop: 6,
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
  createBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  wizardLink: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  wizardLinkText: {
    color: "#00C6AE",
    fontSize: 12,
    fontWeight: "600",
  },
});
