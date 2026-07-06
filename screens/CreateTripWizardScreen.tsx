import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useCreateTripWizard } from '../hooks/useTripOrganizer';
import { useFormKeyboardOffset } from '../hooks/useFormKeyboardOffset';
import { useFormDraft } from '../hooks/useFormDraft';
import { useEventTracker } from '../hooks/useEventTracker';
import {
  TripOrganizerEngine,
  type PaymentFrequency,
  type InstallmentSchedule,
} from '../services/TripOrganizerEngine';
import { MediaUploadService } from '../services/MediaUploadService';

// --- Design tokens ---
const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const GOLD = '#E8A842';
const BG = colors.screenBg;

const TOTAL_STEPS = 4;

// i18n: step name keys resolved per-render via t() at call site.
const STEP_NAME_KEYS = [
  'create_trip_wizard.step_basics',
  'create_trip_wizard.step_payment',
  'create_trip_wizard.step_requirements',
  'create_trip_wizard.step_review',
];

// B.2 — first-visit coach mark gate. Same AsyncStorage prefix as the other
// recent B-bucket coach marks (substitute, partial, conflict, etc.) so a
// reset of one feature key doesn't dump the others.
const COACH_MARK_KEY = '@tandaxn_trip_wizard_coach_seen_v1';

// B.1 — HelpSheet topic list. Strings come from i18n; this is just the
// ordering so the topics render in a deterministic sequence.
type HelpTopic =
  | 'what'
  | 'pricing'
  | 'refund'
  | 'documents'
  | 'publish';
const HELP_TOPICS: HelpTopic[] = [
  'what',
  'pricing',
  'refund',
  'documents',
  'publish',
];

// --- Types ---
interface TripFormData {
  cover_photo_url: string;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  max_participants: string;
  tagline: string;
  description: string;
  whats_included: string;
  whats_excluded: string;
  price_per_person: string;
  payment_type: 'lump_sum' | 'installments';
  payment_frequency: PaymentFrequency;   // only used when payment_type === 'installments'
  installment_count: number;             // ditto
  deposit_required: boolean;
  deposit_amount: string;
  refund_policy: string;
  // A.3 — explicit cutoff in days (column on trips, previously not exposed).
  // Stored as a string for TextInput; '' means "not specified" and becomes
  // null on save. The picker resets this to '0' when the user chooses
  // "No refunds" so the saved row is self-consistent.
  refund_cutoff_days: string;
  requirements: RequirementItem[];
  custom_requirements: string[];
  messaging_mode: boolean;
  auto_reminders: boolean;
  notify_payment: boolean;
  notify_docs: boolean;
  notify_itinerary: boolean;
}

interface RequirementItem {
  id: string;
  label: string;
  enabled: boolean;
}

// ── Local draft persistence ──────────────────────────────────────────────────
// Shadow copy of the wizard form state, kept in AsyncStorage so a user who
// quits mid-flow without tapping "Save Draft" (which writes a Trip row with
// status='draft' to the DB) can resume their entered values on a later
// visit. The two concepts coexist:
//   - Server-side "Save Draft" (existing): the wizard's saveDraft() function
//     calls TripOrganizerEngine.updateTrip / wizard.saveDraft. This is what
//     ships when the user explicitly taps the Save Draft button.
//   - Client-side "form draft" (this addition): debounced AsyncStorage write
//     on every field change. Restored opt-in via banner on Step 0.
//
// The draft shape mirrors TripFormData 1:1 + the active step. We persist
// currentStep too so Restore returns the user to where they were, rather
// than inferring (the spec asked for inference; saving currentStep is
// simpler and just as correct since the screen owns the step counter).
interface TripDraft extends TripFormData {
  currentStep: number;
}
const TRIP_DRAFT_KEY = 'trip-wizard';

const DEFAULT_REQUIREMENTS: RequirementItem[] = [
  { id: 'passport', label: 'Passport', enabled: true },
  { id: 'emergency_contact', label: 'Emergency Contact', enabled: true },
  { id: 'waiver', label: 'Waiver', enabled: false },
  { id: 'dietary', label: 'Dietary Preferences', enabled: false },
  { id: 'tshirt', label: 'T-Shirt Size', enabled: false },
];

const REFUND_POLICIES = [
  'Full refund up to 30 days before',
  'Full refund up to 14 days before',
  '50% refund up to 7 days before',
  'No refunds',
  'Custom',
];

// Map human-readable refund policy to DB enum: 'none' | 'partial' | 'full'
const mapRefundPolicyToDB = (policy: string): string => {
  if (!policy || policy === 'No refunds') return 'none';
  if (policy.startsWith('Full refund')) return 'full';
  if (policy.startsWith('50%') || policy === 'Custom') return 'partial';
  return 'none';
};

// Reverse of mapRefundPolicyToDB — lossy because the DB enum is coarser than
// the display options. Pick a reasonable default display for each enum.
const mapRefundPolicyFromDB = (db?: string | null): string => {
  if (db === 'full') return 'Full refund up to 30 days before';
  if (db === 'partial') return '50% refund up to 7 days before';
  if (db === 'none') return 'No refunds';
  return '';
};

// --- Sub-components ---

// B.3 — Tappable step indicator (backward only). Dots at index < currentStep
// jump back to that step; the current dot is a no-op; forward dots are
// disabled because we don't bypass per-step validation. Each dot is a
// real <TouchableOpacity> so screen readers expose the role correctly.
const StepIndicator: React.FC<{
  currentStep: number;
  onJumpTo: (step: number) => void;
}> = ({ currentStep, onJumpTo }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.stepIndicatorRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        let bg = '#D1D5DB';
        if (i < currentStep) bg = TEAL;
        if (i === currentStep) bg = GOLD;
        const canJump = i < currentStep;
        return (
          <TouchableOpacity
            key={i}
            onPress={canJump ? () => onJumpTo(i) : undefined}
            disabled={!canJump}
            activeOpacity={canJump ? 0.6 : 1}
            accessibilityRole={canJump ? 'button' : 'image'}
            accessibilityLabel={t('create_trip.step_jump_label', {
              current: i + 1,
              total: TOTAL_STEPS,
            })}
            // The dot itself is small; expand the hit area so a tap on the
            // gap between dots still lands on the nearest dot.
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          >
            <View style={[styles.stepDot, { backgroundColor: bg }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// B.4 — Inline ⓘ icon next to a section/field label. Tap opens an
// Alert.alert with the explainer, same lightweight pattern used by other
// recent B-bucket screens (gathering, partial, conflict).
const LabelWithInfo: React.FC<{
  label: string;
  tooltipTitle: string;
  tooltipBody: string;
  // Reused inside SectionLabel and FormInput labels.
  variant?: 'section' | 'inline';
}> = ({ label, tooltipTitle, tooltipBody, variant = 'section' }) => {
  const { t } = useTranslation();
  return (
    <View style={[
      styles.labelWithInfoRow,
      variant === 'section' && styles.labelWithInfoRowSection,
    ]}>
      <Text style={variant === 'section' ? styles.sectionLabel : styles.inputLabel}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => Alert.alert(tooltipTitle, tooltipBody, [
          { text: t('create_trip.help_close') },
        ])}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={tooltipTitle}
        style={styles.labelInfoIcon}
      >
        <Ionicons name="information-circle-outline" size={16} color={TEAL} />
      </TouchableOpacity>
    </View>
  );
};

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.sectionLabel}>{label}</Text>
);

const FormInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  // A.1 — optional inline error rendered below the field; the border is
  // tinted red when set so the user can scan the form and spot the
  // remaining required gaps at a glance.
  error?: string;
}> = ({ label, value, onChangeText, placeholder, multiline, keyboardType, error }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[
        styles.textInput,
        multiline && styles.textInputMultiline,
        error ? styles.textInputError : null,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? ''}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      keyboardType={keyboardType}
    />
    {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
  </View>
);

const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}> = ({ label, value, onValueChange }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#D1D5DB', true: TEAL }}
      thumbColor={colors.cardBg}
    />
  </View>
);

// --- Steps ---

