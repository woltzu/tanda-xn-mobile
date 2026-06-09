// =============================================================================
// QuickCircleScreen -- one-page simplified circle creation flow.
//
// Background: the 5-screen wizard (Start -> Details -> Schedule -> Invite
// -> Success) handles every edge case but is too much for a first-time
// user who just wants a $100/month/10-member circle with sensible
// defaults. This screen is the additive shortcut: amount chips, member
// stepper, frequency segmented control, start-date stepper, one Create
// button. Everything else is defaulted.
//
// Implementation note: rather than re-implement persistence + share UI,
// this screen navigates to the existing CreateCircleSuccess screen with
// the full route-params shape that screen already accepts. The Success
// screen handles createCircle() + the invite/share UI. That keeps the
// "one source of truth for circle persistence" property and means future
// changes to the persistence layer (like the reputation premium wiring
// from feat(circle-reputation) Step 4) light up here for free.
//
// Defaults (chosen to match the prompt's "Quick Circle" template):
//   type            "traditional" (CIRCLE_TYPES key — same default the
//                                  wizard uses for community circles)
//   amount          $100        (chips: $50 / $100 / $200 / $500)
//   members         10          (stepper 2-20)
//   frequency       monthly     (segmented: weekly / biweekly / monthly)
//   startDate       today + 7d  (stepper: today / +3d / +7d / +14d)
//   rotationMethod  "xnscore"   (prompt explicitly removes the choice)
//   gracePeriodDays 2           (prompt explicitly removes the choice)
//   name            user-supplied, defaults to "My Quick Circle"
//   description     ""          (optional, hidden behind a "Show more" toggle to keep the surface lean)
// =============================================================================

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

type Frequency = "weekly" | "biweekly" | "monthly";

const AMOUNT_CHIPS = [50, 100, 200, 500] as const;
const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;
const FREQ_OPTIONS: { id: Frequency; label: string }[] = [
  { id: "weekly",   label: "Weekly" },
  { id: "biweekly", label: "Bi-weekly" },
  { id: "monthly",  label: "Monthly" },
];
const START_OPTIONS = [
  { id: "today", label: "Today",        addDays: 0  },
  { id: "3d",    label: "In 3 days",    addDays: 3  },
  { id: "7d",    label: "In 1 week",    addDays: 7  },
  { id: "14d",   label: "In 2 weeks",   addDays: 14 },
] as const;

function dateInDays(addDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  // YYYY-MM-DD; the Success screen accepts an ISO date string.
  return d.toISOString().slice(0, 10);
}

