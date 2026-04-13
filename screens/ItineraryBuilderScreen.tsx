import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { useItineraryBuilder } from '../hooks/useTripOrganizer';

// --- Design tokens ---
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

// --- Types ---
type ActivityCategory = 'transport' | 'food' | 'activity' | 'accommodation' | 'free_time' | 'other';

interface Activity {
  id: string;
  time: string;
  name: string;
  category: ActivityCategory;
  description: string;
  location: string;
}

interface DayBlock {
  id: string;
  day_number: number;
  date: string;
  title: string;
  activities: Activity[];
}

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  transport: '#3B82F6',
  food: '#F97316',
  activity: TEAL,
  accommodation: '#8B5CF6',
  free_time: '#10B981',
  other: '#6B7280',
};

const CATEGORY_OPTIONS: { key: ActivityCategory; label: string }[] = [
  { key: 'transport', label: 'Transport' },
  { key: 'food', label: 'Food & Dining' },
  { key: 'activity', label: 'Activity / Tour' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'free_time', label: 'Free Time' },
  { key: 'other', label: 'Other' },
];

// --- Sub-components ---

const ActivityRow: React.FC<{
  activity: Activity;
  onEdit: () => void;
}> = ({ activity, onEdit }) => (
  <View style={styles.activityRow}>
    <Text style={styles.activityTime}>{activity.time}</Text>
    <View style={[styles.activityDot, { backgroundColor: CATEGORY_COLORS[activity.category] }]} />
    <Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text>
    <TouchableOpacity onPress={onEdit} style={styles.activityEditBtn}>
      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  </View>
);

const DayCard: React.FC<{
  day: DayBlock;
  onEditTitle: (title: string) => void;
  onAddActivity: () => void;
  onEditActivity: (activityId: string) => void;
}> = ({ day, onEditTitle, onAddActivity, onEditActivity }) => (
  <View style={styles.dayCard}>
    <View style={styles.dayHeader}>
      <Text style={styles.dayLabel}>DAY {day.day_number}</Text>
      <Text style={styles.dayDate}>{day.date}</Text>
    </View>
    <TextInput
      style={styles.dayTitleInput}
      value={day.title}
      onChangeText={onEditTitle}
      placeholder="Day title (e.g. Arrival Day)"
      placeholderTextColor="#9CA3AF"
    />
    {day.activities.map((act) => (
      <ActivityRow
        key={act.id}
        activity={act}
        onEdit={() => onEditActivity(act.id)}
      />
    ))}
    <TouchableOpacity style={styles.addActivityBtn} onPress={onAddActivity} activeOpacity={0.7}>
      <Ionicons name="add-circle-outline" size={20} color={TEAL} />
      <Text style={styles.addActivityText}>Add Activity</Text>
    </TouchableOpacity>
  </View>
);

// --- Activity Editor Modal ---

