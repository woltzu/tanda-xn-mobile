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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useCreateTripWizard } from '../hooks/useTripOrganizer';
import { TripOrganizerEngine } from '../services/TripOrganizerEngine';
import { MediaUploadService } from '../services/MediaUploadService';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

const TOTAL_STEPS = 4;

const STEP_NAMES = [
  'Basics',
  'Payment',
  'Requirements',
  'Review',
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
      {showPicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerIOS}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={styles.datePickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmIOSDate}>
              <Text style={styles.datePickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={handleChange}
            style={{ height: 150 }}
          />
        </View>
      )}
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
      <Text style={styles.inputLabel}>Cover Photo</Text>
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
            <Text style={styles.coverFieldPlaceholderText}>Add Cover Photo</Text>
            <Text style={styles.coverFieldHint}>Tap to pick from your photos</Text>
          </View>
        )}
        {url && (
          <View style={styles.coverFieldOverlay} pointerEvents="none">
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.coverFieldOverlayText}>Change</Text>
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
}> = ({ data, update, uploadingCover, onPickCoverNative, onWebCoverFile }) => (
  <View>
    <CoverPhotoField
      url={data.cover_photo_url}
      uploading={uploadingCover}
      onPickNative={onPickCoverNative}
      onWebFile={onWebCoverFile}
    />
    <SectionLabel label="Trip Details" />
    <FormInput label="Trip Name" value={data.trip_name} onChangeText={(v) => update({ trip_name: v })} placeholder="e.g. Summer Return — Abidjan 2026" />
    <FormInput label="Destination" value={data.destination} onChangeText={(v) => update({ destination: v })} placeholder="e.g. Abidjan, Ivory Coast" />
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <DatePickerField label="Start Date" value={data.start_date} onChange={(v) => update({ start_date: v })} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <DatePickerField label="End Date" value={data.end_date} onChange={(v) => update({ end_date: v })} />
      </View>
    </View>
    <FormInput label="Max Participants" value={data.max_participants} onChangeText={(v) => update({ max_participants: v })} placeholder="25" keyboardType="numeric" />
    <FormInput label="Tagline" value={data.tagline} onChangeText={(v) => update({ tagline: v })} placeholder="A short catchy tagline" />
    <FormInput label="Description" value={data.description} onChangeText={(v) => update({ description: v })} placeholder="Tell people about this trip..." multiline />
    <FormInput label="What's Included" value={data.whats_included} onChangeText={(v) => update({ whats_included: v })} placeholder="Flights, hotels, meals..." multiline />
    <FormInput label="What's Excluded" value={data.whats_excluded} onChangeText={(v) => update({ whats_excluded: v })} placeholder="Visa fees, personal expenses..." multiline />
  </View>
);

const StepPayment: React.FC<{
  data: TripFormData;
  update: (partial: Partial<TripFormData>) => void;
}> = ({ data, update }) => {
  const [showPolicyPicker, setShowPolicyPicker] = useState(false);

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
          <Text style={[styles.toggleButtonText, data.payment_type === 'lump_sum' && styles.toggleButtonTextActive]}>Lump Sum</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, data.payment_type === 'installments' && styles.toggleButtonActive]}
          onPress={() => update({ payment_type: 'installments' })}
        >
          <Text style={[styles.toggleButtonText, data.payment_type === 'installments' && styles.toggleButtonTextActive]}>Installments</Text>
        </TouchableOpacity>
      </View>

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
          placeholder="Add custom field..."
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
      <Text style={styles.centeredTitle}>Build Your Itinerary</Text>
      <Text style={styles.centeredSubtitle}>
        Create a day-by-day plan with activities, locations, and times for your participants.
      </Text>
      <TouchableOpacity
        style={styles.itineraryBtn}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ItineraryBuilder', { tripId: tripId ?? 'new' })}
      >
        <Ionicons name="construct-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.itineraryBtnText}>Continue to Itinerary Builder</Text>
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
      <Text style={styles.checkLabel}>Payment received</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={() => update({ notify_docs: !data.notify_docs })}>
      <Ionicons name={data.notify_docs ? 'checkbox' : 'square-outline'} size={24} color={data.notify_docs ? TEAL : '#D1D5DB'} />
      <Text style={styles.checkLabel}>Document uploaded</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={() => update({ notify_itinerary: !data.notify_itinerary })}>
      <Ionicons name={data.notify_itinerary ? 'checkbox' : 'square-outline'} size={24} color={data.notify_itinerary ? TEAL : '#D1D5DB'} />
      <Text style={styles.checkLabel}>Itinerary changes</Text>
    </TouchableOpacity>
  </View>
);