export default function QuickCircleScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // Defaults baked in per the prompt's "Quick Circle" template.
  const [name, setName] = useState("My Quick Circle");
  const [amount, setAmount] = useState<number>(100);
  const [memberCount, setMemberCount] = useState<number>(10);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startId, setStartId] = useState<(typeof START_OPTIONS)[number]["id"]>("7d");

  const startDate = useMemo(() => {
    const opt = START_OPTIONS.find((o) => o.id === startId)!;
  const { t } = useTranslation();
    return dateInDays(opt.addDays);
  }, [startId]);

  const totalPayout = amount * memberCount;
  const durationLabel = `${memberCount} ${frequency === "weekly" ? "weeks" : frequency === "biweekly" ? "fortnights" : "months"}`;

  const stepMembers = (delta: number) => {
    setMemberCount((m) => Math.max(MIN_MEMBERS, Math.min(MAX_MEMBERS, m + delta)));
  };

  const handleCreate = () => {
    if (!user?.id) {
      Alert.alert(t("final_polish.quickcircle_alert_sign_in_required"), "We need a signed-in session before creating a circle.");
      return;
    }
    if (!name.trim()) {
      Alert.alert(t("final_polish.quickcircle_alert_pick_a_name"), "Give your circle a short name first.");
      return;
    }

    // Delegate to the existing CreateCircleSuccess screen -- it already
    // calls createCircle() and renders the share/invite UI. Everything
    // not exposed in the form gets a sensible default.
    navigation.navigate("CreateCircleSuccess", {
      circleType: "traditional",
      name: name.trim(),
      amount,
      frequency,
      memberCount,
      startDate,
      rotationMethod: "xnscore",
      gracePeriodDays: 2,
      invitedMembers: [],     // empty -- user shares the invite link from the Success screen
      description: "",
      // No beneficiary / recurring fields on the Quick path -- the
      // wizard's longer flow covers those. Pass undefined explicitly
      // so the Success screen's type contract is satisfied.
      beneficiaryName:    undefined,
      beneficiaryReason:  undefined,
      beneficiaryPhone:   undefined,
      beneficiaryCountry: undefined,
      isRecurring:        undefined,
      totalCycles:        undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("screen_headers.quick_circle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Ionicons name="flash" size={20} color={TEAL} />
          <Text style={styles.heroTitle}>{t("final_polish.quickcircle_one_tap_setup")}</Text>
          <Text style={styles.heroBody}>
            We've pre-filled the most common circle. Tweak amount,
            members, frequency, or start date — or just tap Create.
          </Text>
        </View>

        {/* Name */}
        <Text style={styles.sectionLabel}>{t("final_polish.quickcircle_circle_name")}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("final_polish.quickcircle_ph_my_quick_circle")}
            placeholderTextColor={MUTED}
            maxLength={50}
            accessibilityLabel="Circle name"
          />
        </View>

        {/* Amount */}
        <Text style={styles.sectionLabel}>{t("final_polish.quickcircle_contribution_per_cycle")}</Text>
        <View style={styles.chipRow}>
          {AMOUNT_CHIPS.map((value) => {
            const active = amount === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.amountChip, active && styles.amountChipActive]}
                onPress={() => setAmount(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.amountChipText, active && { color: "#FFFFFF" }]}>
                  ${value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Members stepper */}
        <Text style={styles.sectionLabel}>{t("final_polish.quickcircle_members")}</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepBtn, memberCount <= MIN_MEMBERS && styles.stepBtnDisabled]}
            onPress={() => stepMembers(-1)}
            disabled={memberCount <= MIN_MEMBERS}
            accessibilityRole="button"
            accessibilityLabel="Decrease member count"
          >
            <Ionicons
              name="remove"
              size={20}
              color={memberCount <= MIN_MEMBERS ? MUTED : NAVY}
            />
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <Text style={styles.stepperValueNum}>{memberCount}</Text>
            <Text style={styles.stepperValueLabel}>members</Text>
          </View>
          <TouchableOpacity
            style={[styles.stepBtn, memberCount >= MAX_MEMBERS && styles.stepBtnDisabled]}
            onPress={() => stepMembers(+1)}
            disabled={memberCount >= MAX_MEMBERS}
            accessibilityRole="button"
            accessibilityLabel="Increase member count"
          >
            <Ionicons
              name="add"
              size={20}
              color={memberCount >= MAX_MEMBERS ? MUTED : NAVY}
            />
          </TouchableOpacity>
        </View>

        {/* Frequency */}
        <Text style={styles.sectionLabel}>{t("final_polish.quickcircle_frequency")}</Text>
        <View style={styles.segment}>
          {FREQ_OPTIONS.map((opt) => {
            const active = frequency === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.segItem, active && styles.segItemActive]}
                onPress={() => setFrequency(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segText, active && { color: "#FFFFFF" }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Start date */}
        <Text style={styles.sectionLabel}>{t("final_polish.quickcircle_start_date")}</Text>
        <View style={styles.startRow}>
          {START_OPTIONS.map((opt) => {
            const active = startId === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.startChip, active && styles.startChipActive]}
                onPress={() => setStartId(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.startChipText, active && { color: "#FFFFFF" }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>{t("final_polish.quickcircle_each_cycle")}</Text>
          <Text style={styles.previewBig}>
            ${amount} × {memberCount} = ${totalPayout}
          </Text>
          <Text style={styles.previewMeta}>
            Each member receives ${totalPayout} once over {durationLabel}.
          </Text>
          <View style={styles.previewDivider} />
          <Text style={styles.previewMeta}>
            Starts {startDate}. Payout order set by XnScore (highest first).
            2-day grace on missed contributions.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Create circle"
        >
          <Text style={styles.ctaBtnText}>{t("final_polish.quickcircle_create_circle")}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    gap: 6,
    alignItems: "center",
  },
  heroTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginTop: 4 },
  heroBody: { fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 18 },

  sectionLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 6,
  },

  inputWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  input: { fontSize: 15, color: NAVY, paddingVertical: 12 },

  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  amountChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  amountChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  amountChipText: { fontSize: 14, fontWeight: "700", color: NAVY },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    marginBottom: 14,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
  },
  stepBtnDisabled: { opacity: 0.5 },
  stepperValue: { flex: 1, alignItems: "center" },
  stepperValueNum: { fontSize: 22, fontWeight: "700", color: NAVY },
  stepperValueLabel: { fontSize: 11, color: MUTED, marginTop: 2 },

  segment: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    marginBottom: 14,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  segItemActive: { backgroundColor: NAVY },
  segText: { fontSize: 13, fontWeight: "700", color: NAVY },

  startRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  startChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  startChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  startChipText: { fontSize: 12, fontWeight: "600", color: NAVY },

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 6,
  },
  previewLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  previewBig: { fontSize: 20, fontWeight: "700", color: NAVY, marginBottom: 4 },
  previewMeta: { fontSize: 12, color: MUTED, lineHeight: 18 },
  previewDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  ctaBtn: {
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