const formatDateFriendly = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DatePickerField: React.FC<{
  label: string;
  value: string;
  onChange: (dateStr: string) => void;
  error?: string;
}> = ({ label, value, onChange, error }) => {
  const { t } = useTranslation();
  // Web: the native <input type="date"> emits YYYY-MM-DD verbatim, matching
  // toISODate() on iOS/Android. @react-native-community/datetimepicker has
  // no working web render path in this codebase, so the tap below would do
  // nothing on web without this branch.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          onChange: (e: any) => onChange(e?.target?.value ?? ''),
          style: {
            backgroundColor: colors.cardBg,
            border: `1px solid ${error ? colors.errorText : colors.border}`,
            borderRadius: radius.small,
            padding: `12px ${spacing.md}px`,
            fontSize: typography.body,
            color: NAVY,
            fontFamily: 'inherit',
            width: '100%',
            boxSizing: 'border-box',
            outlineColor: TEAL,
          },
        })}
        {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
      </View>
    );
  }

  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ? new Date(value + 'T00:00:00') : new Date());

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selectedDate) onChange(toISODate(selectedDate));
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    onChange(toISODate(tempDate));
    setShowPicker(false);
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.textInput, error ? styles.textInputError : null]}
        onPress={() => {
          if (value) setTempDate(new Date(value + 'T00:00:00'));
          setShowPicker(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: typography.body, color: value ? NAVY : colors.textSecondary }}>
          {value ? formatDateFriendly(value) : 'Select date'}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
      {/* iOS picker renders in a bottom-sheet Modal so the spinner escapes
          the half-width Start/End Date column it lives in — the column was
          clipping month/day/year columns of the spinner. Modal is a
          top-level overlay, so its content takes the full screen width. */}
      <Modal
        visible={showPicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.datePickerModalBackdrop}>
          <View style={styles.datePickerModalSheet}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.datePickerCancel}>{t("create_trip_wizard.datepicker_cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmIOSDate}>
                <Text style={styles.datePickerDone}>{t("create_trip_wizard.datepicker_done")}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={handleChange}
              style={{ height: 216 }}
              themeVariant="light"
              textColor={NAVY}
            />
          </View>
        </View>
      </Modal>
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
};

/**
 * Invisible HTML <input type="file"> overlay for web. Sized to fill its parent;
 * clicks on the parent pass through and trigger the browser's native file picker.
 * On native platforms this component renders nothing — a TouchableOpacity +
 * ImagePicker handles the tap instead.
 */
const WebFileInputOverlay: React.FC<{
  onFile: (file: File) => void;
  disabled?: boolean;
}> = ({ onFile, disabled }) => {
  if (Platform.OS !== 'web') return null;
  return React.createElement('input', {
    type: 'file',
    accept: 'image/*',
    disabled: !!disabled,
    onChange: (e: any) => {
      const file: File | undefined = e?.target?.files?.[0];
      if (file) {
        console.log('[CoverPhotoField web] file picked', { name: file.name, type: file.type, size: file.size });
        onFile(file);
      }
      // Reset so picking the same file again fires onChange
      if (e?.target) e.target.value = '';
    },
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      zIndex: 10,
    },
  });
};

const CoverPhotoField: React.FC<{
  url: string;
  uploading: boolean;
  onPickNative: () => void;
  onWebFile: (file: File) => void;
}> = ({ url, uploading, onPickNative, onWebFile }) => {
  const { t } = useTranslation();
  const handleNativeTap = () => {
    console.log('[CoverPhotoField native] tap — opening picker', { hasImage: !!url, uploading });
    onPickNative();
  };

  // Defensive cache-buster on the Image URI. We also cache-bust in the upload
  // handler, so the state already carries ?t=... — but if a URL ever arrives
  // without one (e.g. from legacy hydration), stamp it here so the browser
  // doesn't serve a stale cached image.
  const imageUri = React.useMemo(() => {
    if (!url) return '';
    if (/[?&]t=\d/.test(url)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [url]);

  return (
    <View style={styles.coverFieldContainer}>
      <Text style={styles.inputLabel}>{t("create_trip_wizard.label_cover")}</Text>
      <View style={styles.coverFieldButton}>
        {/* Visual content — never intercepts clicks */}
        {url ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.coverFieldImage}
            resizeMode="cover"
            // @ts-expect-error — pointerEvents prop is web-supported on Image
            pointerEvents="none"
          />
        ) : (
          <View style={styles.coverFieldPlaceholder} pointerEvents="none">
            <Ionicons name="camera-outline" size={32} color={TEAL} />
            <Text style={styles.coverFieldPlaceholderText}>{t("create_trip_wizard.cover_add")}</Text>
            <Text style={styles.coverFieldHint}>{t("create_trip_wizard.cover_hint")}</Text>
          </View>
        )}
        {url && (
          <View style={styles.coverFieldOverlay} pointerEvents="none">
            <Ionicons name="camera" size={18} color={colors.cardBg} />
            <Text style={styles.coverFieldOverlayText}>{t("create_trip_wizard.cover_change")}</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.coverFieldUploading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.cardBg} />
            <Text style={styles.coverFieldUploadingText}>Uploading…</Text>
          </View>
        )}

        {/* Tap layer — web uses a transparent <input type="file"> overlay so
            the browser's native picker opens reliably without depending on
            react-native-web's TouchableOpacity onPress translation.
            Native uses a TouchableOpacity + expo-image-picker. */}
        {Platform.OS === 'web' ? (
          <WebFileInputOverlay onFile={onWebFile} disabled={uploading} />
        ) : (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={0.85}
            onPress={handleNativeTap}
            disabled={uploading}
          />
        )}
      </View>
    </View>
  );
};

const StepBasics: React.FC<{
  data: TripFormData;
  update: (partial: Partial<TripFormData>) => void;
  uploadingCover: boolean;
  onPickCoverNative: () => void;
  onWebCoverFile: (file: File) => void;
  errors: Record<string, string>;
}> = ({ data, update, uploadingCover, onPickCoverNative, onWebCoverFile, errors }) => {
  const { t } = useTranslation();
  return (
  <View>
    <CoverPhotoField
      url={data.cover_photo_url}
      uploading={uploadingCover}
      onPickNative={onPickCoverNative}
      onWebFile={onWebCoverFile}
    />
    <SectionLabel label="Trip Details" />
    <FormInput label={t("create_trip_wizard.label_trip_name")} value={data.trip_name} onChangeText={(v) => update({ trip_name: v })} placeholder={t("create_trip_wizard.placeholder_trip_name")} error={errors.trip_name} />
    <FormInput label={t("create_trip_wizard.label_destination")} value={data.destination} onChangeText={(v) => update({ destination: v })} placeholder={t("create_trip_wizard.placeholder_destination")} error={errors.destination} />
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <DatePickerField label="Start Date" value={data.start_date} onChange={(v) => update({ start_date: v })} error={errors.start_date} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <DatePickerField label="End Date" value={data.end_date} onChange={(v) => update({ end_date: v })} error={errors.end_date} />
      </View>
    </View>
    <FormInput label={t("create_trip_wizard.label_max_participants")} value={data.max_participants} onChangeText={(v) => update({ max_participants: v })} placeholder={t("create_trip_wizard.placeholder_max_participants")} keyboardType="numeric" error={errors.max_participants} />
    <FormInput label={t("create_trip_wizard.label_tagline")} value={data.tagline} onChangeText={(v) => update({ tagline: v })} placeholder={t("create_trip_wizard.placeholder_tagline")} />
    <FormInput label={t("create_trip_wizard.label_description")} value={data.description} onChangeText={(v) => update({ description: v })} placeholder={t("create_trip_wizard.placeholder_description")} multiline />
    <FormInput label={t("create_trip_wizard.label_whats_included")} value={data.whats_included} onChangeText={(v) => update({ whats_included: v })} placeholder={t("create_trip_wizard.placeholder_whats_included")} multiline />
    <FormInput label={t("create_trip_wizard.label_whats_excluded")} value={data.whats_excluded} onChangeText={(v) => update({ whats_excluded: v })} placeholder={t("create_trip_wizard.placeholder_whats_excluded")} multiline />
  </View>
  );
};

/**
 * Generate the JSONB installment_schedule envelope from cadence + count +
 * total (price - deposit, in cents). Anchor (b): the LAST installment falls
 * one day before start_date, and earlier installments step BACKWARDS by the
 * cadence — so payment is always complete before the trip starts. Any date
 * that would land in the past is clamped to today (preserves the count + the
 * last-before-trip anchor; just compresses the early payments). With no
 * start_date set, falls back to forward stepping from today.
 */
function generateInstallmentSchedule(opts: {
  cadence: PaymentFrequency;
  count: number;
  totalCents: number;
  startDate?: string | null;
}): InstallmentSchedule {
  const { cadence, count, totalCents, startDate } = opts;
  if (count <= 0 || totalCents <= 0) {
    return { cadence, count: 0, installments: [] };
  }
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const amounts = Array.from({ length: count }, (_, i) =>
    i === count - 1 ? baseCents + remainder : baseCents
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stepDate = (d: Date, dir: -1 | 1) => {
    if (cadence === 'monthly') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * (cadence === 'biweekly' ? 14 : 7));
  };

  const dueDates: Date[] = new Array(count);
  if (startDate) {
    const last = new Date(startDate + 'T00:00:00');
    last.setDate(last.getDate() - 1);
    dueDates[count - 1] = last;
    for (let i = count - 2; i >= 0; i--) {
      const prev = new Date(dueDates[i + 1]);
      stepDate(prev, -1);
      dueDates[i] = prev;
    }
    for (let i = 0; i < count; i++) {
      if (dueDates[i].getTime() < today.getTime()) dueDates[i] = new Date(today);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const due = new Date(today);
      if (cadence === 'monthly') due.setMonth(due.getMonth() + i);
      else due.setDate(due.getDate() + i * (cadence === 'biweekly' ? 14 : 7));
      dueDates[i] = due;
    }
  }

  return {
    cadence,
    count,
    installments: dueDates.map((d, i) => ({
      due_date: d.toISOString().split('T')[0],
      amount_cents: amounts[i],
    })),
  };
}

