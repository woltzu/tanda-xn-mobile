// ══════════════════════════════════════════════════════════════════════════
// TripShareSheet — Publish-trip Bucket B.1 + B.2
// ══════════════════════════════════════════════════════════════════════════
//
// Bottom-sheet share picker with platform-specific channels. Mounted by
// TripPublishSuccessScreen, TripPublicPage, and OrganizerTripDashboard
// (Bucket B.3). Replaces the single OS-share button that shipped in
// Bucket A.
//
// Each channel uses the platform's native deep-link scheme (e.g.
// `instagram://share`, `twitter://post`). If the app isn't installed
// on this device, the corresponding `https://...` web-intent URL is
// used instead so the share still completes — important because most
// users don't have all 4 native apps installed.
//
// Templates are i18n-keyed so the EN/FR pairs can ship with platform-
// appropriate phrasing (Instagram + TikTok caption-only, X + Facebook
// full URL with hashtags).
// ══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, typography, spacing } from '../theme/tokens';
import { generateTripShareUrl } from '../lib/deepLinking';
import { showToast } from './Toast';
import { useEventTracker } from '../hooks/useEventTracker';

const NAVY = '#0A2342';

// Channel ids match the i18n key suffix in the share template family
// (trip.share_template_<id>) so the lookup stays mechanical.
type Channel = 'copy' | 'instagram' | 'tiktok' | 'x' | 'facebook' | 'more';

// Sanitize destination into a hashtag-safe slug for the template's
// {{destinationTag}} placeholder. "Abidjan, Côte d'Ivoire" → "Abidjan".
// Strips diacritics, drops non-alphanumerics, keeps the first word.
function destinationToTag(destination: string): string {
  if (!destination) return '';
  const first = destination
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)[0] ?? '';
  return first;
}

interface TripShareSheetProps {
  visible: boolean;
  onClose: () => void;
  slug: string;
  tripName: string;
  destination: string;
  // ISO date string; passed through to template variables.
  startDate?: string | null;
  // Publish-trip Bucket C.1 — tripId is optional in this prop list because
  // some entry points (the public page without tripId in the route) still
  // open the sheet purely from slug. When present, every telemetry event
  // gets enriched with it so funnel analytics can join back to the trip.
  tripId?: string | null;
}

