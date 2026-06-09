import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useCreateTripWizard } from '../hooks/useTripOrganizer';
import { useFormKeyboardOffset } from '../hooks/useFormKeyboardOffset';
import { useFormDraft } from '../hooks/useFormDraft';
import {
  TripOrganizerEngine,
  type PaymentFrequency,
  type InstallmentSchedule,
} from '../services/TripOrganizerEngine';
import { MediaUploadService } from '../services/MediaUploadService';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

const TOTAL_STEPS = 4;

// i18n: step name keys resolved per-render via t() at call site.
const STEP_NAME_KEYS = [
  'create_trip_wizard.step_basics',
  'create_trip_wizard.step_payment',
  'create_trip_wizard.step_requirements',
  'create_trip_wizard.step_review',
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

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => (
  <View style={styles.stepIndicatorRow}>
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
      let bg = '#D1D5DB';
      if (i < currentStep) bg = TEAL;
      if (i === currentStep) bg = GOLD;
      return (
        <View key={i} style={[styles.stepDot, { backgroundColor: bg }]} />
      );
    })}
  </View>
);

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
}> = ({ label, value, onChangeText, placeholder, multiline, keyboardType }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? ''}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      keyboardType={keyboardType}
    />
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
      thumbColor="#FFFFFF"
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
}> = ({ label, value, onChange }) => {
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
            backgroundColor: '#FFFFFF',
            border: `1px solid ${colors.border}`,
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
        style={styles.textInput}
        onPress={() => {
          if (value) setTempDate(new Date(value + 'T00:00:00'));
          setShowPicker(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: typography.body, color: value ? NAVY : '#9CA3AF' }}>
          {value ? formatDateFriendly(value) : 'Select date'}
        </Text>
      </TouchableOpacity>
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
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.coverFieldOverlayText}>{t("create_trip_wizard.cover_change")}</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.coverFieldUploading} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFFFFF" />
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
}> = ({ data, update, uploadingCover, onPickCoverNative, onWebCoverFile }) => {
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
    <FormInput label={t("create_trip_wizard.label_trip_name")} value={data.trip_name} onChangeText={(v) => update({ trip_name: v })} placeholder={t("create_trip_wizard.placeholder_trip_name")} />
    <FormInput label={t("create_trip_wizard.label_destination")} value={data.destination} onChangeText={(v) => update({ destination: v })} placeholder={t("create_trip_wizard.placeholder_destination")} />
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <DatePickerField label="Start Date" value={data.start_date} onChange={(v) => update({ start_date: v })} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <DatePickerField label="End Date" value={data.end_date} onChange={(v) => update({ end_date: v })} />
      </View>
    </View>
    <FormInput label={t("create_trip_wizard.label_max_participants")} value={data.max_participants} onChangeText={(v) => update({ max_participants: v })} placeholder={t("create_trip_wizard.placeholder_max_participants")} keyboardType="numeric" />
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
}> = ({ data, update }) => {
  const [showPolicyPicker, setShowPolicyPicker] = useState(false);

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
      <SectionLabel label="Pricing" />
      <FormInput label="Price Per Person ($)" value={data.price_per_person} onChangeText={(v) => update({ price_per_person: v })} placeholder="1800" keyboardType="numeric" />

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

      <ToggleRow label="Deposit Required" value={data.deposit_required} onValueChange={(v) => update({ deposit_required: v })} />
      {data.deposit_required && (
        <FormInput label="Deposit Amount ($)" value={data.deposit_amount} onChangeText={(v) => update({ deposit_amount: v })} placeholder="300" keyboardType="numeric" />
      )}

      <SectionLabel label="Refund Policy" />
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowPolicyPicker(!showPolicyPicker)}>
        <Text style={[styles.dropdownBtnText, !data.refund_policy && { color: '#9CA3AF' }]}>
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
              onPress={() => { update({ refund_policy: policy }); setShowPolicyPicker(false); }}
            >
              <Text style={[styles.dropdownItemText, data.refund_policy === policy && { color: TEAL, fontWeight: typography.semibold }]}>
                {policy}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
      <SectionLabel label="Required Documents & Info" />
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
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.addCustomBtn} onPress={addCustom}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
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
        <Ionicons name="construct-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
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

      {/* Summary card */}
      <View style={styles.reviewCard}>
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
          <Text style={[styles.reviewCheckLabel, { color: '#9CA3AF' }]}>Itinerary — optional at launch</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.publishBtn} activeOpacity={0.7} onPress={onPublish}>
        <Ionicons
          name={isEditMode ? 'save-outline' : 'rocket-outline'}
          size={20}
          color="#FFFFFF"
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
    requirements: [...DEFAULT_REQUIREMENTS],
    custom_requirements: [],
    messaging_mode: true,
    auto_reminders: true,
    notify_payment: true,
    notify_docs: true,
    notify_itinerary: false,
  });

  const updateForm = (partial: Partial<TripFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
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
        // Edits are now persisted server-side — wipe the AsyncStorage shadow.
        clearStoredFormState();
        Alert.alert('Changes saved', 'Your trip has been updated.');
        return;
      }

      await wizard?.saveDraft?.(tripData);
      // Trip now exists server-side as a draft — the user can resume from
      // the dashboard via the real DB row, no need to keep the local shadow.
      clearStoredFormState();
      Alert.alert('Draft saved', 'Your trip has been saved as a draft. You can come back and edit it anytime.');
    } catch (err: any) {
      console.error('[CreateTripWizard] Save draft error:', err);
      Alert.alert('Could not save draft', err?.message ?? 'An unknown error occurred. Please try again.');
    }
  };

  const publish = async () => {
    try {
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
      case 0: return <StepBasics data={formData} update={updateForm} uploadingCover={uploadingCover} onPickCoverNative={pickCoverPhotoNative} onWebCoverFile={handleWebCoverFile} />;
      case 1: return <StepPayment data={formData} update={updateForm} />;
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepSection} onLayout={measureChrome('stepSection')}>
        <StepIndicator currentStep={currentStep} />
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

          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

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
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default CreateTripWizardScreen;

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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  row: {
    flexDirection: 'row',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  // Installment plan preview shown under the cadence + count pickers.
  installmentPreview: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
  },
  installmentPreviewText: {
    fontSize: 13,
    color: '#6B7280',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftBannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
  },
  draftBannerActions: { flexDirection: 'row', alignItems: 'center' },
  draftBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
  },
  draftBannerButtonText: { color: '#D97706', fontWeight: '600', fontSize: 13 },
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
});
