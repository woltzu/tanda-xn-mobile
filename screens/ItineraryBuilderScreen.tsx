import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useItineraryBuilder } from '../hooks/useTripOrganizer';
import { TripOrganizerEngine } from '../services/TripOrganizerEngine';
import type { TripActivity, CategoryTag } from '../services/TripOrganizerEngine';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Category chips matching DB enum ---
const CATEGORIES: { id: CategoryTag; label: string; emoji: string }[] = [
  { id: 'Arrival', label: 'Arrival', emoji: '\u2708' },
  { id: 'Breakfast', label: 'Breakfast', emoji: '\u2600\uFE0F' },
  { id: 'Beach', label: 'Beach', emoji: '\uD83C\uDFD6' },
  { id: 'Adventure', label: 'Adventure', emoji: '\uD83C\uDFCD' },
  { id: 'Culture', label: 'Culture', emoji: '\uD83D\uDECD' },
  { id: 'Sailing', label: 'Sailing', emoji: '\u26F5' },
  { id: 'Dinner', label: 'Dinner', emoji: '\uD83C\uDF7D' },
  { id: 'Nightlife', label: 'Nightlife', emoji: '\uD83C\uDF19' },
  { id: 'Logistics', label: 'Logistics', emoji: '\uD83D\uDE97' },
  { id: 'Departure', label: 'Departure', emoji: '\uD83D\uDEEB' },
  { id: 'Accommodation', label: 'Stay', emoji: '\uD83C\uDFE1' },
  { id: 'Other', label: 'Other', emoji: '\uD83D\uDCCD' },
];

const getCategoryEmoji = (tag: string | null | undefined): string => {
  const cat = CATEGORIES.find((c) => c.id === tag);
  return cat?.emoji ?? '\uD83D\uDCCD';
};

// Normalize "4:30 PM" / "16:30" / "4:30" / "" into a Postgres TIME literal
// (HH:MM:SS). Returns null for empty/invalid input.
const normalizeTime = (input: string | null | undefined): string | null => {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Match "H[:MM] [AM|PM]" or "HH:MM"
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*([ap]m)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3]?.toLowerCase();

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  if (meridian === 'am') {
    if (hours === 12) hours = 0;
  } else if (meridian === 'pm') {
    if (hours < 12) hours += 12;
  }

  if (hours < 0 || hours > 23) return null;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

