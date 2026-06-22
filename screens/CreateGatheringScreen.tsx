// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateGatheringScreen.tsx — Host a gathering (community-scoped form)
// ══════════════════════════════════════════════════════════════════════════════
//
// HG Bucket A (2026-06-21) — critical fixes pass:
//   A.1 Real @react-native-community/datetimepicker (was freeform
//       TextInputs that crashed `new Date(...).toISOString()` on
//       malformed strings).
//   A.2 Future-date guard (block submit when startsAt <= now+5min).
//   A.3 AsyncStorage draft auto-save with restored-pill UI + discard
//       confirm. Mirrors CDP / CE patterns.
//   A.4 EVENT_TYPES labels + descriptions moved to i18n. Loop
//       variable renamed from `t` so it stops shadowing the
//       useTranslation hook.
//   A.5 Submit-button copy i18n'd.
//   A.6 Native Alert success → showToast + immediate goBack.
//   A.7 locationName required when !isVirtual (inline pill).
//   A.8 organizerFirstName fallback chain: metadata → full_name →
//       email prefix → "Member".
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useGatherings, GatheringType } from "../hooks/useCommunityFeatures";
import { showToast } from "../components/Toast";

// ══════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════

const DRAFT_KEY_PREFIX = "@tandaxn_gathering_draft_v1:";
const DRAFT_DEBOUNCE_MS = 500;
// HG Bucket A.2 — give the picker default-now value a 30-min lead so a
// user opening the screen at 14:55 doesn't get a default of 14:55 (past
// by the time they tap Submit).
const DEFAULT_LEAD_MIN = 30;
// 5-minute floor in the future-date guard — submitting "in 1 minute"
// will fail the check too.
const FUTURE_GUARD_MIN = 5;

const EVENT_TYPE_KEYS: ReadonlyArray<{
  key: GatheringType;
  icon: string;
  color: string;
}> = [
  { key: "community",     icon: "people",       color: "#00C6AE" },
  { key: "circle",        icon: "sync-circle",  color: "#6366F1" },
  { key: "elder_session", icon: "school",       color: "#F59E0B" },
  { key: "service",       icon: "storefront",   color: "#8B5CF6" },
];

type DraftV1 = {
  v: 1;
  eventType: GatheringType;
  title: string;
  description: string;
  dateIso: string | null;  // serialised Date or null
  timeIso: string | null;
  isVirtual: boolean;
  locationName: string;
  virtualLink: string;
  isFamilyWelcome: boolean;
  addToMemory: boolean;
};

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

// Combine a date-only Date (Y/M/D meaningful) with a time-only Date
// (H/M meaningful) into a single Date. Mirrors the CreateEventScreen
// pattern.
function combineDateAndTime(date: Date, time: Date): Date {
  const d = new Date(date);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + DEFAULT_LEAD_MIN);
  d.setSeconds(0, 0);
  return d;
}

// ══════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════

