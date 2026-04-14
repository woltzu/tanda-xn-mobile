import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, typography, spacing } from '../theme/tokens';

const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const GOLD = '#E8A842';
const BG = '#F5F7FA';

const TripPublishSuccessScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    tripName = 'My Trip',
    destination = '',
    startDate = '',
    endDate = '',
    tripId = 'new',
  } = route.params ?? {};

  // Generate a slug from the trip name
  const slug = tripName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);

  const tripLink = `tandaxn.com/trips/${slug}`;

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Join my trip: ${tripName}!\n\nhttps://${tripLink}`,
        title: tripName,
      });
    } catch (_) {
      // User cancelled share
    }
  };

  const handlePreviewPage = () => {
    navigation.navigate('TripPublicPage', { slug, tripId });
  };

  const handleBuildItinerary = () => {
    navigation.navigate('ItineraryBuilder', { tripId });
  };

  const handleGoToDashboard = () => {
    navigation.navigate('OrganizerTripDashboard', { tripId });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.container}>
        {/* Celebration Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>Trip is Live!</Text>
          <Text style={styles.heroSubtitle}>
            Share the link and start collecting registrations.
          </Text>
        </View>

        {/* Trip Link Card */}
        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>YOUR TRIP LINK</Text>
          <Text style={styles.linkUrl}>{tripLink}</Text>
        </View>

        {/* Primary CTAs */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.shareBtnText}>Share Trip Link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.previewBtn} onPress={handlePreviewPage} activeOpacity={0.7}>
          <Ionicons name="eye-outline" size={20} color={NAVY} style={{ marginRight: 8 }} />
          <Text style={styles.previewBtnText}>Preview Trip Page</Text>
        </TouchableOpacity>

        {/* Itinerary nudge */}
        <Text style={styles.nudgeText}>
          Now build your itinerary to sell the destination to your travelers
        </Text>

        <TouchableOpacity style={styles.itineraryBtn} onPress={handleBuildItinerary} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={18} color={GOLD} style={{ marginRight: 8 }} />
          <Text style={styles.itineraryBtnText}>Build Itinerary Now</Text>
        </TouchableOpacity>

        {/* Skip to dashboard */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleGoToDashboard} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Go to Trip Dashboard</Text>
          <Ionicons name="arrow-forward" size={16} color={TEAL} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
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
});
