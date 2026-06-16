// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateEventScreen.tsx — Community event creation (P1 rewrite).
// ══════════════════════════════════════════════════════════════════════════════
//
// P1 (2026-06-12):
//   - Restructured 7-section form into 3 surfaces: Image (top) → Essentials
//     → Pricing → expandable "More details". Median user publishes with
//     4 fields touched; power users tap "More details" once.
//   - Smart date chips above the picker: Tonight / Tomorrow / This Friday
//     / This Saturday (each fills date + time at 19:00).
//   - Pre-fills location_name from profiles.city + country on first mount.
//   - Inline validation (red border + helper text on blur) for required
//     fields. Drops the post-submit "Please fill required fields" alert.
//   - First-visit coach mark (AsyncStorage @tandaxn_event_create_seen_v1)
//     — 2 slides covering what to publish + how tickets work.
//   - Submit is OPTIMISTIC: insert the row with image_url=null and
//     navigate back immediately, then downscale + upload the flyer in the
//     background and PATCH the row when the public URL is ready.
//   - Image downscale via expo-image-manipulator (max width 1600 px,
//     aspect ratio preserved) — keeps uploads fast on 12 MP phone photos.
//   - Ticket-link validation: must start with http:// or https://. The
//     real link-open lives in EventsScreen.handleBuyTicket.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
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
const MAX_IMAGE_WIDTH_PX = 1600;
const TICKET_URL_RE = /^https?:\/\//i;

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
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => {});
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

  // P2 (migration 158) — category + price suggestion. Category auto-detects
  // on title blur; the user can override via the chip row. Price suggestion
  // resolves once both category and location are set.
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [categoryAutoSet, setCategoryAutoSet] = useState(false);
  const handleTitleBlur = () => {
    if (category !== null && !categoryAutoSet) return; // user already chose
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

  // Per-field touched flags — drives inline validation. A field is in
  // error state when (touched && empty) for required fields.
  const [touched, setTouched] = useState<{
    title: boolean;
    description: boolean;
    location: boolean;
  }>({ title: false, description: false, location: false });

  // ── Profile-driven location pre-fill ───────────────────────────────────
  // Single shot on mount: if the user has city/country in their profile and
  // hasn't already typed a location, seed locationName with "City, Country".
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
      }
    } finally {
      setPicking(false);
    }
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

    // Mark everything touched so a hard-stop on required fields surfaces
    // inline rather than via Alert.
    setTouched({ title: true, description: true, location: true });
    if (titleEmpty || descriptionEmpty || locationEmpty) {
      return;
    }

    // Ticket link sanity: if present, must be http(s).
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

    // full_address is NOT NULL in the schema but optional in the new
    // form — fall back to location_name so the constraint is satisfied
    // without forcing the user into the "More details" disclosure.
    const fullAddressForRow =
      fullAddress.trim() === "" ? locationName.trim() : fullAddress.trim();

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
      // P2 (migration 158) — bounded category. NULL when the user didn't
      // pick and keyword detection found nothing. The DB CHECK allows NULL.
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

    // Bust the upcoming-events cache so EventsScreen's focus refetch sees
    // the new row immediately.
    invalidateUpcomingEventsCache();

    // Kick off the image upload in the background — don't block navigation.
    if (imageLocalUri) {
      kickOffImageUpload(imageLocalUri, user.id, row.id, t);
    }

    Alert.alert(
      t("create_event.success_title"),
      imageLocalUri
        ? t("create_event.success_body_with_image")
        : t("create_event.success_body"),
      [{ text: "OK", onPress: () => navigation.goBack() }],
    );
  };

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
        {/* ===== IMAGE (top — visual hook anchors the rest) ===== */}
        <View style={styles.imageCard}>
          {imageLocalUri ? (
            <Image
              source={{ uri: imageLocalUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
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
            disabled={picking}
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

          {/* P2 — Category chips. Auto-detects from the title on blur;
              user can override here. */}
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
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(_, selected) => {
                if (Platform.OS !== "ios") setShowDatePicker(false);
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
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                if (Platform.OS !== "ios") setShowTimePicker(false);
                if (selected) setTime(selected);
              }}
            />
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

              {/* P2 — Price suggestion chip. Shows only when we have a
                  category + location AND the median came back non-null.
                  Tapping fills the field with the suggestion. */}
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
// Background image upload — fire-and-forget after the row insert.
// Best-effort: if upload or patch fails we surface a single quiet Alert
// but the event itself is already published (just without a flyer).
// ==========================================================================

function kickOffImageUpload(
  localUri: string,
  userId: string,
  eventId: string,
  t: (key: string) => string,
) {
  (async () => {
    const { publicUrl, error } = await uploadFlyer(localUri, userId);
    if (error || !publicUrl) {
      Alert.alert(
        t("create_event.image_upload_failed_title"),
        t("create_event.image_upload_failed_body"),
      );
      return;
    }
    const { error: updErr } = await supabase
      .from("community_events")
      .update({ image_url: publicUrl })
      .eq("id", eventId);
    if (updErr) {
      Alert.alert(
        t("create_event.image_upload_failed_title"),
        t("create_event.image_upload_failed_body"),
      );
      return;
    }
    invalidateUpcomingEventsCache();
  })().catch(() => {
    /* swallow — we already alerted above for known failure modes */
  });
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
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    marginBottom: 10,
  },
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
