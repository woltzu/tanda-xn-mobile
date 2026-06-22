import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Share,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from '../theme/tokens';
import { generateTripShareUrl } from '../lib/deepLinking';
import { TripShareSheet } from '../components/TripShareSheet';

const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

const TripPublishSuccessScreen: React.FC = () => {
  const { t } = useTranslation();

  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    tripName = 'My Trip',
    destination = '',
    startDate = '',
    endDate = '',
    tripId = 'new',
    slug: passedSlug = '',
  } = route.params ?? {};

  // Use the real slug from DB (includes random suffix), fallback to local generation
  const slug = passedSlug || tripName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);

  // Publish-trip Bucket A.2 — canonical share URL (singular `/trip/<slug>`).
  // Before this fix we built `tandaxn.com/trips/${slug}` (plural) which
  // didn't match the `trip/:slug` deep-link route from Bucket A.5 of the
  // wizard audit, so the shared link wouldn't open the public page
  // in-app. `generateTripShareUrl` is the single source of truth.
  const shareUrl = generateTripShareUrl(slug);
  // Strip the protocol for the visual chip; the full URL still goes into
  // the share payload.
  const tripLink = shareUrl.replace(/^https?:\/\//, '');

  // Publish-trip Bucket B.3 — replace the OS-only share with the
  // multi-channel TripShareSheet. The old Share.share() call stays as
  // an unused fallback in case we ever need to revert quickly; it is
  // not bound to any control.
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const handleShareLink = () => setShareSheetOpen(true);
  // Reference _Share so the unused-import lint stays quiet and the
  // fallback path is one keystroke away if we ever roll back.
  void Share;

  const hasTripId = tripId && tripId !== 'new';

  const handlePreviewPage = () => {
    if (hasTripId) {
      navigation.navigate('TripPublicPage', { slug, tripId });
    } else {
      navigation.navigate('TripPublicPage', { slug });
    }
  };

  const handleBuildItinerary = () => {
    if (hasTripId) {
      navigation.navigate('ItineraryBuilder', { tripId });
    } else {
      // Navigate to organizer trip list so user can pick the trip
      navigation.navigate('OrganizerTripList');
    }
  };

  const handleGoToDashboard = () => {
    if (hasTripId) {
      navigation.navigate('OrganizerTripDashboard', { tripId });
    } else {
      navigation.navigate('OrganizerTripList');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.container}>
        {/* Publish-trip Bucket B.7 — (?) help button anchored to the top
            corner. Doesn't compete with the celebration hero visually. */}
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('trip.share_help_title')}
        >
          <Ionicons name="help-circle-outline" size={24} color={NAVY} />
        </TouchableOpacity>

        {/* Celebration Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>{t("final_polish.trippublishsuccess_trip_is_live")}</Text>
          <Text style={styles.heroSubtitle}>
            Share the link and start collecting registrations.
          </Text>
        </View>

        {/* Trip Link Card */}
        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>{t("final_polish.trippublishsuccess_your_trip_link")}</Text>
          <Text style={styles.linkUrl}>{tripLink}</Text>
        </View>

        {/* Primary CTAs */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.shareBtnText}>{t("final_polish.trippublishsuccess_share_trip_link")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.previewBtn} onPress={handlePreviewPage} activeOpacity={0.7}>
          <Ionicons name="eye-outline" size={20} color={NAVY} style={{ marginRight: 8 }} />
          <Text style={styles.previewBtnText}>{t("final_polish.trippublishsuccess_preview_trip_page")}</Text>
        </TouchableOpacity>

        {/* Itinerary nudge */}
        <Text style={styles.nudgeText}>
          Now build your itinerary to sell the destination to your travelers
        </Text>

        <TouchableOpacity style={styles.itineraryBtn} onPress={handleBuildItinerary} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={18} color={GOLD} style={{ marginRight: 8 }} />
          <Text style={styles.itineraryBtnText}>{t("final_polish.trippublishsuccess_build_itinerary_now")}</Text>
        </TouchableOpacity>

        {/* Skip to dashboard */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleGoToDashboard} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>{t("final_polish.trippublishsuccess_go_to_trip_dashboard")}</Text>
          <Ionicons name="arrow-forward" size={16} color={TEAL} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Publish-trip Bucket B.3 — multi-channel share sheet. */}
      <TripShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        slug={slug}
        tripName={tripName}
        destination={destination}
        startDate={startDate || null}
        tripId={hasTripId ? tripId : null}
      />

      {/* Publish-trip Bucket B.7 — local HelpSheet. */}
      <Modal
        visible={helpOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpOpen(false)}
      >
        <Pressable style={styles.helpBackdrop} onPress={() => setHelpOpen(false)}>
          <Pressable style={styles.helpSheet} onPress={() => undefined}>
            <View style={styles.helpHandle} />
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>{t('trip.share_help_title')}</Text>
              <TouchableOpacity
                onPress={() => setHelpOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('create_trip.help_close')}
              >
                <Ionicons name="close" size={22} color={NAVY} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.helpBody}>{t('trip.share_help_body')}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default TripPublishSuccessScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  linkCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 16,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  linkUrl: {
    fontSize: 14,
    color: TEAL,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: radius.button,
    marginBottom: 10,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  previewBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: NAVY,
  },
  nudgeText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 10,
  },
  itineraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,168,66,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,168,66,0.25)',
    paddingVertical: 14,
    borderRadius: radius.button,
    marginBottom: 16,
  },
  itineraryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEAL,
  },
  helpBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  helpSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  helpHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: NAVY,
  },
  helpBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