const INSTALLMENT_COUNT_OPTIONS = [3, 4, 6, 12] as const;
const FREQUENCY_OPTIONS: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const StepPayment: React.FC<{
  data: TripFormData;
  update: (partial: Partial<TripFormData>) => void;
  errors: Record<string, string>;
}> = ({ data, update, errors }) => {
  const { t } = useTranslation();
  const [showPolicyPicker, setShowPolicyPicker] = useState(false);
  // A.3 — "No refunds" forces cutoff to 0 (semantic: no window matters); any
  // other policy keeps the user's input. The hint flips to a soft note in
  // the no-refunds case so the field doesn't look like a leftover.
  const refundIsNone = mapRefundPolicyToDB(data.refund_policy) === 'none';

  // Live preview values for the installment plan (when applicable).
  const previewPrice = parseFloat(data.price_per_person) || 0;
  const previewDeposit = data.deposit_required
    ? parseFloat(data.deposit_amount) || 0
    : 0;
  const previewTotal = Math.max(0, previewPrice - previewDeposit);
  const previewPer =
    data.installment_count > 0 ? previewTotal / data.installment_count : 0;
  const previewFreqLabel =
    data.payment_frequency === 'biweekly' ? 'bi-weekly' : data.payment_frequency;

  return (
    <View>
      {/* B.4 — Pricing section header gains an ⓘ tooltip. */}
      <LabelWithInfo
        label={t('create_trip_wizard.section_pricing')}
        tooltipTitle={t('create_trip_wizard.section_pricing')}
        tooltipBody={t('create_trip.tooltip_price')}
      />
      <FormInput label="Price Per Person ($)" value={data.price_per_person} onChangeText={(v) => update({ price_per_person: v })} placeholder="1800" keyboardType="numeric" error={errors.price_per_person} />

      <SectionLabel label="Payment Type" />
      <View style={styles.toggleButtonRow}>
        <TouchableOpacity
          style={[styles.toggleButton, data.payment_type === 'lump_sum' && styles.toggleButtonActive]}
          onPress={() => update({ payment_type: 'lump_sum' })}
        >
          <Text style={[styles.toggleButtonText, data.payment_type === 'lump_sum' && styles.toggleButtonTextActive]}>{t("final_polish.createtripwizard_lump_sum")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, data.payment_type === 'installments' && styles.toggleButtonActive]}
          onPress={() => update({ payment_type: 'installments' })}
        >
          <Text style={[styles.toggleButtonText, data.payment_type === 'installments' && styles.toggleButtonTextActive]}>{t("final_polish.createtripwizard_installments")}</Text>
        </TouchableOpacity>
      </View>

      {data.payment_type === 'installments' && (
        <>
          <SectionLabel label="Payment Frequency" />
          <View style={styles.toggleButtonRow}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.toggleButton,
                  data.payment_frequency === opt.value && styles.toggleButtonActive,
                ]}
                onPress={() => update({ payment_frequency: opt.value })}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    data.payment_frequency === opt.value && styles.toggleButtonTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionLabel label="Number of Installments" />
          <View style={styles.toggleButtonRow}>
            {INSTALLMENT_COUNT_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.toggleButton,
                  data.installment_count === n && styles.toggleButtonActive,
                ]}
                onPress={() => update({ installment_count: n })}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    data.installment_count === n && styles.toggleButtonTextActive,
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {previewTotal > 0 && data.installment_count > 0 && (
            <View style={styles.installmentPreview}>
              <Text style={styles.installmentPreviewText}>
                {data.installment_count} {previewFreqLabel} payments of $
                {previewPer.toFixed(2)}
                {data.start_date ? ' — last due before trip starts' : ''}
              </Text>
            </View>
          )}
        </>
      )}

      {/* B.4 — Deposit tooltip rendered above the toggle row. */}
      <LabelWithInfo
        label={t('create_trip_wizard.section_deposit')}
        tooltipTitle={t('create_trip_wizard.section_deposit')}
        tooltipBody={t('create_trip.tooltip_deposit')}
      />
      <ToggleRow label="Deposit Required" value={data.deposit_required} onValueChange={(v) => update({ deposit_required: v })} />
      {data.deposit_required && (
        <FormInput label="Deposit Amount ($)" value={data.deposit_amount} onChangeText={(v) => update({ deposit_amount: v })} placeholder="300" keyboardType="numeric" error={errors.deposit_amount} />
      )}

      {/* B.4 — Refund policy tooltip. */}
      <LabelWithInfo
        label={t('create_trip_wizard.section_refund_policy')}
        tooltipTitle={t('create_trip_wizard.section_refund_policy')}
        tooltipBody={t('create_trip.tooltip_refund')}
      />
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowPolicyPicker(!showPolicyPicker)}>
        <Text style={[styles.dropdownBtnText, !data.refund_policy && { color: colors.textSecondary }]}>
          {data.refund_policy || 'Select refund policy'}
        </Text>
        <Ionicons name={showPolicyPicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      {showPolicyPicker && (
        <View style={styles.dropdownList}>
          {REFUND_POLICIES.map((policy) => (
            <TouchableOpacity
              key={policy}
              style={styles.dropdownItem}
              onPress={() => {
                // A.3 — flipping to "No refunds" zeroes the cutoff so the
                // saved row stays self-consistent. Other selections keep
                // whatever cutoff the organizer already typed.
                const nextCutoff = policy === 'No refunds' ? '0' : data.refund_cutoff_days;
                update({ refund_policy: policy, refund_cutoff_days: nextCutoff });
                setShowPolicyPicker(false);
              }}
            >
              <Text style={[styles.dropdownItemText, data.refund_policy === policy && { color: TEAL, fontWeight: typography.semibold }]}>
                {policy}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* A.3 — refund cutoff days. Hidden when "No refunds" picked (the
          stored value stays at '0' so the DB column reflects the choice). */}
      {data.refund_policy && !refundIsNone && (
        <View style={{ marginTop: spacing.md }}>
          <FormInput
            label={t("create_trip_wizard.label_refund_cutoff")}
            value={data.refund_cutoff_days}
            onChangeText={(v) => update({ refund_cutoff_days: v.replace(/[^0-9]/g, '') })}
            placeholder={t("create_trip_wizard.placeholder_refund_cutoff")}
            keyboardType="numeric"
            error={errors.refund_cutoff_days}
          />
          <Text style={styles.refundCutoffHint}>
            {t("create_trip_wizard.hint_refund_cutoff")}
          </Text>
        </View>
      )}
      {data.refund_policy && refundIsNone && (
        <Text style={styles.refundCutoffHint}>
          {t("create_trip_wizard.hint_refund_cutoff_none")}
        </Text>
      )}
    </View>
  );
};

const StepRequirements: React.FC<{
  data: TripFormData;
  update: (partial: Partial<TripFormData>) => void;
}> = ({ data, update }) => {
  const { t } = useTranslation();
  const [newField, setNewField] = useState('');

  const toggleRequirement = (id: string) => {
    const updated = data.requirements.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    update({ requirements: updated });
  };

  const addCustom = () => {
    if (!newField.trim()) return;
    update({
      custom_requirements: [...data.custom_requirements, newField.trim()],
    });
    setNewField('');
  };

  return (
    <View>
      {/* B.4 — Requirements section tooltip. */}
      <LabelWithInfo
        label={t('create_trip_wizard.section_requirements')}
        tooltipTitle={t('create_trip_wizard.section_requirements')}
        tooltipBody={t('create_trip.tooltip_requirements')}
      />
      {data.requirements.map((req) => (
        <TouchableOpacity key={req.id} style={styles.checkRow} onPress={() => toggleRequirement(req.id)}>
          <Ionicons
            name={req.enabled ? 'checkbox' : 'square-outline'}
            size={24}
            color={req.enabled ? TEAL : '#D1D5DB'}
          />
          <Text style={styles.checkLabel}>{req.label}</Text>
        </TouchableOpacity>
      ))}

      {data.custom_requirements.length > 0 && (
        <>
          <SectionLabel label="Custom Fields" />
          {data.custom_requirements.map((field, idx) => (
            <View key={idx} style={styles.checkRow}>
              <Ionicons name="checkbox" size={24} color={TEAL} />
              <Text style={styles.checkLabel}>{field}</Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.addCustomRow}>
        <TextInput
          style={styles.addCustomInput}
          value={newField}
          onChangeText={setNewField}
          placeholder={t("create_trip_wizard.placeholder_custom_field")}
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity style={styles.addCustomBtn} onPress={addCustom}>
          <Ionicons name="add" size={20} color={colors.cardBg} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const StepItinerary: React.FC<{ tripId?: string }> = ({ tripId }) => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.centeredStep}>
      <Ionicons name="map-outline" size={64} color={TEAL} />
      <Text style={styles.centeredTitle}>{t("create_trip_wizard.centered_title")}</Text>
      <Text style={styles.centeredSubtitle}>
        Create a day-by-day plan with activities, locations, and times for your participants.
      </Text>
      <TouchableOpacity
        style={styles.itineraryBtn}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ItineraryBuilder', { tripId: tripId ?? 'new' })}
      >
        <Ionicons name="construct-outline" size={20} color={colors.cardBg} style={{ marginRight: 8 }} />
        <Text style={styles.itineraryBtnText}>{t("create_trip_wizard.btn_continue_itinerary")}</Text>
      </TouchableOpacity>
    </View>
  );
};

const StepCommunication: React.FC<{
  data: TripFormData;
  update: (partial: Partial<TripFormData>) => void;
}> = ({ data, update }) => (
  <View>
    <SectionLabel label="Messaging" />
    <ToggleRow label="Enable group messaging" value={data.messaging_mode} onValueChange={(v) => update({ messaging_mode: v })} />

    <SectionLabel label="Reminders" />
    <ToggleRow label="Auto reminders for payments & docs" value={data.auto_reminders} onValueChange={(v) => update({ auto_reminders: v })} />

    <SectionLabel label="Notifications" />
    <TouchableOpacity style={styles.checkRow} onPress={() => update({ notify_payment: !data.notify_payment })}>
      <Ionicons name={data.notify_payment ? 'checkbox' : 'square-outline'} size={24} color={data.notify_payment ? TEAL : '#D1D5DB'} />
      <Text style={styles.checkLabel}>{t("create_trip_wizard.check_payment_received")}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={() => update({ notify_docs: !data.notify_docs })}>
      <Ionicons name={data.notify_docs ? 'checkbox' : 'square-outline'} size={24} color={data.notify_docs ? TEAL : '#D1D5DB'} />
      <Text style={styles.checkLabel}>{t("create_trip_wizard.check_document_uploaded")}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={() => update({ notify_itinerary: !data.notify_itinerary })}>
      <Ionicons name={data.notify_itinerary ? 'checkbox' : 'square-outline'} size={24} color={data.notify_itinerary ? TEAL : '#D1D5DB'} />
      <Text style={styles.checkLabel}>{t("create_trip_wizard.check_itinerary_changes")}</Text>
    </TouchableOpacity>
  </View>
);

const StepReview: React.FC<{
  data: TripFormData;
  onPublish: () => void;
  onSaveDraft: () => void;
  isEditMode?: boolean;
}> = ({ data, onPublish, onSaveDraft, isEditMode }) => {
  const { t } = useTranslation();
  const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || '—'}</Text>
    </View>
  );

  const enabledReqs = data.requirements.filter((r) => r.enabled);
  const basicsComplete = !!(data.trip_name && data.destination && data.start_date && data.end_date);
  const paymentComplete = !!(data.price_per_person);
  const requirementsComplete = enabledReqs.length > 0 || data.custom_requirements.length > 0;

  return (
    <View>
      <Text style={styles.reviewHeading}>{t("create_trip_wizard.review_heading")}</Text>
      <Text style={styles.reviewSubheading}>Step 4 of 4 — Review before going live</Text>

      {/* B.5 — "Shareable preview" label sits above the summary card so the
          user understands the card is a mock of what their share URL will
          render. Updates live as they edit other steps. */}
      <Text style={styles.shareablePreviewLabel}>
        {t('create_trip.review_shareable_preview')}
      </Text>

      {/* Summary card — Bucket B.5 doubles as the shareable-page mock. */}
      <View style={styles.reviewCard}>
        {/* B.5 — Cover thumbnail when set, otherwise a placeholder strip.
            Mirrors what TripPublicPage will show at the top of its hero. */}
        {data.cover_photo_url ? (
          <Image
            source={{ uri: data.cover_photo_url }}
            style={styles.shareablePreviewCover}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.shareablePreviewCover, styles.shareablePreviewCoverPlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewTripName}>✈️ {data.trip_name || 'Untitled Trip'}</Text>
          <View style={styles.reviewDraftPill}>
            <Text style={styles.reviewDraftPillText}>{t("create_trip_wizard.review_draft_pill")}</Text>
          </View>
        </View>
        <Text style={styles.reviewTripMeta}>
          {data.destination}{data.start_date ? ` · ${formatDateFriendly(data.start_date)}` : ''}{data.end_date ? ` – ${formatDateFriendly(data.end_date)}` : ''} · {data.max_participants || '?'} spots · ${data.price_per_person || '?'}/person
        </Text>
        <View style={styles.reviewMetaRow}>
          {data.deposit_required && <Text style={styles.reviewMetaItem}>Deposit: ${data.deposit_amount}</Text>}
          {data.payment_type === 'installments' && <Text style={styles.reviewMetaItem}>{t("create_trip_wizard.review_installments")}</Text>}
          <Text style={styles.reviewMetaItem}>{enabledReqs.length + data.custom_requirements.length} requirements</Text>
        </View>
      </View>

      {/* B.5 — Add-itinerary hint. The existing itinerary alert below
          fires when the trip ships with no day-by-day plan, but is fairly
          terse; this richer line explicitly tells the organizer they can
          add the itinerary post-publish from the dashboard. */}
      <Text style={styles.addItineraryHint}>
        {t('create_trip.review_add_itinerary_hint')}
      </Text>

      {/* Itinerary not built alert */}
      <View style={styles.itineraryAlert}>
        <Ionicons name="alert-circle" size={18} color={GOLD} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itineraryAlertTitle}>{t("create_trip_wizard.itinerary_alert_title")}</Text>
          <Text style={styles.itineraryAlertText}>
            You can publish now and build the itinerary after. Your trip page will show "Itinerary coming soon."
          </Text>
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.reviewChecklist}>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={basicsComplete ? 'checkbox' : 'square-outline'} size={20} color={basicsComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, basicsComplete && styles.reviewCheckDone]}>{t("create_trip_wizard.review_check_basics")}</Text>
        </View>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={paymentComplete ? 'checkbox' : 'square-outline'} size={20} color={paymentComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, paymentComplete && styles.reviewCheckDone]}>{t("create_trip_wizard.review_check_payment")}</Text>
        </View>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={requirementsComplete ? 'checkbox' : 'square-outline'} size={20} color={requirementsComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, requirementsComplete && styles.reviewCheckDone]}>{t("create_trip_wizard.review_check_requirements")}</Text>
        </View>
        <View style={styles.reviewCheckRow}>
          <Ionicons name="square-outline" size={20} color="#D1D5DB" />
          <Text style={[styles.reviewCheckLabel, { color: colors.textSecondary }]}>Itinerary — optional at launch</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.publishBtn} activeOpacity={0.7} onPress={onPublish}>
        <Ionicons
          name={isEditMode ? 'save-outline' : 'rocket-outline'}
          size={20}
          color={colors.cardBg}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.publishBtnText}>{isEditMode ? 'Save Changes' : 'Publish Trip'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveDraftReviewBtn} activeOpacity={0.7} onPress={onSaveDraft}>
        <Text style={styles.saveDraftReviewText}>{t("create_trip_wizard.btn_save_draft_review")}</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Main Screen ---

const CreateTripWizardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const wizard = useCreateTripWizard();
  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // C.4 — telemetry. Fire-and-forget through useEventTracker, same pattern
  // as CreateGatheringScreen (HG Bucket C.4). One-shot screen_viewed via
  // a ref so re-renders don't double-fire.
  const { track } = useEventTracker();
  const screenViewedFiredRef = useRef(false);
  useEffect(() => {
    if (screenViewedFiredRef.current) return;
    screenViewedFiredRef.current = true;
    track({
      eventType: 'trip_wizard.screen_viewed',
      eventCategory: 'trip' as any,
      eventAction: 'viewed',
      eventLabel: route.params?.mode === 'edit' ? 'edit' : 'create',
    });
  }, [track, route.params?.mode]);
  // Fire step_viewed whenever currentStep changes. Skipping the initial
  // render is a deliberate non-goal — Step 0 is itself a step view.
  useEffect(() => {
    track({
      eventType: 'trip_wizard.step_viewed',
      eventCategory: 'trip' as any,
      eventAction: 'step_viewed',
      eventValue: { step: currentStep },
    });
  }, [currentStep, track]);

  const { offset: keyboardOffset, measure: measureChrome, clear: clearChrome } = useFormKeyboardOffset();

  // Edit mode: /CreateTripWizard?tripId=...&mode=edit
  const editTripId: string | undefined = route.params?.tripId;
  const isEditMode: boolean = route.params?.mode === 'edit' && !!editTripId;
  const [hydrating, setHydrating] = useState<boolean>(isEditMode);

  // Drop the banner's measured height once it unmounts; otherwise the offset
  // stays inflated and produces an empty band above the keyboard.
  useEffect(() => {
    if (!hydrating) clearChrome('banner');
  }, [hydrating, clearChrome]);

  // One-time render-side log (helps debug edit-mode issues on web).
  // Safe: runs on every render but logs are cheap and the console stays quiet
  // in production because this only fires when params change.
  React.useEffect(() => {
    console.log('[CreateTripWizard] mount params', {
      params: route.params,
      editTripId,
      isEditMode,
    });
  }, [route.params, editTripId, isEditMode]);

  const [formData, setFormData] = useState<TripFormData>({
    cover_photo_url: '',
    trip_name: '',
    destination: '',
    start_date: '',
    end_date: '',
    max_participants: '',
    tagline: '',
    description: '',
    whats_included: '',
    whats_excluded: '',
    price_per_person: '',
    payment_type: 'lump_sum',
    payment_frequency: 'monthly',
    installment_count: 4,
    deposit_required: false,
    deposit_amount: '',
    refund_policy: '',
    refund_cutoff_days: '7',
    requirements: [...DEFAULT_REQUIREMENTS],
    custom_requirements: [],
    messaging_mode: true,
    auto_reminders: true,
    notify_payment: true,
    notify_docs: true,
    notify_itinerary: false,
  });

  // A.1 — inline per-field error map, keyed by form field name. Cleared
  // when the user edits the field so corrections are visible immediately
  // without a re-press of Publish.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // B.1 — HelpSheet visibility.
  const [helpOpen, setHelpOpen] = useState(false);

  // B.2 — Coach mark. Gated on:
  //   • not in edit mode (organizer already knows the wizard),
  //   • not currently restoring a server-side draft (the restore banner
  //     handles that surface and a second banner would clutter Step 0),
  //   • AsyncStorage hasn't seen the key.
  // Once visible, auto-dismisses after 4 s and on tap.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    // Wait until the hydration phase has settled — coach during a loading
    // banner would land at the same time as the spinner.
    if (hydrating) return;
    coachCheckedRef.current = true;
    // Edit-mode users have already seen the wizard once; the coach mark
    // is for first-time creators only.
    if (isEditMode) return;
    // If a local form-draft restore banner is on screen and not yet
    // dismissed, defer the coach mark — they'd compete for attention.
    // The user can re-trigger it via the (?) icon anyway.
    if (hasStoredFormState && !bannerDismissed) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_MARK_KEY);
        if (!cancelled && !seen) setCoachVisible(true);
      } catch {
        // AsyncStorage failure → treat as seen, don't block.
      }
    })();
    return () => { cancelled = true; };
  });
  const dismissCoach = useCallback(() => {
    setCoachVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, '1').catch(() => undefined);
    // C.4 — fires for both tap-dismiss and 4s auto-dismiss.
    track({
      eventType: 'trip_wizard.coach_dismissed',
      eventCategory: 'trip' as any,
      eventAction: 'coach_dismissed',
    });
  }, [track]);
  useEffect(() => {
    if (!coachVisible) return;
    const id = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(id);
  }, [coachVisible, dismissCoach]);

  const updateForm = (partial: Partial<TripFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
    // Clear any errors targeting fields the user just touched.
    const touched = Object.keys(partial);
    if (touched.length > 0) {
      setFieldErrors((prev) => {
        if (!touched.some((k) => prev[k])) return prev;
        const next = { ...prev };
        for (const k of touched) delete next[k];
        return next;
      });
    }
  };

  // Run all required-field + range checks. Returns the populated error
  // map; an empty object means "ready to publish". i18n keys are scoped
  // under create_trip_wizard.* so the strings flow EN/FR.
  const validateForPublish = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const required = t('create_trip_wizard.validation_required_field');
    if (!formData.trip_name?.trim()) errs.trip_name = required;
    if (!formData.destination?.trim()) errs.destination = required;
    if (!formData.start_date) {
      errs.start_date = t('create_trip_wizard.validation_invalid_date');
    }
    if (!formData.end_date) {
      errs.end_date = t('create_trip_wizard.validation_invalid_date');
    }
    // Cross-field: end on or after start. Only check if both parse — the
    // single-field checks above already flag missing values.
    if (formData.start_date && formData.end_date) {
      const s = new Date(formData.start_date + 'T00:00:00').getTime();
      const e = new Date(formData.end_date + 'T00:00:00').getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
        errs.end_date = t('create_trip_wizard.validation_end_before_start');
      }
    }
    const maxN = parseInt(formData.max_participants, 10);
    if (!formData.max_participants || !Number.isFinite(maxN) || maxN <= 0) {
      errs.max_participants = t('create_trip_wizard.validation_max_participants');
    }
    const priceN = parseFloat(formData.price_per_person);
    if (!formData.price_per_person || !Number.isFinite(priceN) || priceN <= 0) {
      errs.price_per_person = t('create_trip_wizard.validation_price');
    }
    if (formData.deposit_required) {
      const dep = parseFloat(formData.deposit_amount);
      if (!formData.deposit_amount || !Number.isFinite(dep) || dep <= 0) {
        errs.deposit_amount = t('create_trip_wizard.validation_required_field');
      } else if (Number.isFinite(priceN) && dep > priceN) {
        errs.deposit_amount = t('create_trip_wizard.validation_deposit_exceeds_price');
      }
    }
    // Cutoff is only meaningful when refunds are offered; we still allow
    // 0 as a valid value (= no grace window). Anything non-integer is bad.
    if (formData.refund_policy && mapRefundPolicyToDB(formData.refund_policy) !== 'none') {
      const cutoffN = parseInt(formData.refund_cutoff_days, 10);
      if (formData.refund_cutoff_days !== '' && (!Number.isFinite(cutoffN) || cutoffN < 0)) {
        errs.refund_cutoff_days = t('create_trip_wizard.validation_refund_cutoff');
      }
    }
    return errs;
  };

  // ── Local form draft persistence ────────────────────────────────────────
  // Per-trip key (edit mode → `trip-wizard-${editTripId}`; create mode →
  // `trip-wizard-new`). Aliased destructure to avoid colliding with the
  // existing local `saveDraft` function below (which writes to the DB).
  const draftKey = `${TRIP_DRAFT_KEY}-${editTripId ?? 'new'}`;
  const {
    saveDraft: persistFormState,
    restoreDraft: getStoredFormState,
    clearDraft: clearStoredFormState,
    hasDraft: hasStoredFormState,
  } = useFormDraft<TripDraft>(draftKey, {
    ...formData,
    currentStep: 0,
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // CRITICAL: gate autosave to prevent the edit-mode fetch hydration from
  // clobbering a pre-existing draft. Without this, the sequence
  //   (1) mount with prior draft in AsyncStorage,
  //   (2) fetch completes → setFormData(fetched),
  //   (3) autosave effect fires with fetched values,
  // overwrites the user's unsaved draft with the freshly fetched DB row
  // BEFORE they can click Restore. The gate flips on after the user has
  // dismissed the banner (Restore or Discard) OR after we've confirmed no
  // draft exists.
  const canAutoSave = !hydrating && (bannerDismissed || !hasStoredFormState);

  // Debounced save on every change, once the gate is open.
  useEffect(() => {
    if (!canAutoSave) return;
    persistFormState({ ...formData, currentStep });
  }, [formData, currentStep, canAutoSave, persistFormState]);

  const handleRestoreDraft = () => {
    const d = getStoredFormState();
    if (d) {
      // Drop currentStep from the form spread so we don't accidentally
      // set it as a form field; it's restored via setCurrentStep below.
      const { currentStep: savedStep, ...formFields } = d;
      setFormData(formFields as TripFormData);
      // Clamp restored step to a valid range in case the wizard layout
      // ever shrinks. Min 0, max TOTAL_STEPS - 1.
      const clampedStep = Math.max(0, Math.min(TOTAL_STEPS - 1, savedStep ?? 0));
      setCurrentStep(clampedStep);
    }
    setBannerDismissed(true);
  };

  const handleDiscardDraft = () => {
    clearStoredFormState();
    setBannerDismissed(true);
  };
  // ────────────────────────────────────────────────────────────────────────

  // ── Cover photo picker ─────────────────────────────────────────────────
  const [uploadingCover, setUploadingCover] = useState(false);

  // Shared upload step used by both web and native paths.
  const uploadCoverAndSave = async (file: { uri: string; type: string; name: string }) => {
    try {
      console.log('[CreateTripWizard] uploading cover', { tripId: editTripId, name: file.name, type: file.type });
      setUploadingCover(true);
      const res = await MediaUploadService.uploadTripCover(file, editTripId);
      setUploadingCover(false);
      if (!res.success || !res.url) {
        console.error('[CreateTripWizard] cover upload failed', res.error);
        Alert.alert(t('create_trip_wizard.alert_upload_failed_title'), res.error ?? t('create_trip_wizard.alert_upload_failed_default'));
        return;
      }
      // The upload path is deterministic ({userId}/{tripId}-cover.jpg with
      // upsert:true), so successive uploads return the *same* res.url. That
      // means updateForm({cover_photo_url: res.url}) sees no state change and
      // skips the re-render, so the preview keeps showing the old photo.
      // Append a timestamp to (a) make the string different on each upload so
      // React re-renders, and (b) bust the browser's HTTP cache for the
      // stale image at that URL.
      const cacheBustedUrl = `${res.url}${res.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      console.log('[CreateTripWizard] cover uploaded', cacheBustedUrl);
      updateForm({ cover_photo_url: cacheBustedUrl });
    } catch (err: any) {
      setUploadingCover(false);
      console.error('[CreateTripWizard] upload error', err);
      Alert.alert(t('create_trip_wizard.alert_could_not_upload_title'), err?.message ?? t('create_trip_wizard.alert_unknown_error'));
    }
  };

  // Web: file arrived directly from the <input type="file"> onChange event.
  // Wrap it in a blob: URL and hand off to the shared upload routine, which
  // will fetch() the blob back out of the URL and push it to Supabase.
  const handleWebCoverFile = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      await uploadCoverAndSave({
        uri: objectUrl,
        type: file.type || 'image/jpeg',
        name: file.name || 'cover.jpg',
      });
    } finally {
      // Safe to revoke now — the upload already fetched the blob.
      try { URL.revokeObjectURL(objectUrl); } catch {}
    }
  };

  // Native: request permission, launch ImagePicker, then upload.
  const pickCoverPhotoNative = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('create_trip_wizard.alert_permission_title'),
          t('create_trip_wizard.alert_permission_body')
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadCoverAndSave({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'cover.jpg',
      });
    } catch (err: any) {
      setUploadingCover(false);
      console.error('[CreateTripWizard] pickCoverPhotoNative error', err);
      Alert.alert(t('create_trip_wizard.alert_could_not_pick_title'), err?.message ?? t('create_trip_wizard.alert_unknown_error'));
    }
  };

  // Edit mode: load the existing trip and hydrate the wizard form
  useEffect(() => {
    if (!isEditMode || !editTripId) return;
    let cancelled = false;
    (async () => {
      try {
        console.log('[CreateTripWizard] hydrating start', editTripId);
        const dashboard = await TripOrganizerEngine.getTripDashboard(editTripId);
        if (cancelled) return;
        const trip = dashboard.trip;
        if (!trip) throw new Error('Trip not found.');
        console.log('[CreateTripWizard] hydrating got trip', trip.id, trip.name);
        // Map the saved requiredDocuments back to the checklist state.
        // Default keys come on/off based on whether they're present;
        // any unknown fieldKey becomes a custom requirement.
        const savedDocs: Array<{ fieldKey?: string; label?: string }> =
          ((trip as any).requiredDocuments ?? []) as any[];
        const savedKeys = new Set(savedDocs.map((d) => d?.fieldKey ?? ''));
        const hydratedRequirements = DEFAULT_REQUIREMENTS.map((r) => ({
          ...r,
          enabled: savedKeys.has(r.id),
        }));
        const defaultKeySet = new Set(DEFAULT_REQUIREMENTS.map((r) => r.id));
        const hydratedCustom = savedDocs
          .filter((d) => d?.fieldKey && !defaultKeySet.has(d.fieldKey))
          .map((d) => d.label ?? d.fieldKey ?? '')
          .filter(Boolean);

        setFormData((prev) => ({
          ...prev,
          cover_photo_url: (trip as any).coverPhotoUrl ?? '',
          trip_name: trip.name ?? '',
          destination: trip.destination ?? '',
          start_date: trip.startDate ?? '',
          end_date: trip.endDate ?? '',
          max_participants: trip.maxParticipants ? String(trip.maxParticipants) : '',
          tagline: (trip as any).tagline ?? '',
          description: (trip as any).description ?? '',
          whats_included: (trip as any).whatsIncluded ?? '',
          whats_excluded: (trip as any).whatsExcluded ?? '',
          price_per_person: trip.priceCents ? String(trip.priceCents) : '',
          payment_type: ((trip as any).paymentType === 'installments' ? 'installments' : 'lump_sum'),
          payment_frequency: ((trip as any).paymentFrequency as PaymentFrequency) ?? 'monthly',
          installment_count: (trip as any).installmentCount ?? 4,
          deposit_required: !!(trip as any).depositCents,
          deposit_amount: (trip as any).depositCents ? String((trip as any).depositCents) : '',
          refund_policy: mapRefundPolicyFromDB((trip as any).refundPolicy),
          // Hydrate cutoff from the DB. Falls back to '' (placeholder shows)
          // when null; the existing default value of '7' only seeds new trips.
          refund_cutoff_days: (trip as any).refundCutoffDays != null
            ? String((trip as any).refundCutoffDays)
            : '',
          messaging_mode: (trip as any).messagingMode !== 'organizer_only',
          requirements: hydratedRequirements,
          custom_requirements: hydratedCustom,
        }));
        // Pre-seed the hook so saveDraft performs an update (not a create)
        wizard?.initEditMode?.(editTripId, trip);
      } catch (err: any) {
        console.warn('[CreateTripWizard] Hydrate edit-mode error:', err);
        Alert.alert(t('create_trip_wizard.alert_could_not_load_title'), err?.message ?? t('create_trip_wizard.alert_please_try_again'));
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  // We intentionally run this once per tripId; wizard identity is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editTripId]);

  const goNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      // C.4 — step_completed fires the moment the user advances. The
      // value carried is the step that was just completed (not the next
      // one), so funnel charts read naturally as "step 0 completed → ...".
      track({
        eventType: 'trip_wizard.step_completed',
        eventCategory: 'trip' as any,
        eventAction: 'step_completed',
        eventValue: { step: currentStep },
      });
      setCurrentStep((s) => s + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      navigation.goBack();
    }
  };

  // Convert the wizard's snake_case form state into the camelCase Trip shape
  // that TripOrganizerEngine.createTrip / updateTrip expect.
  const buildTripData = () => {
    // Serialize the requirements checklist + custom fields into the shape
    // the Trip.requiredDocuments column expects: [{ fieldKey, fieldType, label }]
    const requiredDocuments = [
      ...formData.requirements
        .filter((r) => r.enabled)
        .map((r) => ({ fieldKey: r.id, fieldType: 'boolean', label: r.label })),
      ...formData.custom_requirements.map((label, idx) => ({
        fieldKey: `custom_${idx}`,
        fieldType: 'text',
        label,
      })),
    ];

    return {
      name: formData.trip_name,
      destination: formData.destination,
      coverPhotoUrl: formData.cover_photo_url || null,
      startDate: formData.start_date,
      endDate: formData.end_date,
      maxParticipants: formData.max_participants ? parseInt(formData.max_participants) : 20,
      tagline: formData.tagline || null,
      description: formData.description || null,
      whatsIncluded: formData.whats_included || null,
      whatsExcluded: formData.whats_excluded || null,
      priceCents: formData.price_per_person ? parseFloat(formData.price_per_person) : 0,
      paymentType: formData.payment_type,
      // Lump sum → null (engine writes [] to clear). Installments → generated
      // envelope based on cadence + count + (price - deposit), anchored so the
      // last installment is due 1 day before start_date when start_date is set.
      installmentSchedule:
        formData.payment_type === 'installments'
          ? generateInstallmentSchedule({
              cadence: formData.payment_frequency,
              count: formData.installment_count,
              totalCents: Math.round(
                Math.max(
                  0,
                  (parseFloat(formData.price_per_person) || 0) -
                    (formData.deposit_required
                      ? parseFloat(formData.deposit_amount) || 0
                      : 0)
                ) * 100
              ),
              startDate: formData.start_date || null,
            })
          : null,
      depositCents: formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0,
      refundPolicy: mapRefundPolicyToDB(formData.refund_policy),
      // A.3 — persist refund_cutoff_days (already a column on trips). Empty
      // input or a non-numeric blob both serialize to null so the DB CHECK
      // (>=0) is never violated.
      refundCutoffDays: (() => {
        const n = parseInt(formData.refund_cutoff_days, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
      })(),
      messagingMode: formData.messaging_mode ? 'group' : 'organizer_only',
      requiredDocuments,
    } as any;
  };

  const saveDraft = async () => {
    try {
      if (!formData.trip_name?.trim()) {
        Alert.alert('Trip name required', 'Please enter a trip name before saving as a draft.');
        return;
      }
      const tripData = buildTripData();
      console.log('[CreateTripWizard] saveDraft pressed', {
        isEditMode,
        editTripId,
        hasWizard: !!wizard,
        hasSaveDraft: !!wizard?.saveDraft,
      });

      // Edit mode: call updateTrip directly so we don't depend on the
      // hook's internal savedTripId state (which may not have settled yet).
      if (isEditMode && editTripId) {
        console.log('[CreateTripWizard] edit-mode saveDraft → updateTrip start');
        await TripOrganizerEngine.updateTrip(editTripId, tripData);
        console.log('[CreateTripWizard] edit-mode saveDraft → updateTrip done');
        // C.4 — same draft_saved event in edit mode; the label tags it
        // so dashboards can split create vs edit funnels.
        track({
          eventType: 'trip_wizard.draft_saved',
          eventCategory: 'trip' as any,
          eventAction: 'draft_saved',
          eventLabel: 'edit',
        });
        // Edits are now persisted server-side — wipe the AsyncStorage shadow.
        clearStoredFormState();
        Alert.alert('Changes saved', 'Your trip has been updated.');
        return;
      }

      await wizard?.saveDraft?.(tripData);
      // C.4 — draft_saved fires after a successful server-side write.
      track({
        eventType: 'trip_wizard.draft_saved',
        eventCategory: 'trip' as any,
        eventAction: 'draft_saved',
        eventLabel: isEditMode ? 'edit' : 'create',
      });
      // Trip now exists server-side as a draft — the user can resume from
      // the dashboard via the real DB row, no need to keep the local shadow.
      clearStoredFormState();
      Alert.alert('Draft saved', 'Your trip has been saved as a draft. You can come back and edit it anytime.');
    } catch (err: any) {
      console.error('[CreateTripWizard] Save draft error:', err);
      Alert.alert('Could not save draft', err?.message ?? 'An unknown error occurred. Please try again.');
    }
  };

  // Pick the lowest step containing a flagged field so the user lands on
  // the right page after a failed publish. Keeps the publish CTA on Step 3
  // (Review) honest — pressing it never silently swallows the error.
  const stepForErrorKey = (key: string): number => {
    if (
      key === 'trip_name' ||
      key === 'destination' ||
      key === 'start_date' ||
      key === 'end_date' ||
      key === 'max_participants'
    ) return 0;
    if (
      key === 'price_per_person' ||
      key === 'deposit_amount' ||
      key === 'refund_cutoff_days'
    ) return 1;
    return 0;
  };

  const publish = async () => {
    try {
      // A.1 — gate the publish path on the full required-field check. If
      // anything fails, we surface inline red text under each field AND
      // jump the wizard to the earliest step holding an error so the user
      // can actually see the highlighted rows.
      const errors = validateForPublish();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const firstStep = Math.min(...Object.keys(errors).map(stepForErrorKey));
        if (Number.isFinite(firstStep) && firstStep !== currentStep) {
          setCurrentStep(firstStep);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
        Alert.alert(
          t('create_trip_wizard.validation_publish_blocked_title'),
          t('create_trip_wizard.validation_publish_blocked_body')
        );
        return;
      }
      setFieldErrors({});

      const tripData = buildTripData();
      console.log('[CreateTripWizard] publish pressed', {
        isEditMode,
        editTripId,
        routeParams: route.params,
        hasWizard: !!wizard,
        hasSaveDraft: !!wizard?.saveDraft,
      });

      // Edit mode: skip the hook (and publishTrip) entirely. Call updateTrip
      // directly so we don't depend on the hook's savedTripId state, which
      // may race with hydration. Then go back so the dashboard refreshes.
      if (isEditMode && editTripId) {
        console.log('[CreateTripWizard] edit-mode publish → updateTrip start', tripData);
        const updated = await TripOrganizerEngine.updateTrip(editTripId, tripData);
        console.log('[CreateTripWizard] edit-mode publish → updateTrip done', updated?.id);
        // Trip is published — wipe the AsyncStorage shadow.
        clearStoredFormState();
        Alert.alert('Changes saved', 'Your trip has been updated.');
        navigation.goBack();
        return;
      }

      // Create mode: 1) save draft, 2) publish, 3) go to success screen
      console.log('[CreateTripWizard] create-mode publish → saveDraft start');
      const tripId = await wizard?.saveDraft?.(tripData);
      console.log('[CreateTripWizard] create-mode publish → saveDraft done', tripId);

      let publishedSlug = '';
      if (tripId) {
        const publishedTrip = await wizard?.publish?.(tripId);
        publishedSlug = publishedTrip?.slug ?? '';
        console.log('[CreateTripWizard] create-mode publish → publishTrip done', publishedSlug);
      }

      const resolvedTripId = tripId ?? 'new';

      // C.4 — published. Carries the three shape booleans + payment_type
      // so funnel queries can split by configuration without re-joining.
      track({
        eventType: 'trip_wizard.published',
        eventCategory: 'trip' as any,
        eventAction: 'published',
        eventLabel: formData.payment_type,
        eventValue: {
          trip_id: resolvedTripId,
          payment_type: formData.payment_type,
          has_deposit: formData.deposit_required,
          has_requirements:
            formData.requirements.some((r) => r.enabled) ||
            formData.custom_requirements.length > 0,
        },
      });

      // Trip is published — wipe the AsyncStorage shadow.
      clearStoredFormState();

      navigation.navigate('TripPublishSuccess' as any, {
        tripName: formData.trip_name,
        destination: formData.destination,
        startDate: formData.start_date,
        endDate: formData.end_date,
        tripId: resolvedTripId,
        slug: publishedSlug,
      });
    } catch (err: any) {
      console.error('[CreateTripWizard] Publish/save error:', err, err?.stack);
      Alert.alert(
        isEditMode ? 'Could not save changes' : 'Could not publish trip',
        err?.message ?? 'An unknown error occurred. Please try again.'
      );
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepBasics data={formData} update={updateForm} uploadingCover={uploadingCover} onPickCoverNative={pickCoverPhotoNative} onWebCoverFile={handleWebCoverFile} errors={fieldErrors} />;
      case 1: return <StepPayment data={formData} update={updateForm} errors={fieldErrors} />;
      case 2: return <StepRequirements data={formData} update={updateForm} />;
      case 3: return <StepReview data={formData} onPublish={publish} onSaveDraft={saveDraft} isEditMode={isEditMode} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header} onLayout={measureChrome('header')}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Trip' : 'Trip Setup'}</Text>
        <View style={styles.headerRightCluster}>
          {/* B.1 — Help (?) icon, opens the inline HelpSheet. Sits to the
              left of the close button so the close stays in the corner. */}
          <TouchableOpacity
            onPress={() => {
              // C.4 — help_opened.
              track({
                eventType: 'trip_wizard.help_opened',
                eventCategory: 'trip' as any,
                eventAction: 'help_opened',
                eventValue: { step: currentStep },
              });
              setHelpOpen(true);
            }}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('create_trip.help_title')}
          >
            <Ionicons name="help-circle-outline" size={24} color={NAVY} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepSection} onLayout={measureChrome('stepSection')}>
        {/* B.3 — Dots are tappable to jump back to any prior step. The
            forward direction is still gated by goNext (validation lives
            in the publish path, not the next button — Bucket C would tie
            forward validation per-step). */}
        <StepIndicator
          currentStep={currentStep}
          onJumpTo={(target) => {
            if (target < currentStep) {
              setCurrentStep(target);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }
          }}
        />
        <Text style={styles.stepCounter}>
          Step {currentStep + 1} of {TOTAL_STEPS} — {t(STEP_NAME_KEYS[currentStep])}
        </Text>
      </View>

      {/* Edit-mode hydration banner */}
      {hydrating && (
        <View style={styles.hydratingBanner} onLayout={measureChrome('banner')}>
          <ActivityIndicator size="small" color={TEAL} />
          <Text style={styles.hydratingText}>Loading trip…</Text>
        </View>
      )}

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Local-draft restore banner. Shown only on Step 0 when a
              persisted form-state shadow exists and the user hasn't
              dismissed it via Restore/Discard. Distinct from the existing
              "Loading trip…" banner above (which is edit-mode fetch
              hydration). */}
          {currentStep === 0 && hasStoredFormState && !bannerDismissed && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                You have an unfinished trip. Pick up where you left off?
              </Text>
              <View style={styles.draftBannerActions}>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleRestoreDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("create_trip_wizard.draft_restore")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>{t("create_trip_wizard.draft_discard")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* B.2 — First-visit coach banner. Only on Step 0 so it doesn't
              follow the user through the whole flow. Tappable; auto
              dismisses after 4 s via the effect above. */}
          {coachVisible && currentStep === 0 && (
            <Pressable
              onPress={dismissCoach}
              style={styles.coachBanner}
              accessibilityRole="button"
              accessibilityLabel={t('create_trip.coach_dismiss')}
            >
              <Ionicons name="bulb-outline" size={16} color={colors.cardBg} />
              <Text style={styles.coachText}>
                {t('create_trip.coach_title')}
              </Text>
              <Ionicons name="close" size={14} color={colors.cardBg} />
            </Pressable>
          )}

          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* B.1 — HelpSheet rendered as a sibling of the KeyboardAvoidingView
          so it overlays everything (including the footer + step indicator)
          when open. */}
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        t={t}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBackBtn} onPress={goBack}>
          <Text style={styles.footerBackBtnText}>{currentStep === 0 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveDraftBtn} onPress={saveDraft}>
          <Text style={styles.saveDraftBtnText}>{t("create_trip_wizard.btn_save_draft")}</Text>
        </TouchableOpacity>
        {currentStep < TOTAL_STEPS - 1 && (
          <TouchableOpacity style={styles.nextBtn} activeOpacity={0.7} onPress={goNext}>
            <Text style={styles.nextBtnText}>{t("final_polish.createtripwizard_next")}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.cardBg} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default CreateTripWizardScreen;

// ══════════════════════════════════════════════════════════════════════════
// HelpSheet — B.1
// ══════════════════════════════════════════════════════════════════════════
// 5 topics ordered to mirror the wizard flow: what → pricing → refund →
// documents → publish. Lives outside the main component so the modal
// renders cleanly above the keyboard-avoiding view.

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
            <Text style={styles.helpTitle}>{t('create_trip.help_title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('create_trip.help_close')}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.helpScroll}
          >
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>
                  {t(`create_trip.help_topic_${topic}`)}
                </Text>
                <Text style={styles.helpItemBody}>
                  {t(`create_trip.help_topic_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  stepSection: {
    backgroundColor: colors.cardBg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepCounter: {
    marginTop: spacing.sm,
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    // Big bottom padding so the LAST FormInput (e.g. "What's Excluded" on
    // Basics) can scroll above the keyboard. Without enough room here, max
    // scroll position can't lift the last field past the keyboard top.
    // Sized > iOS QWERTY+predictive bar (~336pt) with a small buffer.
    paddingBottom: 360,
  },
  sectionLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.body,
    color: NAVY,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // A.1 — red border when a field is flagged. Matches the inline error
  // text below the input so the eye finds the failing row at a glance.
  textInputError: {
    borderColor: colors.errorText,
  },
  fieldErrorText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.errorText,
    fontWeight: '500',
  },
  // A.3 — soft hint under the refund cutoff input. Different from
  // fieldErrorText (which is the validation error) so the user can see
  // the explanation even when the field is valid.
  refundCutoffHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderRadius: radius.small,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleLabel: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: NAVY,
  },
  toggleButtonRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  toggleButtonActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  toggleButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.cardBg,
  },
  // Installment plan preview shown under the cadence + count pickers.
  installmentPreview: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.screenBg,
    borderRadius: 8,
  },
  installmentPreviewText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  dropdownBtnText: {
    fontSize: typography.body,
    color: NAVY,
  },
  dropdownList: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.small,
    borderBottomRightRadius: radius.small,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: typography.body,
    color: NAVY,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkLabel: {
    fontSize: typography.body,
    color: NAVY,
    marginLeft: spacing.md,
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addCustomInput: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
    color: NAVY,
    marginRight: spacing.sm,
  },
  addCustomBtn: {
    backgroundColor: TEAL,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredStep: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  centeredTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginTop: spacing.lg,
  },
  centeredSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  itineraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TEAL,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.button,
    marginTop: spacing.xxl,
  },
  itineraryBtnText: {
    color: colors.cardBg,
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
  },
  reviewCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  reviewValue: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: NAVY,
    flex: 1,
    textAlign: 'right',
  },
  reviewBullet: {
    fontSize: typography.body,
    color: NAVY,
    paddingVertical: 4,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: radius.button,
    marginTop: spacing.xxl,
  },
  publishBtnText: {
    color: colors.cardBg,
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  footerBackBtnText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  saveDraftBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
  },
  saveDraftBtnText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: NAVY,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TEAL,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.button,
  },
  nextBtnText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.semibold,
    marginRight: spacing.sm,
  },
  // --- Review step (4 of 4) ---
  reviewHeading: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: NAVY,
    marginBottom: 4,
  },
  reviewSubheading: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewTripName: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    flex: 1,
  },
  reviewDraftPill: {
    backgroundColor: 'rgba(232,168,66,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,66,0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewDraftPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: GOLD,
  },
  reviewTripMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reviewMetaItem: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itineraryAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(232,168,66,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,66,0.25)',
    borderRadius: radius.small,
    padding: 12,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  itineraryAlertTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: GOLD,
    marginBottom: 2,
  },
  itineraryAlertText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  reviewChecklist: {
    marginBottom: spacing.md,
  },
  reviewCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  reviewCheckLabel: {
    fontSize: typography.body,
    color: NAVY,
  },
  reviewCheckDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  saveDraftReviewBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    marginTop: spacing.md,
  },
  saveDraftReviewText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  // --- iOS Date Picker ---
  datePickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  datePickerModalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#F9FAFB',
  },
  datePickerCancel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  datePickerDone: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: TEAL,
  },
  hydratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(0,198,174,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,198,174,0.2)',
    gap: 8,
  },
  hydratingText: {
    fontSize: typography.bodySmall,
    color: TEAL,
    fontWeight: typography.semibold,
  },
  // --- Local-draft restore banner (mirrors GoalCreateScreen) ---
  draftBanner: {
    backgroundColor: colors.warningBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftBannerText: {
    flex: 1,
    color: colors.warningLabel,
    fontSize: 13,
    fontWeight: '500',
  },
  draftBannerActions: { flexDirection: 'row', alignItems: 'center' },
  draftBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.cardBg,
    marginLeft: 8,
  },
  draftBannerButtonText: { color: colors.warningAmber, fontWeight: '600', fontSize: 13 },
  // --- Cover photo picker ---
  coverFieldContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  coverFieldButton: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: 'rgba(0,198,174,0.3)',
    borderStyle: 'dashed' as const,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.xs,
  },
  coverFieldImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  coverFieldOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,35,66,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 6,
  },
  coverFieldOverlayText: {
    color: colors.cardBg,
    fontSize: typography.label,
    fontWeight: typography.semibold,
  },
  coverFieldPlaceholder: {
    alignItems: 'center' as const,
    gap: 4,
  },
  coverFieldPlaceholderText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: NAVY,
    marginTop: spacing.xs,
  },
  coverFieldHint: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  coverFieldUploading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,35,66,0.55)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  coverFieldUploadingText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },

  // ─── B.1 (?) header cluster ─────────────────────────────────────────────
  // The right side of the header now holds two icons (help + close)
  // instead of one; cluster them in a row so the spacing matches the
  // single-icon arrangement on the left.
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ─── B.2 coach mark banner ──────────────────────────────────────────────
  coachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  coachText: {
    flex: 1,
    color: colors.cardBg,
    fontSize: 12,
    fontWeight: '600' as const,
  },

  // ─── B.4 LabelWithInfo row ──────────────────────────────────────────────
  labelWithInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Section variant uses the spacing.lg gap that SectionLabel relies on;
  // inline variant matches FormInput labels.
  labelWithInfoRowSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  labelInfoIcon: {
    marginLeft: 6,
    padding: 2,
  },

  // ─── B.5 Shareable preview ──────────────────────────────────────────────
  shareablePreviewLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  shareablePreviewCover: {
    width: '100%',
    height: 140,
    borderRadius: radius.small,
    marginBottom: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  shareablePreviewCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItineraryHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },

  // ─── B.1 HelpSheet ──────────────────────────────────────────────────────
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  helpSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  helpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: NAVY,
  },
  helpScroll: { paddingBottom: 8 },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  helpItemTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: NAVY,
    marginBottom: 4,
  },
  helpItemBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