// Format a Postgres TIME "HH:MM:SS" back into "H:MM AM/PM" for display
const formatTimeDisplay = (time: string | null | undefined): string => {
  if (!time) return '';
  const match = time.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return time;
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${mins} ${ampm}`;
};

// --- Modal form state ---
interface ModalForm {
  activityId: string | null;
  dayId: string;
  name: string;
  startTime: string;
  endTime: string;
  category: CategoryTag;
  description: string;
  location: string;
}

const EMPTY_FORM: Omit<ModalForm, 'dayId'> = {
  activityId: null,
  name: '',
  startTime: '',
  endTime: '',
  category: 'Other',
  description: '',
  location: '',
};

// --- Activity Row ---
const ActivityRow: React.FC<{
  activity: TripActivity;
  onEdit: () => void;
}> = ({ activity, onEdit }) => (
  <TouchableOpacity style={styles.activityRow} onPress={onEdit} activeOpacity={0.6}>
    <Text style={styles.activityTime}>{formatTimeDisplay(activity.startTime)}</Text>
    <Text style={styles.activityEmoji}>{getCategoryEmoji(activity.categoryTag)}</Text>
    <View style={styles.activityInfo}>
      <Text style={styles.activityName} numberOfLines={1}>{activity.title}</Text>
      {!!activity.description && (
        <Text style={styles.activityDesc} numberOfLines={1}>{activity.description}</Text>
      )}
    </View>
    <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
  </TouchableOpacity>
);

// --- Day Card (uses local state for title to avoid keyboard dismiss on each keystroke) ---
const DayCard: React.FC<{
  day: { id: string; dayNumber: number; date: string; title: string | null; activities: TripActivity[] };
  onSaveTitle: (title: string) => void;
  onAddActivity: () => void;
  onEditActivity: (activity: TripActivity) => void;
  onDeleteDay: () => void;
}> = ({ day, onSaveTitle, onAddActivity, onEditActivity, onDeleteDay }) => {
  const [localTitle, setLocalTitle] = useState(day.title ?? '');

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>DAY {day.dayNumber}</Text>
        <Text style={styles.dayDate}>{day.date}</Text>
        <TouchableOpacity onPress={onDeleteDay} style={styles.dayDeleteBtn}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.dayTitleInput}
        value={localTitle}
        onChangeText={setLocalTitle}
        onBlur={() => { if (localTitle !== (day.title ?? '')) onSaveTitle(localTitle); }}
        placeholder="Day title (e.g. Arrival Day)"
        placeholderTextColor="#9CA3AF"
      />
      {day.activities.map((act) => (
        <ActivityRow key={act.id} activity={act} onEdit={() => onEditActivity(act)} />
      ))}
      <TouchableOpacity style={styles.addActivityBtn} onPress={onAddActivity} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={20} color={TEAL} />
        <Text style={styles.addActivityText}>Add Activity</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Activity Editor Bottom Sheet Modal ---
const ActivityModal: React.FC<{
  visible: boolean;
  form: ModalForm | null;
  saving: boolean;
  onUpdate: (partial: Partial<ModalForm>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ visible, form, saving, onUpdate, onSave, onDelete, onClose }) => {
  if (!form) return null;

  const isEditing = !!form.activityId;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Activity' : 'New Activity'}</Text>
            <View style={styles.modalHeaderRight}>
              {isEditing && (
                <TouchableOpacity onPress={onDelete} style={styles.modalDeleteBtn}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Activity Name */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Activity Name</Text>
              <TextInput
                style={styles.modalInput}
                value={form.name}
                onChangeText={(v) => onUpdate({ name: v })}
                placeholder="e.g. Eagle Beach — Golden Hour"
                placeholderTextColor="#9CA3AF"
                autoFocus={!isEditing}
              />
            </View>

            {/* Time row */}
            <View style={styles.modalTimeRow}>
              <View style={[styles.modalInputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.modalInputLabel}>Start Time</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.startTime}
                  onChangeText={(v) => onUpdate({ startTime: v })}
                  placeholder="4:30 PM"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={[styles.modalInputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.modalInputLabel}>End Time</Text>
                <TextInput
                  style={styles.modalInput}
                  value={form.endTime}
                  onChangeText={(v) => onUpdate({ endTime: v })}
                  placeholder="6:00 PM"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Category chips */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryScrollContent}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      form.category === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => onUpdate({ category: cat.id })}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryText,
                        form.category === cat.id && styles.categoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Description */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={(v) => onUpdate({ description: v })}
                placeholder="Brief description..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            {/* Location */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Location (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={form.location}
                onChangeText={(v) => onUpdate({ location: v })}
                placeholder="e.g. Eagle Beach, Aruba"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </ScrollView>

          {/* Save */}
          <TouchableOpacity
            style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
            activeOpacity={0.7}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalSaveBtnText}>
                {isEditing ? 'Update Activity' : 'Save Activity'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Screen ---

const ItineraryBuilderScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId: string = route.params?.tripId ?? '';

  const builder = useItineraryBuilder(tripId);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalForm, setModalForm] = useState<ModalForm | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Day operations ---

  const handleAddDay = useCallback(async () => {
    try {
      const nextNum = builder.days.length + 1;
      await builder.addDay({
        dayNumber: nextNum,
        title: `Day ${nextNum}`,
        sortOrder: nextNum,
      });
    } catch (err) {
      console.warn('[ItineraryBuilder] Add day error:', err);
    }
  }, [builder]);

  const handleUpdateDayTitle = useCallback(
    async (dayId: string, title: string) => {
      try {
        await builder.updateDay(dayId, { title });
      } catch (err) {
        console.warn('[ItineraryBuilder] Update day title error:', err);
      }
    },
    [builder],
  );

  const handleDeleteDay = useCallback(
    (dayId: string) => {
      Alert.alert('Delete Day', 'Are you sure? All activities in this day will be deleted.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await builder.deleteDay(dayId);
            } catch (err) {
              console.warn('[ItineraryBuilder] Delete day error:', err);
            }
          },
        },
      ]);
    },
    [builder],
  );

  // --- Modal operations ---

  const openAddModal = (dayId: string, existingActivities: TripActivity[]) => {
    setModalForm({
      ...EMPTY_FORM,
      dayId,
    });
    setModalVisible(true);
  };

  const openEditModal = (dayId: string, activity: TripActivity) => {
    setModalForm({
      activityId: activity.id,
      dayId,
      name: activity.title ?? '',
      startTime: formatTimeDisplay(activity.startTime),
      endTime: formatTimeDisplay(activity.endTime),
      category: (activity.categoryTag as CategoryTag) ?? 'Other',
      description: activity.description ?? '',
      location: activity.location ?? '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalForm(null);
  };

  const updateForm = (partial: Partial<ModalForm>) => {
    setModalForm((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleSaveActivity = async () => {
    if (!modalForm || !modalForm.name.trim()) {
      Alert.alert('Name required', 'Please enter an activity name.');
      return;
    }
    setSaving(true);
    try {
      const day = builder.days.find((d) => d.id === modalForm.dayId);
      const startTime = normalizeTime(modalForm.startTime);
      const endTime = normalizeTime(modalForm.endTime);
      if (modalForm.activityId) {
        // Update existing
        await TripOrganizerEngine.updateActivity(modalForm.activityId, {
          title: modalForm.name,
          startTime,
          endTime,
          description: modalForm.description || null,
          location: modalForm.location || null,
          categoryTag: modalForm.category,
        });
      } else {
        // Add new
        await TripOrganizerEngine.addActivity(modalForm.dayId, {
          title: modalForm.name,
          startTime,
          endTime,
          description: modalForm.description || null,
          location: modalForm.location || null,
          categoryTag: modalForm.category,
          sortOrder: day?.activities?.length ?? 0,
        });
      }
      await builder.refresh();
      closeModal();
    } catch (err: any) {
      console.warn('[ItineraryBuilder] Save activity error:', err);
      Alert.alert('Could not save activity', err?.message ?? 'An unknown error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!modalForm?.activityId) return;
    Alert.alert('Delete Activity', 'Are you sure you want to delete this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await TripOrganizerEngine.deleteActivity(modalForm.activityId!);
            await builder.refresh();
            closeModal();
          } catch (err) {
            console.warn('[ItineraryBuilder] Delete activity error:', err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Itinerary Builder</Text>
        <TouchableOpacity
          style={styles.previewBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('TripPublicPage' as any, { tripId })}
        >
          <Text style={styles.previewBtnText}>Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {builder.loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {builder.days.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No days added yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first day to start building the itinerary
              </Text>
            </View>
          ) : (
            builder.days.map((day) => (
              <DayCard
                key={day.id}
                day={day}
                onSaveTitle={(title) => handleUpdateDayTitle(day.id, title)}
                onAddActivity={() => openAddModal(day.id, day.activities)}
                onEditActivity={(activity) => openEditModal(day.id, activity)}
                onDeleteDay={() => handleDeleteDay(day.id)}
              />
            ))
          )}

          {/* Add Day */}
          <TouchableOpacity style={styles.addDayBtn} activeOpacity={0.7} onPress={handleAddDay}>
            <Ionicons name="add" size={22} color={TEAL} />
            <Text style={styles.addDayBtnText}>Add Day</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Activity Editor Modal */}
      <ActivityModal
        visible={modalVisible}
        form={modalForm}
        saving={saving}
        onUpdate={updateForm}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
};

export default ItineraryBuilderScreen;

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
  previewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: TEAL,
  },
  previewBtnText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: TEAL,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  // --- Day Card ---
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: GOLD,
    letterSpacing: 1,
  },
  dayDate: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  dayDeleteBtn: {
    padding: spacing.xs,
  },
  dayTitleInput: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  // --- Activity Row ---
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityTime: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: TEAL,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 72,
  },
  activityEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: NAVY,
  },
  activityDesc: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  addActivityText: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: TEAL,
    marginLeft: spacing.sm,
  },
  // --- Add Day ---
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: TEAL,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    paddingVertical: 16,
    marginBottom: spacing.lg,
  },
  addDayBtnText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: TEAL,
    marginLeft: spacing.sm,
  },
  // --- Empty state ---
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // --- Modal ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalDeleteBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  modalTimeRow: {
    flexDirection: 'row',
  },
  modalInputGroup: {
    marginBottom: spacing.lg,
  },
  modalInputLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.body,
    color: NAVY,
  },
  // --- Category chips ---
  categoryScroll: {
    flexGrow: 0,
  },
  categoryScrollContent: {
    paddingRight: spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  // --- Modal Save ---
  modalSaveBtn: {
    backgroundColor: TEAL,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
  },
});