const ActivityEditorModal: React.FC<{
  visible: boolean;
  activity: Partial<Activity> | null;
  onSave: (activity: Partial<Activity>) => void;
  onClose: () => void;
}> = ({ visible, activity, onSave, onClose }) => {
  const [form, setForm] = useState<Partial<Activity>>(
    activity ?? { time: '', name: '', category: 'activity', description: '', location: '' }
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  React.useEffect(() => {
    if (activity) setForm(activity);
    else setForm({ time: '', name: '', category: 'activity', description: '', location: '' });
  }, [activity, visible]);

  const update = (partial: Partial<Activity>) => setForm((prev) => ({ ...prev, ...partial }));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{activity?.id ? 'Edit Activity' : 'New Activity'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Time */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Time</Text>
              <TextInput
                style={styles.modalInput}
                value={form.time}
                onChangeText={(v) => update({ time: v })}
                placeholder="e.g. 09:00 AM"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Name */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Activity Name</Text>
              <TextInput
                style={styles.modalInput}
                value={form.name}
                onChangeText={(v) => update({ name: v })}
                placeholder="e.g. Airport Transfer"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Category */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.categoryDropdown}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={[
                      styles.catDot,
                      { backgroundColor: CATEGORY_COLORS[form.category as ActivityCategory] ?? '#6B7280' },
                    ]}
                  />
                  <Text style={styles.categoryDropdownText}>
                    {CATEGORY_OPTIONS.find((c) => c.key === form.category)?.label ?? 'Select'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.categoryList}>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={styles.categoryItem}
                      onPress={() => { update({ category: cat.key }); setShowCategoryPicker(false); }}
                    >
                      <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat.key] }]} />
                      <Text style={[
                        styles.categoryItemText,
                        form.category === cat.key && { color: TEAL, fontWeight: typography.semibold },
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={(v) => update({ description: v })}
                placeholder="Brief description..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            {/* Location */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Location</Text>
              <TextInput
                style={styles.modalInput}
                value={form.location}
                onChangeText={(v) => update({ location: v })}
                placeholder="e.g. Houphouet-Boigny Airport"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </ScrollView>

          {/* Save */}
          <TouchableOpacity
            style={styles.modalSaveBtn}
            activeOpacity={0.7}
            onPress={() => onSave(form)}
          >
            <Text style={styles.modalSaveBtnText}>Save Activity</Text>
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

  const [days, setDays] = useState<DayBlock[]>(builder?.days ?? []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Partial<Activity> | null>(null);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);

  // Sync from hook when available
  React.useEffect(() => {
    if (builder?.days?.length) setDays(builder.days);
  }, [builder?.days]);

  const addDay = () => {
    const nextNum = days.length + 1;
    const newDay: DayBlock = {
      id: `day-${Date.now()}`,
      day_number: nextNum,
      date: '',
      title: '',
      activities: [],
    };
    setDays((prev) => [...prev, newDay]);
    builder?.addDay?.(newDay);
  };

  const updateDayTitle = (dayId: string, title: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, title } : d)));
  };

  const openActivityEditor = (dayId: string, activityId?: string) => {
    setEditingDayId(dayId);
    if (activityId) {
      const day = days.find((d) => d.id === dayId);
      const act = day?.activities.find((a) => a.id === activityId);
      setEditingActivity(act ?? null);
    } else {
      setEditingActivity(null);
    }
    setModalVisible(true);
  };

  const saveActivity = (form: Partial<Activity>) => {
    if (!editingDayId) return;

    setDays((prev) =>
      prev.map((day) => {
        if (day.id !== editingDayId) return day;
        if (form.id) {
          // Edit existing
          return {
            ...day,
            activities: day.activities.map((a) => (a.id === form.id ? { ...a, ...form } as Activity : a)),
          };
        }
        // Add new
        const newActivity: Activity = {
          id: `act-${Date.now()}`,
          time: form.time ?? '',
          name: form.name ?? '',
          category: (form.category as ActivityCategory) ?? 'other',
          description: form.description ?? '',
          location: form.location ?? '',
        };
        return { ...day, activities: [...day.activities, newActivity] };
      })
    );

    builder?.saveActivity?.(editingDayId, form);
    setModalVisible(false);
    setEditingActivity(null);
    setEditingDayId(null);
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
        <TouchableOpacity style={styles.previewBtn} activeOpacity={0.7}>
          <Text style={styles.previewBtnText}>Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {days.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No days added yet</Text>
            <Text style={styles.emptySubtitle}>Add your first day to start building the itinerary</Text>
          </View>
        ) : (
          days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              onEditTitle={(title) => updateDayTitle(day.id, title)}
              onAddActivity={() => openActivityEditor(day.id)}
              onEditActivity={(actId) => openActivityEditor(day.id, actId)}
            />
          ))
        )}

        {/* Add Day */}
        <TouchableOpacity style={styles.addDayBtn} activeOpacity={0.7} onPress={addDay}>
          <Ionicons name="add" size={22} color={TEAL} />
          <Text style={styles.addDayBtnText}>Add Day</Text>
        </TouchableOpacity>

        {/* Preview Public Page */}
        <TouchableOpacity style={styles.previewPageBtn} activeOpacity={0.7}>
          <Ionicons name="eye-outline" size={20} color={NAVY} style={{ marginRight: 8 }} />
          <Text style={styles.previewPageBtnText}>Preview Public Page</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Activity Editor Modal */}
      <ActivityEditorModal
        visible={modalVisible}
        activity={editingActivity}
        onSave={saveActivity}
        onClose={() => { setModalVisible(false); setEditingActivity(null); }}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  // Day Card
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
  // Activity
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
    width: 80,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  activityName: {
    flex: 1,
    fontSize: typography.body,
    color: NAVY,
  },
  activityEditBtn: {
    padding: spacing.xs,
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
  // Add Day
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
  // Preview page
  previewPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  previewPageBtnText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  // Empty state
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
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
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
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  categoryDropdownText: {
    fontSize: typography.body,
    color: NAVY,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  categoryList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.small,
    borderBottomRightRadius: radius.small,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryItemText: {
    fontSize: typography.body,
    color: NAVY,
  },
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
