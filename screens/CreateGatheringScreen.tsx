// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateGatheringScreen.tsx — Host a gathering (community-scoped form)
// ══════════════════════════════════════════════════════════════════════════════
//
// HG Bucket A (2026-06-21) — critical fixes:
//   A.1 Real @react-native-community/datetimepicker (was freeform
//       TextInputs that crashed on malformed strings).
//   A.2 Future-date guard (block submit when startsAt <= now+5min).
//   A.3 AsyncStorage draft auto-save with restored-pill UI + discard
//       confirm.
//   A.4 EVENT_TYPES → i18n. Loop variable renamed `t → ev` to stop
//       shadowing useTranslation.
//   A.5 Submit-button copy i18n'd.
//   A.6 Native Alert success → showToast + immediate goBack.
//   A.7 locationName required when !isVirtual (inline pill).
//   A.8 organizerFirstName fallback chain.
//
// HG Bucket B (2026-06-21) — UX clarity:
//   B.1 Inline HelpSheet (4 topics) + (?) header trigger.
//   B.2 First-visit coach mark over the event-type strip
//       (@tandaxn_create_gathering_coach_seen_v1). 4 s auto-dismiss
//       + tap-to-dismiss. Suppressed when a draft was restored —
//       returning users don't need to be re-taught.
//   B.3 Character counters on title (max 80) and description
//       (max 1000). Hidden while short, switch to "X left" at the
//       warn threshold, flip red on the ceiling.
//   B.4 Live preview card above Submit. Renders once the title
//       has at least 3 chars — gives "post-and-regret" friction
//       reduction without committing the user to a full visual
//       fidelity component.
//   B.5 Conditional Max-attendees row when eventType ===
//       'elder_session'. Stored as a string in state so the user
//       can backspace freely; coerced to Number on submit, falling
//       back to MAX_ATTENDEES_DEFAULT if blank.
//   B.6 ⓘ icons next to Family-welcome and Add-to-memory switches
//       open a quick Alert tooltip — strictly more discoverable
//       than the muted hint copy they replace.
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
  Modal,
  Pressable,
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
// HG Bucket A.2 — picker default-now lead so the guard doesn't trip
// the moment the screen opens.
const DEFAULT_LEAD_MIN = 30;
const FUTURE_GUARD_MIN = 5;

// HG Bucket B.2 — first-visit coach mark gate.
const COACH_MARK_KEY = "@tandaxn_create_gathering_coach_seen_v1";

// HG Bucket B.3 — title counter thresholds.
const TITLE_MAX = 80;
const TITLE_COUNT_SHOW_AT = 50;
const TITLE_COUNT_WARN_AT = TITLE_MAX - 10; // 70

// HG Bucket B.3 — description counter thresholds.
const DESC_MAX = 1000;
const DESC_COUNT_SHOW_AT = 200;
const DESC_COUNT_WARN_AT = DESC_MAX - 200; // 800

// HG Bucket B.5 — default attendees for an elder session.
const MAX_ATTENDEES_DEFAULT = 10;

