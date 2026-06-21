// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateEventScreen.tsx — Community event creation
// ══════════════════════════════════════════════════════════════════════════════
//
// History:
//   P1 (2026-06-12): restructured 7-section form into 3 surfaces + smart
//                    date chips + profile-driven location pre-fill + inline
//                    validation + first-visit coach mark + optimistic insert
//                    + background image downscale + upload.
//   P2 (2026-06-15): category auto-detect from title + price suggestion.
//   Bucket A of Create-an-event review (2026-06-20):
//     - Draft saving: every form field change persists to AsyncStorage
//       under `@tandaxn_event_draft_v1:<userId>` (debounced 500 ms). On
//       mount, if a draft exists and the form is empty, restore it and
//       show a "Restored from draft — Discard?" pill. Cleared on publish.
//     - Image upload state machine — replaces the silent background
//       upload with an explicit pill: idle → uploading → uploaded ✓ →
//       failed (with Retry / Skip buttons). Local URI is stashed in
//       AsyncStorage keyed by event id so retry doesn't need re-pick.
//     - Image preview gains a × remove button (was replace-only).
//     - Publish replaces blocking Alert with showToast + immediate
//       goBack (matches Post-to-Community Bucket A pattern).
//     - Date + Time merge into a single picker on iOS (mode="datetime"),
//       separate on Android.
//     - full_address fallback hack removed (migration 222 dropped NOT
//       NULL); the column is now genuinely optional and inserts as null
//       when the user leaves it empty.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";
import {
  type ContactInfo,
  type EventCategory,
  EVENT_CATEGORIES,
  categoriseFromTitle,
  invalidateUpcomingEventsCache,
  suggestEventPrice,
} from "../hooks/useEvents";

// ==========================================================================
// Constants + helpers
// ==========================================================================

const COACH_MARK_KEY = "@tandaxn_event_create_seen_v1";
const DRAFT_KEY_PREFIX = "@tandaxn_event_draft_v1:";
const RETRY_URI_KEY_PREFIX = "@tandaxn_event_flyer_retry_uri:";
const MAX_IMAGE_WIDTH_PX = 1600;
const TICKET_URL_RE = /^https?:\/\//i;
const DRAFT_DEBOUNCE_MS = 500;

function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours());
  combined.setMinutes(time.getMinutes());
  combined.setSeconds(0);
  combined.setMilliseconds(0);
  return combined;
}

function at19(d: Date): Date {
  const x = new Date(d);
  x.setHours(19, 0, 0, 0);
  return x;
}

function nextWeekday(target: number, from: Date = new Date()): Date {
  // target: 0=Sun..6=Sat. Returns the next occurrence (today included if match).
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const cur = d.getDay();
  const diff = (target - cur + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

async function downscaleIfLarge(uri: string): Promise<string> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_WIDTH_PX } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return out.uri;
  } catch {
    return uri; // best-effort; fall back to original on any manipulator error
  }
}

async function uploadFlyer(
  localUri: string,
  userId: string,
): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    const downscaled = await downscaleIfLarge(localUri);
    const resp = await fetch(downscaled);
    const blob = await resp.blob();
    const extMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(downscaled);
    const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
    const ts = `${Math.floor(Math.random() * 1e9)}-${Math.floor(Math.random() * 1e9)}`;
    const path = `${userId}/${ts}.${ext}`;
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const { error: upErr } = await supabase.storage
      .from("event-flyers")
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data } = supabase.storage.from("event-flyers").getPublicUrl(path);
    return { publicUrl: data.publicUrl, error: null };
  } catch (e: any) {
    return { publicUrl: null, error: e?.message ?? "unknown" };
  }
}

// Bucket A — shape of the form state we persist to AsyncStorage. Date
// fields are stored as ISO strings so they round-trip through JSON; the
// `category` field rides as a string union or null.
type DraftShape = {
  title: string;
  description: string;
  dateIso: string;
  timeIso: string;
  locationName: string;
  fullAddress: string;
  isFree: boolean;
  priceUsd: string;
  priceDescription: string;
  ticketLink: string;
  ageRange: string;
  prizes: string;
  presentedBy: string;
  phone: string;
  email: string;
  category: EventCategory | null;
};

// Image upload state machine. `idle` covers both "no image picked" and
// "image picked but submit not yet attempted" — the screen drives the
// transition via flags rather than implicit state.
type ImageStatus = "idle" | "uploading" | "uploaded" | "failed";

