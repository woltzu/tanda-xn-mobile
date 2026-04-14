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
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { TripOrganizerEngine } from '../services/TripOrganizerEngine';

const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

const CATEGORIES = [
  { id: 'Arrival', label: 'Arrival', emoji: '\u2708\uFE0F' },
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

const ActivityEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    tripId = '',
    dayId = '',
    activityId,
    existingData,
  } = route.params ?? {};

  const isEditing = !!activityId;

  const [name, setName] = useState(existingData?.name ?? '');
  const [startTime, setStartTime] = useState(existingData?.startTime ?? '');
  const [endTime, setEndTime] = useState(existingData?.endTime ?? '');
  const [category, setCategory] = useState(existingData?.category ?? 'Other');
  const [description, setDescription] = useState(existingData?.description ?? '');
  const [location, setLocation] = useState(existingData?.location ?? '');
  const [organizerNote, setOrganizerNote] = useState(existingData?.organizerNote ?? '');

  const mapsUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : '';

  const handleOpenMaps = () => {
    if (mapsUrl) {
      Linking.openURL(mapsUrl);
    }
  };

  const handleSave = async () => {
    try {
      if (isEditing && activityId) {
        await TripOrganizerEngine.updateActivity(activityId, {
          title: name,
          startTime,
          endTime,
          description,
          location,
          categoryTag: category,
        });
      } else if (dayId) {
        await TripOrganizerEngine.addActivity(dayId, {
          title: name,
          startTime,
          endTime,
          description,
          location,
          categoryTag: category,
          sortOrder: 0,
        });
      }
      navigation.goBack();
    } catch (err) {
      console.warn('[ActivityEditor] Save error:', err);
    }
  };

  const handleDelete = async () => {
    try {
      if (activityId) {
        await TripOrganizerEngine.deleteActivity(activityId);
      }
      navigation.goBack();
    } catch (err) {
      console.warn('[ActivityEditor] Delete error:', err);
    }
  };

  const selectedCat = CATEGORIES.find((c) => c.id === category);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Activity' : 'New Activity'}</Text>
        {isEditing ? (
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Activity Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Activity Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Eagle Beach \u2014 Golden Hour"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Time row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Start</Text>
              <TextInput
                style={styles.textInput}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="4:30 PM"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>End</Text>
              <TextInput
                style={styles.textInput}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="6:00 PM"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Category picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    category === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive,
                  ]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Description</Text>
              <Text style={styles.labelHint}>sell it</Text>
            </View>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="White sand, turquoise water, and the sun painting everything gold..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Location --- key field that powers Maps link */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location (for Maps link)</Text>
            <TextInput
              style={[styles.textInput, location ? styles.textInputDone : undefined]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Eagle Beach, Aruba"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Maps preview --- appears when location is entered */}
          {location.length > 2 && (
            <TouchableOpacity style={styles.mapPreview} onPress={handleOpenMaps} activeOpacity={0.8}>
              <View style={styles.mapGrid} />
              <Text style={styles.mapPin}>{'\uD83D\uDCCD'}</Text>
              <Text style={styles.mapLabel}>{location}</Text>
              <View style={styles.mapBtn}>
                <Text style={styles.mapBtnText}>View on Maps</Text>
                <Ionicons name="arrow-forward" size={12} color={TEAL} />
              </View>
            </TouchableOpacity>
          )}

          {/* Organizer Note */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Organizer Note</Text>
              <Text style={styles.labelHint}>optional</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={organizerNote}
              onChangeText={setOrganizerNote}
              placeholder='e.g. "Bring sunscreen"'
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>Save Activity</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ActivityEditorScreen;

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
    minWidth: 50,
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: '700' as const,
    color: NAVY,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: NAVY,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: NAVY,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textInputDone: {
    borderColor: 'rgba(0,198,174,0.4)',
  },
  row: {
    flexDirection: 'row',
  },
  categoryScroll: {
    flexGrow: 0,
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
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  // --- Maps preview ---
  mapPreview: {
    height: 90,
    backgroundColor: '#0D2030',
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.2)',
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  mapPin: {
    fontSize: 28,
    marginBottom: 2,
  },
  mapLabel: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    fontSize: 12,
    color: TEAL,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapBtn: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mapBtnText: {
    fontSize: 11,
    color: TEAL,
    fontWeight: '600',
    marginRight: 4,
  },
  // --- Footer ---
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: radius.button,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