export default function CreateGatheringScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const communityId = (route.params as any)?.communityId ?? "";
  const { user } = useAuth();
  const { createGathering } = useGatherings(communityId);

  // ── Form state ────────────────────────────────────────────────────────
  const [eventType, setEventType] = useState<GatheringType>("community");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(defaultStart);
  const [time, setTime] = useState<Date>(defaultStart);
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState("");
  const [locationName, setLocationName] = useState("");
  const [isFamilyWelcome, setIsFamilyWelcome] = useState(false);
  const [addToMemory, setAddToMemory] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  // HG Bucket A.4 — i18n-resolved EVENT_TYPES list. The loop variable
  // below is `ev` (not `t`) so the useTranslation t() stays in scope.
  const EVENT_TYPES = useMemo(
    () =>
      EVENT_TYPE_KEYS.map(({ key, icon, color }) => ({
        key,
        icon,
        color,
        label: t(`create_gathering.type_${key}_label`),
        desc: t(`create_gathering.type_${key}_desc`),
      })),
    [t],
  );

  // ── Future-date guard (A.2) ───────────────────────────────────────────
  // Computed every render — cheap, and the picker state changes drive
  // it naturally. The 5-minute floor catches "submitting at 14:59 for
  // 14:59" cases.
  const startsAt = useMemo(() => combineDateAndTime(date, time), [date, time]);
  const startsAtPast = useMemo(() => {
    const floor = new Date();
    floor.setMinutes(floor.getMinutes() + FUTURE_GUARD_MIN);
    return startsAt.getTime() <= floor.getTime();
  }, [startsAt]);

  // ── Location guard (A.7) ──────────────────────────────────────────────
  const locationMissing =
    !isVirtual && locationName.trim().length === 0;

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    !startsAtPast &&
    !locationMissing &&
    !!communityId;

  // ── Draft auto-save (A.3) ─────────────────────────────────────────────
  const [draftRestored, setDraftRestored] = useState(false);
  const hydratedRef = useRef(false);
  const publishedRef = useRef(false);
  const draftKey =
    user?.id && communityId
      ? DRAFT_KEY_PREFIX + user.id + ":" + communityId
      : null;

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!draftKey) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (cancelled || !raw) {
          hydratedRef.current = true;
          return;
        }
        const draft = JSON.parse(raw) as DraftV1;
        if (draft.v !== 1) {
          hydratedRef.current = true;
          return;
        }
        const hasContent =
          (draft.title?.length ?? 0) > 0 ||
          (draft.description?.length ?? 0) > 0 ||
          (draft.locationName?.length ?? 0) > 0 ||
          (draft.virtualLink?.length ?? 0) > 0;
        if (!hasContent) {
          hydratedRef.current = true;
          return;
        }
        setEventType(draft.eventType ?? "community");
        setTitle(draft.title ?? "");
        setDescription(draft.description ?? "");
        if (draft.dateIso) setDate(new Date(draft.dateIso));
        if (draft.timeIso) setTime(new Date(draft.timeIso));
        setIsVirtual(draft.isVirtual ?? false);
        setLocationName(draft.locationName ?? "");
        setVirtualLink(draft.virtualLink ?? "");
        setIsFamilyWelcome(draft.isFamilyWelcome ?? false);
        setAddToMemory(draft.addToMemory ?? false);
        setDraftRestored(true);
      } catch {
        // Corrupt draft → ignore and continue.
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  // Debounced save. Skips writes until hydration completes so a fresh
  // empty mount doesn't overwrite an existing draft.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!draftKey) return;
    if (publishedRef.current) return;
    const handle = setTimeout(() => {
      const draft: DraftV1 = {
        v: 1,
        eventType,
        title,
        description,
        dateIso: date ? date.toISOString() : null,
        timeIso: time ? time.toISOString() : null,
        isVirtual,
        locationName,
        virtualLink,
        isFamilyWelcome,
        addToMemory,
      };
      const hasContent =
        title.length > 0 ||
        description.length > 0 ||
        locationName.length > 0 ||
        virtualLink.length > 0;
      if (hasContent) {
        AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
      } else {
        AsyncStorage.removeItem(draftKey).catch(() => {});
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [
    draftKey,
    eventType,
    title,
    description,
    date,
    time,
    isVirtual,
    locationName,
    virtualLink,
    isFamilyWelcome,
    addToMemory,
  ]);

  const handleDiscardDraft = useCallback(() => {
    Alert.alert(
      t("create_gathering.draft_discard_title"),
      t("create_gathering.draft_discard_body"),
      [
        { text: t("create_gathering.draft_keep"), style: "cancel" },
        {
          text: t("create_gathering.draft_discard_confirm"),
          style: "destructive",
          onPress: () => {
            setEventType("community");
            setTitle("");
            setDescription("");
            setDate(defaultStart());
            setTime(defaultStart());
            setIsVirtual(false);
            setLocationName("");
            setVirtualLink("");
            setIsFamilyWelcome(false);
            setAddToMemory(false);
            setDraftRestored(false);
            if (draftKey) {
              AsyncStorage.removeItem(draftKey).catch(() => {});
            }
          },
        },
      ],
    );
  }, [t, draftKey]);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) {
      showToast(t("create_gathering.alert_required_name"), "error");
      return;
    }
    if (startsAtPast) {
      showToast(t("create_gathering.date_error_future"), "error");
      return;
    }
    if (locationMissing) {
      showToast(t("create_gathering.location_required"), "error");
      return;
    }
    if (!communityId) {
      showToast(t("create_gathering.alert_failed_create"), "error");
      return;
    }

    setSubmitting(true);
    try {
      // HG Bucket A.8 — organiser name fallback chain. user_metadata
      // is the canonical write target on sign-up; full_name lands on
      // the profile row; the email prefix is a final hedge before
      // "Member".
      const organizerFirstName: string =
        (user as any)?.user_metadata?.first_name ??
        (user as any)?.full_name?.split(" ")[0] ??
        (user as any)?.email?.split("@")[0] ??
        "Member";

      await createGathering({
        communityId,
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        locationName: isVirtual ? undefined : locationName.trim() || undefined,
        isVirtual,
        virtualLink: isVirtual ? virtualLink.trim() || undefined : undefined,
        startsAt: startsAt.toISOString(),
        isFamilyWelcome,
        addToMemory,
        organizerFirstName,
        organizerOrigin: (user as any)?.user_metadata?.origin_country,
      });

      publishedRef.current = true;
      if (draftKey) {
        AsyncStorage.removeItem(draftKey).catch(() => {});
      }
      showToast(t("create_gathering.success"), "success");
      navigation.goBack();
    } catch (err: any) {
      // HG Bucket A.6 — toast instead of a blocking Alert. Raw err
      // message is acceptable here; a future bucket can map common
      // PG/Supabase codes to nicer copy.
      showToast(
        err?.message ?? t("create_gathering.alert_failed_create"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════
  const datePlatform = Platform.OS;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("create_gathering.header_title")}</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* HG Bucket A.3 — restored-draft pill. */}
          {draftRestored && (
            <View style={styles.draftPill}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#0A2342" />
              <Text style={styles.draftPillText}>
                {t("create_gathering.draft_restored")}
              </Text>
              <TouchableOpacity onPress={handleDiscardDraft} accessibilityRole="button">
                <Text style={styles.draftPillDiscardText}>
                  {t("create_gathering.draft_discard")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Type Selection */}
          <Text style={styles.sectionLabel}>{t("create_gathering.section_event_type")}</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((ev) => (
              <TouchableOpacity
                key={ev.key}
                style={[
                  styles.typeCard,
                  eventType === ev.key && { borderColor: ev.color, backgroundColor: ev.color + "10" },
                ]}
                onPress={() => setEventType(ev.key)}
              >
                <View style={[styles.typeIcon, { backgroundColor: ev.color + "20" }]}>
                  <Ionicons name={ev.icon as any} size={24} color={ev.color} />
                </View>
                <Text style={styles.typeLabel}>{ev.label}</Text>
                <Text style={styles.typeDesc}>{ev.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Event Details */}
          <Text style={styles.sectionLabel}>{t("create_gathering.section_details")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("create_gathering.placeholder_name")}
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t("create_gathering.placeholder_description")}
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Date & Time — HG Bucket A.1 */}
          <Text style={styles.sectionLabel}>{t("final_polish.creategathering_when")}</Text>
          {datePlatform === "ios" ? (
            <>
              <TouchableOpacity
                style={[styles.input, startsAtPast && styles.inputError]}
                onPress={() => setShowDateTimePicker(true)}
                accessibilityRole="button"
              >
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {", "}
                  {time.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
              {showDateTimePicker && (
                <DateTimePicker
                  value={combineDateAndTime(date, time)}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDateTimePicker(false);
                    if (selected) {
                      setDate(selected);
                      setTime(selected);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.input, { flex: 1 }, startsAtPast && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
              >
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flex: 1 }, startsAtPast && styles.inputError]}
                onPress={() => setShowTimePicker(true)}
                accessibilityRole="button"
              >
                <Text style={styles.inputValueText}>
                  {time.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDatePicker(false);
                    if (selected) setDate(selected);
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(_, selected) => {
                    setShowTimePicker(false);
                    if (selected) setTime(selected);
                  }}
                />
              )}
            </View>
          )}
          {startsAtPast && (
            <Text style={styles.errorText}>
              {t("create_gathering.date_error_future")}
            </Text>
          )}

          {/* Location */}
          <Text style={styles.sectionLabel}>{t("create_gathering.section_where")}</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("create_gathering.switch_virtual")}</Text>
            <Switch value={isVirtual} onValueChange={setIsVirtual} trackColor={{ true: "#00C6AE" }} />
          </View>
          {isVirtual ? (
            <TextInput
              style={styles.input}
              placeholder={t("create_gathering.placeholder_meeting_link")}
              placeholderTextColor="#9CA3AF"
              value={virtualLink}
              onChangeText={setVirtualLink}
            />
          ) : (
            <>
              <TextInput
                style={[styles.input, locationMissing && styles.inputError]}
                placeholder={t("create_gathering.placeholder_location")}
                placeholderTextColor="#9CA3AF"
                value={locationName}
                onChangeText={setLocationName}
              />
              {locationMissing && (
                <Text style={styles.errorText}>
                  {t("create_gathering.location_required")}
                </Text>
              )}
            </>
          )}

          {/* Options */}
          <Text style={styles.sectionLabel}>{t("final_polish.creategathering_options")}</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t("final_polish.creategathering_families_welcome")}</Text>
              <Text style={styles.switchHint}>{t("final_polish.creategathering_let_members_know_they_can_bring_family")}</Text>
            </View>
            <Switch value={isFamilyWelcome} onValueChange={setIsFamilyWelcome} trackColor={{ true: "#00C6AE" }} />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t("final_polish.creategathering_add_to_community_memory")}</Text>
              <Text style={styles.switchHint}>{t("final_polish.creategathering_archive_this_event_after_it_happens")}</Text>
            </View>
            <Switch value={addToMemory} onValueChange={setAddToMemory} trackColor={{ true: "#00C6AE" }} />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.createBtn, !canSubmit && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={!canSubmit}
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>
              {submitting
                ? t("create_gathering.submitting")
                : t("create_gathering.submit")}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 10, marginTop: 20 },

  // HG Bucket A.3 — restored-draft pill
  draftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  draftPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  draftPillDiscardText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2342",
    textDecorationLine: "underline",
  },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center" },
  typeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  typeLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  typeDesc: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 15, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  inputError: { borderColor: "#EF4444" },
  inputValueText: { fontSize: 15, color: "#0A2342" },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  switchLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
  switchHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