// ==========================================================================
// Component
// ==========================================================================

export default function CreateEventScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { user } = useAuth();

  // ── Coach mark (first-visit) ────────────────────────────────────────────
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachSlide, setCoachSlide] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && seen !== "1") setCoachVisible(true);
      } catch {
        /* AsyncStorage failure is non-fatal — silently skip the modal. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissCoach = () => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => undefined);
  };

  // ── Form state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [time, setTime] = useState<Date>(() => {
    const t = new Date();
    t.setHours(18, 0, 0, 0);
    return t;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Bucket A — iOS combined date+time picker. Android keeps the two
  // separate flows above because the platform picker is modal-per-mode.
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [fullAddress, setFullAddress] = useState("");

  const [isFree, setIsFree] = useState(true);
  const [priceUsd, setPriceUsd] = useState("");
  const [priceDescription, setPriceDescription] = useState("");
  const [ticketLink, setTicketLink] = useState("");

  const [ageRange, setAgeRange] = useState("");
  const [prizes, setPrizes] = useState("");
  const [presentedBy, setPresentedBy] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Disclosure for the optional fields block.
  const [moreOpen, setMoreOpen] = useState(false);

  // P2 (migration 158) — category + price suggestion.
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [categoryAutoSet, setCategoryAutoSet] = useState(false);
  const handleTitleBlur = () => {
    if (category !== null && !categoryAutoSet) return;
    const detected = categoriseFromTitle(title);
    if (detected) {
      setCategory(detected);
      setCategoryAutoSet(true);
    }
  };
  const handleCategoryPick = (cat: EventCategory) => {
    setCategory(cat);
    setCategoryAutoSet(false);
  };

  const [priceSuggestion, setPriceSuggestion] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPriceSuggestion(null);
    if (!category || !locationName.trim()) return;
    suggestEventPrice(category, locationName.trim()).then((p) => {
      if (!cancelled) setPriceSuggestion(p);
    });
    return () => {
      cancelled = true;
    };
  }, [category, locationName]);

  // Per-field touched flags — drives inline validation.
  const [touched, setTouched] = useState<{
    title: boolean;
    description: boolean;
    location: boolean;
  }>({ title: false, description: false, location: false });

  // Bucket A — Image upload state machine + the event id once we have
  // a published row. Both are needed by Retry: the upload helper writes
  // to event-flyers/<userId>/<random>.jpg, then PATCHes the row id.
  const [imageStatus, setImageStatus] = useState<ImageStatus>("idle");
  const [publishedEventId, setPublishedEventId] = useState<string | null>(null);

  // Bucket A — draft restore + save lifecycle. `draftRestoredAt` flags a
  // restore session so the screen can render the "Restored from draft"
  // pill until the user dismisses it or starts a new edit.
  const [draftRestored, setDraftRestored] = useState(false);
  // Hydration guard — we MUST NOT save the empty default state on first
  // render, or we would overwrite a real draft before the restore effect
  // has a chance to load it.
  const hydratedRef = useRef(false);
  const draftKey = user?.id ? DRAFT_KEY_PREFIX + user.id : null;

  // ── Profile-driven location pre-fill ───────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("city, country")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const city = (data?.city ?? "").toString().trim();
      const country = (data?.country ?? "").toString().trim();
      if (!city && !country) return;
      const seed = [city, country].filter(Boolean).join(", ");
      setLocationName((prev) => (prev.trim() === "" ? seed : prev));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Bucket A — Draft restore on mount ──────────────────────────────────
  // Only restore when the form is "empty" (title + description blank) so
  // we don't blow away in-progress work if the user happens to navigate
  // back into the screen mid-edit (StackNavigator preserves state).
  useEffect(() => {
    if (!draftKey) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (cancelled || !raw) {
          hydratedRef.current = true;
          return;
        }
        const draft = JSON.parse(raw) as Partial<DraftShape>;
        // Bail if the user has already typed anything — restore would
        // clobber it.
        if (title.trim() !== "" || description.trim() !== "") {
          hydratedRef.current = true;
          return;
        }
        if (typeof draft.title === "string") setTitle(draft.title);
        if (typeof draft.description === "string") setDescription(draft.description);
        if (typeof draft.dateIso === "string") {
          const d = new Date(draft.dateIso);
          if (!Number.isNaN(d.getTime())) setDate(d);
        }
        if (typeof draft.timeIso === "string") {
          const tm = new Date(draft.timeIso);
          if (!Number.isNaN(tm.getTime())) setTime(tm);
        }
        if (typeof draft.locationName === "string") setLocationName(draft.locationName);
        if (typeof draft.fullAddress === "string") setFullAddress(draft.fullAddress);
        if (typeof draft.isFree === "boolean") setIsFree(draft.isFree);
        if (typeof draft.priceUsd === "string") setPriceUsd(draft.priceUsd);
        if (typeof draft.priceDescription === "string") setPriceDescription(draft.priceDescription);
        if (typeof draft.ticketLink === "string") setTicketLink(draft.ticketLink);
        if (typeof draft.ageRange === "string") setAgeRange(draft.ageRange);
        if (typeof draft.prizes === "string") setPrizes(draft.prizes);
        if (typeof draft.presentedBy === "string") setPresentedBy(draft.presentedBy);
        if (typeof draft.phone === "string") setPhone(draft.phone);
        if (typeof draft.email === "string") setEmail(draft.email);
        if (draft.category === null || EVENT_CATEGORIES.includes(draft.category as EventCategory)) {
          setCategory((draft.category ?? null) as EventCategory | null);
        }
        setDraftRestored(true);
      } catch {
        // Corrupt draft — silently drop it.
        AsyncStorage.removeItem(draftKey).catch(() => undefined);
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bucket A — Debounced draft save on form changes ────────────────────
  useEffect(() => {
    if (!draftKey || !hydratedRef.current) return;
    const tid = setTimeout(() => {
      const draft: DraftShape = {
        title,
        description,
        dateIso: date.toISOString(),
        timeIso: time.toISOString(),
        locationName,
        fullAddress,
        isFree,
        priceUsd,
        priceDescription,
        ticketLink,
        ageRange,
        prizes,
        presentedBy,
        phone,
        email,
        category,
      };
      AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => undefined);
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(tid);
  }, [
    draftKey,
    title,
    description,
    date,
    time,
    locationName,
    fullAddress,
    isFree,
    priceUsd,
    priceDescription,
    ticketLink,
    ageRange,
    prizes,
    presentedBy,
    phone,
    email,
    category,
  ]);

  const clearDraft = () => {
    if (!draftKey) return;
    AsyncStorage.removeItem(draftKey).catch(() => undefined);
    setDraftRestored(false);
  };

  const handleDiscardDraft = () => {
    Alert.alert(
      t("create_event.draft_discard_title"),
      t("create_event.draft_discard_body"),
      [
        { text: t("create_event.draft_discard_cancel"), style: "cancel" },
        {
          text: t("create_event.draft_discard_confirm"),
          style: "destructive",
          onPress: () => {
            clearDraft();
            // Reset to defaults
            setTitle("");
            setDescription("");
            const d = new Date();
            d.setDate(d.getDate() + 7);
            setDate(d);
            const t2 = new Date();
            t2.setHours(18, 0, 0, 0);
            setTime(t2);
            setLocationName("");
            setFullAddress("");
            setIsFree(true);
            setPriceUsd("");
            setPriceDescription("");
            setTicketLink("");
            setAgeRange("");
            setPrizes("");
            setPresentedBy("");
            setPhone("");
            setEmail("");
            setCategory(null);
            setCategoryAutoSet(false);
            setImageLocalUri(null);
            setImageStatus("idle");
            showToast(t("create_event.draft_cleared"), "info");
          },
        },
      ],
    );
  };

  // ── Smart date chips (Tonight / Tomorrow / This Friday / This Saturday) ─
  const chips = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const fri = nextWeekday(5, today);
    const sat = nextWeekday(6, today);
    return [
      { key: "tonight", date: today },
      { key: "tomorrow", date: tomorrow },
      { key: "friday", date: fri },
      { key: "saturday", date: sat },
    ] as const;
  }, []);
  const applyChip = (chipDate: Date) => {
    setDate(chipDate);
    setTime(at19(chipDate));
  };

  // ── Image picker ───────────────────────────────────────────────────────
  const handlePickImage = async () => {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("create_event.image_picker_perm_title"),
          t("create_event.image_picker_perm_body"),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageLocalUri(result.assets[0].uri);
        // Picking a new image after a failed upload resets the status
        // back to idle so the next submit kicks off a fresh upload.
        setImageStatus("idle");
      }
    } finally {
      setPicking(false);
    }
  };

  const handleRemoveImage = () => {
    setImageLocalUri(null);
    setImageStatus("idle");
  };

  // Bucket A — Retry of a failed flyer upload. The published event id +
  // local URI live in component state (and the URI is also stashed in
  // AsyncStorage as a defensive backup keyed by event id).
  const handleRetryImage = async () => {
    if (!user?.id || !publishedEventId || !imageLocalUri) return;
    setImageStatus("uploading");
    const { publicUrl, error } = await uploadFlyer(imageLocalUri, user.id);
    if (error || !publicUrl) {
      setImageStatus("failed");
      return;
    }
    const { error: updErr } = await supabase
      .from("community_events")
      .update({ image_url: publicUrl })
      .eq("id", publishedEventId);
    if (updErr) {
      setImageStatus("failed");
      return;
    }
    invalidateUpcomingEventsCache();
    AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + publishedEventId).catch(
      () => undefined,
    );
    setImageStatus("uploaded");
  };

  const handleSkipImage = () => {
    // User chose to publish without the flyer. Drop the local URI + the
    // retry stash so the failed-state pill goes away.
    if (publishedEventId) {
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + publishedEventId).catch(
        () => undefined,
      );
    }
    setImageStatus("idle");
    setImageLocalUri(null);
  };

  // ── Validation helpers ─────────────────────────────────────────────────
  const titleEmpty = title.trim() === "";
  const descriptionEmpty = description.trim() === "";
  const locationEmpty = locationName.trim() === "";
  const showTitleError = touched.title && titleEmpty;
  const showDescriptionError = touched.description && descriptionEmpty;
  const showLocationError = touched.location && locationEmpty;

  // ── Submit (optimistic insert + background upload) ─────────────────────
  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert(
        t("create_event.auth_required_title"),
        t("create_event.auth_required_body"),
      );
      return;
    }

    setTouched({ title: true, description: true, location: true });
    if (titleEmpty || descriptionEmpty || locationEmpty) {
      return;
    }

    const ticketTrimmed = ticketLink.trim();
    if (ticketTrimmed && !TICKET_URL_RE.test(ticketTrimmed)) {
      Alert.alert(
        t("create_event.ticket_invalid_title"),
        t("create_event.ticket_invalid_body"),
      );
      return;
    }

    const eventDatetime = combineDateAndTime(date, time).toISOString();
    const priceNumeric = isFree
      ? 0
      : Number.isFinite(parseFloat(priceUsd))
        ? parseFloat(priceUsd)
        : 0;

    const contact: ContactInfo = {};
    if (phone.trim()) contact.phone = phone.trim();
    if (email.trim()) contact.email = email.trim();
    if (ticketTrimmed) contact.ticket_link = ticketTrimmed;
    const contactHasAny = Object.keys(contact).length > 0;

    // Bucket A — migration 222 dropped NOT NULL on full_address; we now
    // insert NULL when the user left it empty instead of falling back
    // to location_name.
    const fullAddressForRow = fullAddress.trim() === "" ? null : fullAddress.trim();

    const insertPayload = {
      user_id: user.id,
      title: title.trim(),
      event_datetime: eventDatetime,
      location_name: locationName.trim(),
      full_address: fullAddressForRow,
      price: priceNumeric,
      price_description: priceDescription.trim() || null,
      description: description.trim(),
      image_url: null as string | null,
      contact_info: contactHasAny ? contact : null,
      age_range: ageRange.trim() || null,
      prizes: prizes.trim() || null,
      presented_by: presentedBy.trim() || null,
      category,
    };

    setSubmitting(true);
    const { data: row, error: insErr } = await supabase
      .from("community_events")
      .insert(insertPayload)
      .select("id")
      .single();
    setSubmitting(false);

    if (insErr || !row) {
      Alert.alert(
        t("create_event.submit_failed_title"),
        t("create_event.submit_failed_body"),
      );
      return;
    }

    invalidateUpcomingEventsCache();

    // Bucket A — clear the saved draft now that the event has landed.
    clearDraft();

    // Bucket A — image upload is now state-machine driven. We kick off
    // the upload from the screen rather than navigating away, so the
    // user sees the "Uploading flyer…" pill and can retry on failure.
    if (imageLocalUri) {
      setPublishedEventId(row.id);
      // Stash the local URI keyed by event id so a Retry survives a
      // process restart between failure and retry.
      AsyncStorage.setItem(
        RETRY_URI_KEY_PREFIX + row.id,
        imageLocalUri,
      ).catch(() => undefined);
      setImageStatus("uploading");
      const { publicUrl, error } = await uploadFlyer(imageLocalUri, user.id);
      if (error || !publicUrl) {
        setImageStatus("failed");
        // Stop here — keep the user on the screen so the Retry/Skip
        // affordance is visible. They can also tap the (×) and publish
        // without the flyer.
        showToast(
          t("create_event.published_toast_no_image"),
          "success",
        );
        return;
      }
      const { error: updErr } = await supabase
        .from("community_events")
        .update({ image_url: publicUrl })
        .eq("id", row.id);
      if (updErr) {
        setImageStatus("failed");
        showToast(
          t("create_event.published_toast_no_image"),
          "success",
        );
        return;
      }
      invalidateUpcomingEventsCache();
      AsyncStorage.removeItem(RETRY_URI_KEY_PREFIX + row.id).catch(
        () => undefined,
      );
      setImageStatus("uploaded");
    }

    // Bucket A — replace blocking Alert with inline toast + immediate
    // goBack. Matches the Post-to-Community Bucket A pattern.
    showToast(
      imageLocalUri
        ? t("create_event.published_toast_with_image")
        : t("create_event.published_toast"),
      "success",
    );
    navigation.goBack();
  };

  // Bucket A — single render-time computation drives the image status
  // pill's copy and color. Pill renders only when status !== 'idle' OR
  // an image has been picked but not yet submitted.
  const imagePillVisible = imageStatus !== "idle" || !!imageLocalUri;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      <LinearGradient
        colors={[colors.primaryNavy, "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("create_event.header_title")}</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bucket A — Restored-from-draft pill. Only shown when the
            mount-time restore loaded any saved fields. */}
        {draftRestored ? (
          <View style={styles.draftPill}>
            <Ionicons
              name="cloud-download-outline"
              size={14}
              color={colors.primaryNavy}
            />
            <Text style={styles.draftPillText}>
              {t("create_event.draft_restored")}
            </Text>
            <TouchableOpacity
              onPress={handleDiscardDraft}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
            >
              <Text style={styles.draftPillAction}>
                {t("create_event.draft_discard")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== IMAGE (top — visual hook anchors the rest) ===== */}
        <View style={styles.imageCard}>
          {imageLocalUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: imageLocalUri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              {/* Bucket A — × remove button. Disabled while an upload is
                  in flight so we don't yank the rug out from under it. */}
              <TouchableOpacity
                style={[
                  styles.imageRemoveBtn,
                  imageStatus === "uploading" && styles.imageRemoveBtnDisabled,
                ]}
                onPress={handleRemoveImage}
                disabled={imageStatus === "uploading"}
                accessibilityRole="button"
                accessibilityLabel={t("create_event.image_remove")}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={36}
                color={colors.textSecondary}
              />
              <Text style={styles.imagePlaceholderText}>
                {t("create_event.image_hint_optional")}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.imagePickBtn}
            onPress={handlePickImage}
            disabled={picking || imageStatus === "uploading"}
            accessibilityRole="button"
          >
            <Ionicons
              name={imageLocalUri ? "refresh-outline" : "image-outline"}
              size={16}
              color={colors.primaryNavy}
            />
            <Text style={styles.imagePickBtnText}>
              {picking
                ? t("create_event.image_picking")
                : imageLocalUri
                  ? t("create_event.image_replace_btn")
                  : t("create_event.image_pick_btn")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bucket A — Image upload status pill. Sits between the image
            card and Essentials, so the user can see it without scrolling
            to the submit button. */}
        {imagePillVisible ? <ImageStatusPill status={imageStatus} onRetry={handleRetryImage} onSkip={handleSkipImage} t={t} /> : null}

        {/* ===== ESSENTIALS ===== */}
        <SectionHeader text={t("create_event.section_essentials")} />
        <View style={styles.card}>
          <FieldLabel text={t("create_event.field_title")} required />
          <TextInput
            style={[styles.input, showTitleError && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            onBlur={() => {
              setTouched((s) => ({ ...s, title: true }));
              handleTitleBlur();
            }}
            placeholder={t("create_event.field_title_placeholder")}
            placeholderTextColor={colors.textSecondary}
          />
          {showTitleError ? (
            <Text style={styles.helperError}>
              {t("create_event.validation_title_missing")}
            </Text>
          ) : null}

          <FieldLabel text={t("create_event.field_category")} />
          <View style={styles.p2CategoryRow}>
            {EVENT_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.p2CategoryChip, active && styles.p2CategoryChipActive]}
                  onPress={() => handleCategoryPick(cat)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.p2CategoryChipText,
                      active && styles.p2CategoryChipTextActive,
                    ]}
                  >
                    {t(`create_event.category_${cat}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {categoryAutoSet && category ? (
            <Text style={styles.p2CategoryHint}>
              {t("create_event.category_auto_hint", {
                category: t(`create_event.category_${category}`),
              })}
            </Text>
          ) : null}

          <FieldLabel text={t("create_event.field_description")} required />
          <TextInput
            style={[
              styles.input,
              styles.inputMultiline,
              showDescriptionError && styles.inputError,
            ]}
            value={description}
            onChangeText={setDescription}
            onBlur={() => setTouched((s) => ({ ...s, description: true }))}
            placeholder={t("create_event.field_description_placeholder")}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {showDescriptionError ? (
            <Text style={styles.helperError}>
              {t("create_event.validation_description_missing")}
            </Text>
          ) : null}

          {/* Smart date chips */}
          <FieldLabel text={t("create_event.field_date")} required />
          <View style={styles.chipRow}>
            {chips.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={styles.chip}
                onPress={() => applyChip(c.date)}
                accessibilityRole="button"
                accessibilityLabel={t(`create_event.chip_${c.key}`)}
              >
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={colors.accentTeal}
                />
                <Text style={styles.chipText}>
                  {t(`create_event.chip_${c.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bucket A — On iOS, a single date+time picker. On Android,
              keep separate date and time fields because the platform
              picker is modal-per-mode. */}
          {Platform.OS === "ios" ? (
            <>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDateTimePicker(true)}
                accessibilityRole="button"
              >
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
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
            <>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
              >
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
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

              <FieldLabel text={t("create_event.field_time")} required />
              <TouchableOpacity
                style={styles.input}
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
            </>
          )}

          <FieldLabel text={t("create_event.field_location_name")} required />
          <TextInput
            style={[styles.input, showLocationError && styles.inputError]}
            value={locationName}
            onChangeText={setLocationName}
            onBlur={() => setTouched((s) => ({ ...s, location: true }))}
            placeholder={t("create_event.field_location_name_placeholder")}
            placeholderTextColor={colors.textSecondary}
          />
          {showLocationError ? (
            <Text style={styles.helperError}>
              {t("create_event.validation_location_missing")}
            </Text>
          ) : null}
        </View>

        {/* ===== PRICING ===== */}
        <SectionHeader text={t("create_event.section_pricing")} />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t("create_event.field_is_free")}
            </Text>
            <Switch
              value={isFree}
              onValueChange={setIsFree}
              trackColor={{ false: colors.border, true: colors.accentTeal }}
              thumbColor={colors.cardBg}
            />
          </View>

          {!isFree && (
            <>
              <FieldLabel text={t("create_event.field_price")} />
              <TextInput
                style={styles.input}
                value={priceUsd}
                onChangeText={setPriceUsd}
                placeholder={t("create_event.field_price_placeholder")}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {priceSuggestion !== null && priceSuggestion > 0 ? (
                <TouchableOpacity
                  style={styles.p2PriceChip}
                  onPress={() => setPriceUsd(priceSuggestion.toFixed(2))}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={12}
                    color="#0A2342"
                  />
                  <Text style={styles.p2PriceChipText}>
                    {t("create_event.price_suggest_chip", {
                      amount: `$${priceSuggestion.toFixed(2)}`,
                    })}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <FieldLabel text={t("create_event.field_price_description")} />
              <TextInput
                style={styles.input}
                value={priceDescription}
                onChangeText={setPriceDescription}
                placeholder={t(
                  "create_event.field_price_description_placeholder",
                )}
                placeholderTextColor={colors.textSecondary}
              />
            </>
          )}

          <FieldLabel text={t("create_event.field_ticket_link")} />
          <TextInput
            style={styles.input}
            value={ticketLink}
            onChangeText={setTicketLink}
            placeholder={t("create_event.field_ticket_link_placeholder")}
            placeholderTextColor={colors.textSecondary}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* ===== MORE DETAILS (disclosure) ===== */}
        <TouchableOpacity
          style={styles.disclosureHeader}
          onPress={() => setMoreOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
        >
          <Ionicons
            name="ellipsis-horizontal-circle-outline"
            size={18}
            color={colors.primaryNavy}
          />
          <Text style={styles.disclosureText}>
            {t("create_event.section_more_details")}
          </Text>
          <Ionicons
            name={moreOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {moreOpen && (
          <View style={styles.card}>
            <FieldLabel text={t("create_event.field_full_address")} />
            <TextInput
              style={styles.input}
              value={fullAddress}
              onChangeText={setFullAddress}
              placeholder={t("create_event.field_full_address_placeholder")}
              placeholderTextColor={colors.textSecondary}
            />

            <FieldLabel text={t("create_event.field_age_range")} />
            <TextInput
              style={styles.input}
              value={ageRange}
              onChangeText={setAgeRange}
              placeholder={t("create_event.field_age_range_placeholder")}
              placeholderTextColor={colors.textSecondary}
            />

            <FieldLabel text={t("create_event.field_prizes")} />
            <TextInput
              style={styles.input}
              value={prizes}
              onChangeText={setPrizes}
              placeholder={t("create_event.field_prizes_placeholder")}
              placeholderTextColor={colors.textSecondary}
            />

            <FieldLabel text={t("create_event.field_presented_by")} />
            <TextInput
              style={styles.input}
              value={presentedBy}
              onChangeText={setPresentedBy}
              placeholder={t("create_event.field_presented_by_placeholder")}
              placeholderTextColor={colors.textSecondary}
            />

            <FieldLabel text={t("create_event.field_phone")} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t("create_event.field_phone_placeholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />

            <FieldLabel text={t("create_event.field_email")} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("create_event.field_email_placeholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* ===== SUBMIT ===== */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <>
              <ActivityIndicator color={colors.textWhite} size="small" />
              <Text style={styles.submitBtnText}>
                {t("create_event.submit_btn_saving")}
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="paper-plane-outline"
                size={16}
                color={colors.textWhite}
              />
              <Text style={styles.submitBtnText}>
                {t("create_event.submit_btn")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ===== COACH MARK ===== */}
      <Modal
        visible={coachVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissCoach}
      >
        <View style={styles.coachBackdrop}>
          <View style={styles.coachCard}>
            <Ionicons
              name={coachSlide === 0 ? "create-outline" : "ticket-outline"}
              size={36}
              color={colors.accentTeal}
              style={{ marginBottom: 14 }}
            />
            <Text style={styles.coachTitle}>
              {t(`create_event.coach_slide${coachSlide + 1}_title`)}
            </Text>
            <Text style={styles.coachBody}>
              {t(`create_event.coach_slide${coachSlide + 1}_body`)}
            </Text>
            <View style={styles.coachDots}>
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 0 && styles.coachDotActive,
                ]}
              />
              <View
                style={[
                  styles.coachDot,
                  coachSlide === 1 && styles.coachDotActive,
                ]}
              />
            </View>
            <View style={styles.coachActions}>
              <TouchableOpacity
                onPress={dismissCoach}
                style={styles.coachSkipBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachSkipText}>
                  {t("create_event.coach_skip")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (coachSlide === 1) {
                    dismissCoach();
                  } else {
                    setCoachSlide(1);
                  }
                }}
                style={styles.coachPrimaryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.coachPrimaryText}>
                  {coachSlide === 1
                    ? t("create_event.coach_got_it")
                    : t("create_event.coach_next")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================================================
// Image status pill — Bucket A. Sits between the image card and Essentials,
// renders the upload state machine (uploading / uploaded / failed) with
// a Retry + Skip row when the upload fails.
// ==========================================================================

function ImageStatusPill({
  status,
  onRetry,
  onSkip,
  t,
}: {
  status: ImageStatus;
  onRetry: () => void;
  onSkip: () => void;
  t: (key: string, opts?: any) => string;
}) {
  if (status === "idle") return null;
  if (status === "uploading") {
    return (
      <View style={[styles.uploadPill, styles.uploadPillUploading]}>
        <ActivityIndicator size="small" color={colors.primaryNavy} />
        <Text style={styles.uploadPillText}>
          {t("create_event.image_uploading")}
        </Text>
      </View>
    );
  }
  if (status === "uploaded") {
    return (
      <View style={[styles.uploadPill, styles.uploadPillUploaded]}>
        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
        <Text style={styles.uploadPillText}>
          {t("create_event.image_uploaded")}
        </Text>
      </View>
    );
  }
  // failed
  return (
    <View style={[styles.uploadPill, styles.uploadPillFailed]}>
      <Ionicons name="alert-circle" size={14} color="#DC2626" />
      <Text style={[styles.uploadPillText, { flex: 1 }]}>
        {t("create_event.image_upload_failed_short")}
      </Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button">
        <Text style={styles.uploadPillAction}>
          {t("create_event.image_retry")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} accessibilityRole="button">
        <Text style={styles.uploadPillActionMuted}>
          {t("create_event.image_skip")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ==========================================================================
// Small presentational helpers
// ==========================================================================

function SectionHeader({ text }: { text: string }) {
  return <Text style={styles.sectionHeader}>{text}</Text>;
}

function FieldLabel({
  text,
  required,
}: {
  text: string;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabelText}>{text}</Text>
      {required ? <Text style={styles.fieldLabelRequired}>*</Text> : null}
    </View>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },

  // Bucket A — draft restore pill
  draftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDFB",
    borderColor: colors.accentTeal,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  draftPillText: { flex: 1, fontSize: 12, color: colors.primaryNavy, fontWeight: "600" },
  draftPillAction: { fontSize: 12, color: colors.accentTeal, fontWeight: "700" },

  // Bucket A — image upload status pill
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  uploadPillUploading: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  uploadPillUploaded: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  uploadPillFailed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#DC2626",
  },
  uploadPillText: { fontSize: 12, color: colors.textPrimary, fontWeight: "600" },
  uploadPillAction: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  uploadPillActionMuted: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    paddingHorizontal: 6,
  },

  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginTop: 14,
    marginBottom: 8,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  fieldLabelRequired: {
    fontSize: 13,
    color: colors.errorText,
    fontWeight: "700",
  },

  input: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: colors.errorText,
    backgroundColor: "#FEF2F2",
  },
  helperError: {
    fontSize: 11,
    color: colors.errorText,
    marginTop: 4,
    marginLeft: 2,
  },
  // P2 — category chips + price suggestion chip
  p2CategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  p2CategoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: colors.border,
  },
  p2CategoryChipActive: {
    backgroundColor: colors.primaryNavy,
    borderColor: colors.primaryNavy,
  },
  p2CategoryChipText: { fontSize: 11, fontWeight: "700", color: colors.primaryNavy },
  p2CategoryChipTextActive: { color: "#FFFFFF" },
  p2CategoryHint: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  p2PriceChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
    marginTop: 8,
  },
  p2PriceChipText: { fontSize: 11, fontWeight: "700", color: "#0A2342" },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  inputValueText: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Smart-date chips row.
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
  },
  chipText: {
    fontSize: 12,
    color: colors.accentTeal,
    fontWeight: "700",
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  // Image (top-of-form) card.
  imageCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePreviewWrap: {
    position: "relative",
    marginBottom: 10,
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
  },
  // Bucket A — × remove button overlay on the image preview.
  imageRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageRemoveBtnDisabled: { opacity: 0.4 },
  imagePlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 6,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  imagePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.cardBg,
    borderColor: colors.primaryNavy,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  imagePickBtnText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 13,
  },

  // Disclosure (More details).
  disclosureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 14,
    marginBottom: 6,
  },
  disclosureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accentTeal,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: "700",
  },

  // Coach mark modal.
  coachBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  coachCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  coachTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  coachBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  coachDots: { flexDirection: "row", gap: 6, marginBottom: 18 },
  coachDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  coachDotActive: { backgroundColor: colors.accentTeal, width: 18 },
  coachActions: { flexDirection: "row", gap: 10, width: "100%" },
  coachSkipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.screenBg,
  },
  coachSkipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  coachPrimaryBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.accentTeal,
  },
  coachPrimaryText: {
    fontSize: 13,
    color: colors.textWhite,
    fontWeight: "700",
  },
});