const StepReview: React.FC<{
  data: TripFormData;
  onPublish: () => void;
  onSaveDraft: () => void;
  isEditMode?: boolean;
}> = ({ data, onPublish, onSaveDraft, isEditMode }) => {
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
      <Text style={styles.reviewHeading}>Ready to publish?</Text>
      <Text style={styles.reviewSubheading}>Step 4 of 4 — Review before going live</Text>

      {/* Summary card */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewTripName}>✈️ {data.trip_name || 'Untitled Trip'}</Text>
          <View style={styles.reviewDraftPill}>
            <Text style={styles.reviewDraftPillText}>Draft</Text>
          </View>
        </View>
        <Text style={styles.reviewTripMeta}>
          {data.destination}{data.start_date ? ` · ${formatDateFriendly(data.start_date)}` : ''}{data.end_date ? ` – ${formatDateFriendly(data.end_date)}` : ''} · {data.max_participants || '?'} spots · ${data.price_per_person || '?'}/person
        </Text>
        <View style={styles.reviewMetaRow}>
          {data.deposit_required && <Text style={styles.reviewMetaItem}>Deposit: ${data.deposit_amount}</Text>}
          {data.payment_type === 'installments' && <Text style={styles.reviewMetaItem}>Installments</Text>}
          <Text style={styles.reviewMetaItem}>{enabledReqs.length + data.custom_requirements.length} requirements</Text>
        </View>
      </View>

      {/* Itinerary not built alert */}
      <View style={styles.itineraryAlert}>
        <Ionicons name="alert-circle" size={18} color={GOLD} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itineraryAlertTitle}>Itinerary not built yet</Text>
          <Text style={styles.itineraryAlertText}>
            You can publish now and build the itinerary after. Your trip page will show "Itinerary coming soon."
          </Text>
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.reviewChecklist}>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={basicsComplete ? 'checkbox' : 'square-outline'} size={20} color={basicsComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, basicsComplete && styles.reviewCheckDone]}>Trip basics complete</Text>
        </View>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={paymentComplete ? 'checkbox' : 'square-outline'} size={20} color={paymentComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, paymentComplete && styles.reviewCheckDone]}>Payment setup complete</Text>
        </View>
        <View style={styles.reviewCheckRow}>
          <Ionicons name={requirementsComplete ? 'checkbox' : 'square-outline'} size={20} color={requirementsComplete ? '#10B981' : '#D1D5DB'} />
          <Text style={[styles.reviewCheckLabel, requirementsComplete && styles.reviewCheckDone]}>Requirements selected</Text>
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
        <Text style={styles.saveDraftReviewText}>Save as Draft</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Main Screen ---

const CreateTripWizardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const wizard = useCreateTripWizard();
  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Edit mode: /CreateTripWizard?tripId=...&mode=edit
  const editTripId: string | undefined = route.params?.tripId;
  const isEditMode: boolean = route.params?.mode === 'edit' && !!editTripId;
  const [hydrating, setHydrating] = useState<boolean>(isEditMode);

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
        Alert.alert('Upload failed', res.error ?? 'Could not upload cover photo. Please try again.');
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
      Alert.alert('Could not upload photo', err?.message ?? 'An unknown error occurred.');
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
          'Permission needed',
          'TandaXn needs photo library access to set a trip cover. Please grant permission in your device settings.'
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
      Alert.alert('Could not pick photo', err?.message ?? 'An unknown error occurred.');
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
        Alert.alert('Could not load trip', err?.message ?? 'Please try again.');
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
        Alert.alert('Changes saved', 'Your trip has been updated.');
        return;
      }

      await wizard?.saveDraft?.(tripData);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Trip' : 'Trip Setup'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepSection}>
        <StepIndicator currentStep={currentStep} />
        <Text style={styles.stepCounter}>
          Step {currentStep + 1} of {TOTAL_STEPS} — {STEP_NAMES[currentStep]}
        </Text>
      </View>

      {/* Edit-mode hydration banner */}
      {hydrating && (
        <View style={styles.hydratingBanner}>
          <ActivityIndicator size="small" color={TEAL} />
          <Text style={styles.hydratingText}>Loading trip…</Text>
        </View>
      )}

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBackBtn} onPress={goBack}>
          <Text style={styles.footerBackBtnText}>{currentStep === 0 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveDraftBtn} onPress={saveDraft}>
          <Text style={styles.saveDraftBtnText}>Save Draft</Text>
        </TouchableOpacity>
        {currentStep < TOTAL_STEPS - 1 && (
          <TouchableOpacity style={styles.nextBtn} activeOpacity={0.7} onPress={goNext}>
            <Text style={styles.nextBtnText}>Next</Text>
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
    paddingBottom: 120,
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
  datePickerIOS: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    marginTop: 4,
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
