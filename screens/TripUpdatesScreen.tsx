// ══════════════════════════════════════════════════════════════════════════
// TripUpdatesScreen — Publish-trip Bucket B.4
// ══════════════════════════════════════════════════════════════════════════
//
// Read-only feed of trip-wide broadcast messages (trip_messages with
// recipient_type='all') with a composer at the top visible only to the
// organizer. Real-time subscription via Supabase channel — when a new
// row lands we prepend it without a refetch.
//
// When entered with `initialActivityId` (e.g. via the "Post update"
// button on ItineraryBuilder — Bucket B.5), the composer pre-fills a
// reference line and attaches the activity_id to the row INSERT so the
// chip renders on the message card.
// ══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, radius, typography, spacing } from '../theme/tokens';
import {
  TripOrganizerEngine,
  type TripMessage,
  type TripActivity,
  type TripDay,
} from '../services/TripOrganizerEngine';
import { useAuth } from '../context/AuthContext';
import { useTripDashboard, useItineraryBuilder } from '../hooks/useTripOrganizer';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

const NAVY = '#0A2342';
const TEAL = '#00C6AE';

interface ProfileLite {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const TripUpdatesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const tripId: string = route.params?.tripId ?? '';
  const initialActivityId: string | null = route.params?.initialActivityId ?? null;
  const prefilledMessage: string = route.params?.prefilledMessage ?? '';

  // Organizer flag drives composer visibility — participants get a
  // read-only feed. We lean on useTripDashboard's existing trip lookup
  // so we don't duplicate the query path.
  const dashboard = useTripDashboard(tripId);
  const organizerId = dashboard?.dashboard?.trip?.organizerId ?? null;
  const isOrganizer = !!user?.id && !!organizerId && user.id === organizerId;

  // Pull the itinerary so we can resolve activityId → name + day for the
  // chip. The list is usually short (<= a few dozen activities), so
  // looping is cheaper than a per-message join.
  const itinerary = useItineraryBuilder(tripId);
  const activitiesById = useMemo(() => {
    const map = new Map<string, { activity: TripActivity; day: TripDay }>();
    for (const d of itinerary?.days ?? []) {
      for (const a of d.activities ?? []) {
        map.set(a.id, { activity: a, day: d });
      }
    }
    return map;
  }, [itinerary?.days]);

  // ── Feed state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [composer, setComposer] = useState(prefilledMessage);
  const [sending, setSending] = useState(false);