// HG Bucket B.1 — HelpSheet topic list. Strings come from i18n; this
// is just the ordering.
type HelpTopic = "what_vs_event" | "add_to_memory" | "who_sees" | "rsvp";
const HELP_TOPICS: HelpTopic[] = [
  "what_vs_event",
  "add_to_memory",
  "who_sees",
  "rsvp",
];

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
  dateIso: string | null;
  timeIso: string | null;
  isVirtual: boolean;
  locationName: string;
  virtualLink: string;
  isFamilyWelcome: boolean;
  addToMemory: boolean;
  // HG Bucket B.5 — persisted as string (matches TextInput value
  // shape; empty string survives the round-trip cleanly).
  maxAttendees: string;
};

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

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
  // HG Bucket B.5
  const [maxAttendees, setMaxAttendees] = useState<string>(
    String(MAX_ATTENDEES_DEFAULT),
  );

  // ── UI state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  // HG Bucket B.1
  const [helpOpen, setHelpOpen] = useState(false);

  // ── i18n-resolved event types (HG Bucket A.4) ─────────────────────────
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

  // ── Computed validation state ─────────────────────────────────────────
  const startsAt = useMemo(() => combineDateAndTime(date, time), [date, time]);
  const startsAtPast = useMemo(() => {
    const floor = new Date();
    floor.setMinutes(floor.getMinutes() + FUTURE_GUARD_MIN);
    return startsAt.getTime() <= floor.getTime();
  }, [startsAt]);

  const locationMissing =
    !isVirtual && locationName.trim().length === 0;

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    !startsAtPast &&
    !locationMissing &&
    !!communityId;

  // ── Draft auto-save (HG Bucket A.3) ───────────────────────────────────
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
        if (draft.maxAttendees) setMaxAttendees(draft.maxAttendees);
        setDraftRestored(true);
      } catch {
        // Corrupt draft → ignore.
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

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
        maxAttendees,
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
    maxAttendees,
  ]);

  // ── Coach mark (HG Bucket B.2) ────────────────────────────────────────
  // Read AsyncStorage after hydration finishes so we know whether the
  // draft restored. The coach mark is for fresh first-time users only —
  // a returning user who already has a draft already knows the form.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    if (!hydratedRef.current) return;
    coachCheckedRef.current = true;
    if (draftRestored) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && !seen) setCoachVisible(true);
      } catch {
        // AsyncStorage failure → keep hidden, treat as "seen".
      }
    })();
    return () => {
      cancelled = true;
    };
    // The effect re-evaluates on each render until coachCheckedRef
    // flips; the body bails immediately after.
  });
  const dismissCoach = useCallback(() => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!coachVisible) return;
    const id = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(id);
  }, [coachVisible, dismissCoach]);

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
            setMaxAttendees(String(MAX_ATTENDEES_DEFAULT));
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
      const organizerFirstName: string =
        (user as any)?.user_metadata?.first_name ??
        (user as any)?.full_name?.split(" ")[0] ??
        (user as any)?.email?.split("@")[0] ??
        "Member";

      // HG Bucket B.5 — only send maxAttendees on elder sessions.
      // Coerce to Number, fall back to default if blank/non-numeric.
      let parsedMaxAttendees: number | undefined;
      if (eventType === "elder_session") {
        const n = Number(maxAttendees);
        parsedMaxAttendees =
          Number.isFinite(n) && n > 0 ? Math.floor(n) : MAX_ATTENDEES_DEFAULT;
      }

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
        maxAttendees: parsedMaxAttendees,
      });

      publishedRef.current = true;
      if (draftKey) {
        AsyncStorage.removeItem(draftKey).catch(() => {});
      }
      showToast(t("create_gathering.success"), "success");
      navigation.goBack();
    } catch (err: any) {
      showToast(
        err?.message ?? t("create_gathering.alert_failed_create"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // Derived UI helpers
  // ══════════════════════════════════════════════════════════════════════

  const showTitleCount = title.length > TITLE_COUNT_SHOW_AT;
  const titleNearMax = title.length >= TITLE_COUNT_WARN_AT;
  const titleAtMax = title.length >= TITLE_MAX;

  const showDescCount = description.length > DESC_COUNT_SHOW_AT;
  const descNearMax = description.length >= DESC_COUNT_WARN_AT;
  const descAtMax = description.length >= DESC_MAX;

  // HG Bucket B.4 — preview gate.
  const showPreview = title.trim().length >= 3;
  const previewType = EVENT_TYPES.find((e) => e.key === eventType) ?? EVENT_TYPES[0];
  const previewOrganizerFirstName: string =
    (user as any)?.user_metadata?.first_name ??
    (user as any)?.full_name?.split(" ")[0] ??
    (user as any)?.email?.split("@")[0] ??
    "Member";
  const previewWhen = startsAt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const previewWhere = isVirtual
    ? t("create_gathering.preview_virtual")
    : locationName.trim() || t("create_gathering.preview_location_tba");

  // HG Bucket B.6 — tooltip handlers.
  const showFamilyTip = () =>
    Alert.alert(
      t("final_polish.creategathering_families_welcome"),
      t("create_gathering.family_welcome_tip"),
    );
  const showMemoryTip = () =>
    Alert.alert(
      t("final_polish.creategathering_add_to_community_memory"),
      t("create_gathering.add_to_memory_tip"),
    );

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
          {/* HG Bucket B.1 — (?) trigger replaces the spacer. */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setHelpOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("create_gathering.help.title")}
          >
            <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
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
          {/* HG Bucket B.2 — coach mark over the event-type strip. */}
          {coachVisible && (
            <Pressable
              onPress={dismissCoach}
              style={styles.coachBanner}
              accessibilityRole="button"
              accessibilityLabel={t("create_gathering.coach.dismiss")}
            >
              <Ionicons name="bulb-outline" size={16} color="#FFFFFF" />
              <Text style={styles.coachText}>
                {t("create_gathering.coach.title")}
              </Text>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          )}
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
            maxLength={TITLE_MAX}
          />
          {showTitleCount && (
            <Text
              style={[
                styles.charCount,
                {
                  color: titleAtMax
                    ? "#EF4444"
                    : titleNearMax
                      ? "#F59E0B"
                      : "#00C6AE",
                },
              ]}
            >
              {titleNearMax
                ? t("create_gathering.char_count_left", {
                    count: TITLE_MAX - title.length,
                  })
                : t("create_gathering.char_count", {
                    current: title.length,
                    max: TITLE_MAX,
                  })}
            </Text>
          )}
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t("create_gathering.placeholder_description")}
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={DESC_MAX}
          />
          {showDescCount && (
            <Text
              style={[
                styles.charCount,
                {
                  color: descAtMax
                    ? "#EF4444"
                    : descNearMax
                      ? "#F59E0B"
                      : "#00C6AE",
                },
              ]}
            >
              {descNearMax
                ? t("create_gathering.char_count_left", {
                    count: DESC_MAX - description.length,
                  })
                : t("create_gathering.char_count", {
                    current: description.length,
                    max: DESC_MAX,
                  })}
            </Text>
          )}

          {/* HG Bucket B.5 — Max attendees only for elder_session. */}
          {eventType === "elder_session" && (
            <>
              <Text style={styles.subSectionLabel}>
                {t("create_gathering.max_attendees_label")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("create_gathering.max_attendees_placeholder")}
                placeholderTextColor="#9CA3AF"
                value={maxAttendees}
                onChangeText={(v) => setMaxAttendees(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                maxLength={3}
              />
            </>
          )}

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
          {/* HG Bucket B.6 — Family welcome row with ⓘ tooltip. */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.switchLabel}>
                {t("final_polish.creategathering_families_welcome")}
              </Text>
              <TouchableOpacity
                onPress={showFamilyTip}
                accessibilityRole="button"
                accessibilityLabel={t("create_gathering.family_welcome_tip")}
                style={styles.infoIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle-outline" size={16} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <Switch value={isFamilyWelcome} onValueChange={setIsFamilyWelcome} trackColor={{ true: "#00C6AE" }} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.switchLabel}>
                {t("final_polish.creategathering_add_to_community_memory")}
              </Text>
              <TouchableOpacity
                onPress={showMemoryTip}
                accessibilityRole="button"
                accessibilityLabel={t("create_gathering.add_to_memory_tip")}
                style={styles.infoIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle-outline" size={16} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <Switch value={addToMemory} onValueChange={setAddToMemory} trackColor={{ true: "#00C6AE" }} />
          </View>

          {/* HG Bucket B.4 — live preview card. */}
          {showPreview && (
            <View style={styles.previewWrap}>
              <Text style={styles.previewLabel}>
                {t("create_gathering.preview_label")}
              </Text>
              <View style={styles.previewCard}>
                <View
                  style={[
                    styles.previewTypePill,
                    { backgroundColor: previewType.color + "20" },
                  ]}
                >
                  <Ionicons
                    name={previewType.icon as any}
                    size={12}
                    color={previewType.color}
                  />
                  <Text
                    style={[styles.previewTypeText, { color: previewType.color }]}
                  >
                    {previewType.label}
                  </Text>
                </View>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {title.trim()}
                </Text>
                <View style={styles.previewMetaRow}>
                  <Ionicons name="time-outline" size={13} color="#6B7280" />
                  <Text style={styles.previewMetaText}>{previewWhen}</Text>
                </View>
                <View style={styles.previewMetaRow}>
                  <Ionicons
                    name={isVirtual ? "videocam-outline" : "location-outline"}
                    size={13}
                    color="#6B7280"
                  />
                  <Text style={styles.previewMetaText}>{previewWhere}</Text>
                </View>
                <View style={styles.previewMetaRow}>
                  <Ionicons name="person-outline" size={13} color="#6B7280" />
                  <Text style={styles.previewMetaText}>
                    {t("create_gathering.preview_organizer", {
                      name: previewOrganizerFirstName,
                    })}
                  </Text>
                </View>
              </View>
            </View>
          )}

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

      {/* HG Bucket B.1 — HelpSheet renders outside the keyboard-avoiding
          view so it overlays cleanly. */}
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        t={t}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HelpSheet — HG Bucket B.1
// ══════════════════════════════════════════════════════════════════════════
// Four topics: gathering vs event, add to memory, who sees, RSVPs.

function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: (key: string, opts?: any) => string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpBackdrop} onPress={onClose}>
        <Pressable style={styles.helpSheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.helpHeaderRow}>
            <Text style={styles.helpTitle}>
              {t("create_gathering.help.title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("create_gathering.help.close")}
            >
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.helpScroll}
          >
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>
                  {t(`create_gathering.help.topic_${topic}`)}
                </Text>
                <Text style={styles.helpItemBody}>
                  {t(`create_gathering.help.topic_${topic}_desc`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  subSectionLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 6, marginTop: 4 },

  // HG Bucket A.3
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

  // HG Bucket B.2 — coach mark banner
  coachBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A2342",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  coachText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
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
  // HG Bucket B.3 — char counter
  charCount: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    marginTop: -6,
    marginBottom: 10,
    paddingRight: 4,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  switchLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
  switchLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  infoIconBtn: {
    padding: 2,
  },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  // HG Bucket B.4 — live preview
  previewWrap: {
    marginTop: 24,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  previewTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  previewTypeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  previewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewMetaText: {
    fontSize: 12,
    color: "#6B7280",
  },

  // HG Bucket B.1 — HelpSheet
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  helpSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  helpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
  },
  helpScroll: { paddingBottom: 8 },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  helpItemBody: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },
});