export function TripShareSheet({
  visible,
  onClose,
  slug,
  tripName,
  destination,
  startDate,
  tripId,
}: TripShareSheetProps) {
  const { t } = useTranslation();
  const { track } = useEventTracker();

  // Publish-trip Bucket C.1 — fire `trip.share_opened` exactly once per
  // visible->hidden cycle. The Modal mounts even when hidden, so we gate
  // on `visible` changing to true and reset when it flips false.
  const openedFiredRef = useRef(false);
  useEffect(() => {
    if (visible && !openedFiredRef.current) {
      openedFiredRef.current = true;
      track({
        eventType: 'trip.share_opened',
        eventCategory: 'cross_border',
        eventAction: 'open',
        eventLabel: 'trip_share_sheet',
        eventValue: { trip_id: tripId ?? null, slug: slug ?? null },
      });
    }
    if (!visible) {
      openedFiredRef.current = false;
    }
  }, [visible, tripId, slug, track]);

  // Telemetry helper for channel taps. Fires before the channel-specific
  // handler runs so we capture the user intent even if the deep-link/
  // web-intent fallback throws.
  const trackChannel = (channel: Channel) => {
    track({
      eventType: 'trip.share_channel_selected',
      eventCategory: 'cross_border',
      eventAction: 'select',
      eventLabel: channel,
      eventValue: { trip_id: tripId ?? null, slug: slug ?? null, channel },
    });
  };

  // Generate the canonical share URL once per render. generateTripShareUrl
  // emits the singular `/trip/<slug>` form (Bucket A.1) so all channels
  // share the same URL and any deep-link analytics line up.
  const shareUrl = slug ? generateTripShareUrl(slug) : '';

  // Pre-render the template variables; t() interpolates them per call.
  const vars = {
    trip_name: tripName || 'a trip',
    destination: destination || '',
    destinationTag: destinationToTag(destination),
    start_date: startDate ? formatShortDate(startDate) : '',
    url: shareUrl,
  };

  // Resolve the per-platform message body. Instagram + TikTok templates
  // intentionally omit the URL (those platforms don't honour links in
  // captions); X + Facebook templates include it.
  const messageFor = (channel: Channel): string => {
    const key = `trip.share_template_${channel === 'copy' || channel === 'more' ? 'x' : channel}`;
    return t(key, vars);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    trackChannel('copy');
    try {
      await Clipboard.setStringAsync(shareUrl);
      showToast(t('trip.share_copy_success'), 'success');
    } catch {
      showToast(t('trip.share_copy_error'), 'error');
    }
    onClose();
  };

  // Attempt native deep link first; fall back to web intent URL when the
  // app isn't installed. The fallback URL is always opened with the share
  // payload pre-filled so the user can finish posting from a browser tab.
  const openWithFallback = async (
    nativeUrl: string,
    fallbackUrl: string,
    label: string,
  ) => {
    try {
      const supported = await Linking.canOpenURL(nativeUrl);
      if (supported) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(fallbackUrl);
      }
    } catch (err: any) {
      console.warn(`[TripShareSheet.${label}] open failed`, err);
      showToast(t('trip.share_channel_error', { channel: label }), 'error');
    } finally {
      onClose();
    }
  };

  const handleInstagram = () => {
    trackChannel('instagram');
    const msg = messageFor('instagram');
    // Instagram doesn't support a public web share intent; the deep link
    // opens the Stories composer. If the app isn't installed, route to
    // instagram.com so the user knows what platform they were headed for.
    return openWithFallback(
      `instagram://share?text=${encodeURIComponent(msg)}`,
      'https://www.instagram.com/',
      'Instagram',
    );
  };

  const handleTikTok = () => {
    trackChannel('tiktok');
    const msg = messageFor('tiktok');
    return openWithFallback(
      `tiktok://share?text=${encodeURIComponent(msg)}`,
      'https://www.tiktok.com/',
      'TikTok',
    );
  };

  const handleX = () => {
    trackChannel('x');
    const msg = messageFor('x');
    return openWithFallback(
      `twitter://post?message=${encodeURIComponent(msg)}`,
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`,
      'X',
    );
  };

  const handleFacebook = () => {
    trackChannel('facebook');
    const msg = messageFor('facebook');
    // Facebook's `quote` parameter is only honoured when a real URL is
    // also passed via `u`. We pass both so the share dialog pre-fills
    // both the link card and the user's caption.
    return openWithFallback(
      `fb://share/?text=${encodeURIComponent(msg)}`,
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(msg)}`,
      'Facebook',
    );
  };

  const handleMore = async () => {
    trackChannel('more');
    try {
      await Share.share({
        message: messageFor('more'),
        title: tripName,
      });
    } catch {
      // User cancelled — no-op.
    }
    onClose();
  };

  const channels: Array<{
    id: Channel;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: () => void;
  }> = [
    { id: 'copy',      label: t('trip.share_copy_link'), icon: 'copy-outline',          color: NAVY,      onPress: handleCopy },
    { id: 'instagram', label: 'Instagram',               icon: 'logo-instagram',        color: '#E4405F', onPress: handleInstagram },
    { id: 'tiktok',    label: 'TikTok',                  icon: 'musical-notes-outline', color: '#000000', onPress: handleTikTok },
    { id: 'x',         label: 'X',                       icon: 'logo-twitter',          color: '#000000', onPress: handleX },
    { id: 'facebook',  label: 'Facebook',                icon: 'logo-facebook',         color: '#1877F2', onPress: handleFacebook },
    { id: 'more',      label: t('trip.share_more'),      icon: 'ellipsis-horizontal',   color: '#6B7280', onPress: handleMore },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('trip.share_sheet_title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('create_trip.help_close')}
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>

          {/* URL chip — gives the user a confirmation of what's being shared. */}
          {!!shareUrl && (
            <View style={styles.urlChip}>
              <Ionicons name="link-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.urlChipText} numberOfLines={1}>
                {shareUrl.replace(/^https?:\/\//, '')}
              </Text>
            </View>
          )}

          <View style={styles.grid}>
            {channels.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.channelBtn}
                activeOpacity={0.7}
                onPress={c.onPress}
                accessibilityRole="button"
                accessibilityLabel={c.label}
              >
                <View style={[styles.channelIcon, { backgroundColor: c.color + '15' }]}>
                  <Ionicons name={c.icon} size={26} color={c.color} />
                </View>
                <Text style={styles.channelLabel} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Same compact format used elsewhere — locale-agnostic short date.
function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: NAVY,
  },
  urlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.small,
    marginBottom: spacing.lg,
  },
  urlChipText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // 3-column grid; channelBtn width = (100% / 3) - gap accounting.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  channelBtn: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  channelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  channelLabel: {
    fontSize: typography.bodySmall,
    color: NAVY,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
});