  // Initial fetch + realtime subscribe.
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const all = await TripOrganizerEngine.getTripMessages(tripId, 'all');
        if (cancelled) return;
        // Engine returns oldest-first; reverse so the latest sits at top.
        const sorted = [...all].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setMessages(sorted);
      } catch (err) {
        console.warn('[TripUpdatesScreen] fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  // Realtime: prepend INSERTs that target this trip + recipient_type='all'.
  // The channel filter on tripId is already in subscribeToMessages; we
  // still gate by recipient_type because the same channel will eventually
  // also fire for direct messages.
  useEffect(() => {
    if (!tripId) return;
    const channel = TripOrganizerEngine.subscribeToMessages(tripId, (payload: any) => {
      const row = payload?.new;
      if (!row || row.recipient_type !== 'all') return;
      setMessages((prev) => {
        // De-dup in case our own optimistic insert landed first.
        if (prev.some((m) => m.id === row.id)) return prev;
        return [
          {
            id: row.id,
            tripId: row.trip_id,
            senderId: row.sender_id,
            recipientId: row.recipient_id,
            recipientType: row.recipient_type ?? 'all',
            activityId: row.activity_id ?? null,
            body: row.message_body ?? '',
            readAt: row.read_at ?? null,
            createdAt: row.sent_at ?? row.created_at ?? new Date().toISOString(),
          },
          ...prev,
        ];
      });
    });
    return () => { channel?.unsubscribe?.(); };
  }, [tripId]);

  // Batch profile fetch for sender_ids we haven't seen. One query per
  // batch of new ids; cached by id in the profiles map.
  useEffect(() => {
    const need = Array.from(
      new Set(messages.map((m) => m.senderId).filter((id) => id && !profiles[id])),
    );
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', need);
      if (cancelled || error) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data ?? []) next[p.id] = p as ProfileLite;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [messages, profiles]);

  const handleSend = useCallback(async () => {
    const body = composer.trim();
    if (!body) return;
    if (!user?.id) {
      showToast(t('trip_updates.send_login_required'), 'error');
      return;
    }
    setSending(true);
    try {
      await TripOrganizerEngine.sendBroadcast(tripId, user.id, body, initialActivityId);
      // Realtime will deliver the row; clear the composer either way.
      setComposer('');
      showToast(t('trip_updates.send_success'), 'success');
    } catch (err: any) {
      console.warn('[TripUpdatesScreen] send failed:', err);
      showToast(err?.message || t('trip_updates.send_error'), 'error');
    } finally {
      setSending(false);
    }
  }, [composer, user?.id, tripId, initialActivityId, t]);

  const renderActivityChip = (activityId: string | null) => {
    if (!activityId) return null;
    const ref = activitiesById.get(activityId);
    if (!ref) return null;
    return (
      <View style={styles.activityChip}>
        <Ionicons name="map-outline" size={11} color={TEAL} />
        <Text style={styles.activityChipText}>
          {t('trip_updates.connected_to_activity', {
            activity: ref.activity.title,
            day: ref.day.dayNumber,
          })}
        </Text>
      </View>
    );
  };

  const renderMessage = (msg: TripMessage) => {
    const profile = profiles[msg.senderId];
    const name = profile?.display_name || profile?.full_name || t('trip_updates.unknown_sender');
    const time = formatTime(msg.createdAt);
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
      <View key={msg.id} style={styles.messageCard}>
        <View style={styles.messageHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.senderName}>{name}</Text>
            <Text style={styles.messageTime}>{time}</Text>
          </View>
        </View>
        {renderActivityChip(msg.activityId)}
        <Text style={styles.messageBody}>{msg.body}</Text>
      </View>
    );
  };

  // Pre-fill chip shown above the composer when entered via ItineraryBuilder
  // — confirms which activity the next message will be attached to.
  const prefillRef = useRef<string | null>(initialActivityId);
  useEffect(() => { prefillRef.current = initialActivityId; }, [initialActivityId]);
  const prefillActivity = initialActivityId ? activitiesById.get(initialActivityId) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('trip_updates.title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Composer — organizer only. */}
        {isOrganizer && (
          <View style={styles.composer}>
            {prefillActivity && (
              <View style={styles.prefillChip}>
                <Ionicons name="link-outline" size={12} color={TEAL} />
                <Text style={styles.prefillChipText} numberOfLines={1}>
                  {t('trip_updates.posting_about', {
                    activity: prefillActivity.activity.title,
                    day: prefillActivity.day.dayNumber,
                  })}
                </Text>
              </View>
            )}
            <TextInput
              style={styles.composerInput}
              value={composer}
              onChangeText={setComposer}
              placeholder={t('trip_updates.placeholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!composer.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!composer.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>{t('trip_updates.send')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Feed */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={TEAL} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>{t('trip_updates.empty')}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(renderMessage)}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TripUpdatesScreen;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 36e5;
    if (diffH < 24) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
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
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.bodyLarge, fontWeight: typography.bold, color: NAVY },

  composer: {
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,198,174,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  prefillChipText: {
    fontSize: 11,
    color: TEAL,
    fontWeight: typography.semibold,
  },
  composerInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: typography.body,
    color: NAVY,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#FFFFFF', fontWeight: typography.semibold, fontSize: typography.body },

  feed: { flex: 1 },
  feedContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },

  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: NAVY, fontWeight: typography.bold, fontSize: 14 },
  senderName: { fontSize: typography.body, fontWeight: typography.semibold, color: NAVY },
  messageTime: { fontSize: typography.label, color: colors.textSecondary, marginTop: 2 },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,198,174,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  activityChipText: { fontSize: 11, color: TEAL, fontWeight: typography.semibold },
  messageBody: { fontSize: typography.body, color: NAVY, lineHeight: 20 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
  emptyTitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
