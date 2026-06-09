// ══════════════════════════════════════════════════════════════════════════════
// screens/WebViewScreen.tsx — Generic in-app web-view shell
// ══════════════════════════════════════════════════════════════════════════════
//
// Reusable wrapper around react-native-webview. Primary current consumer is
// KYC (Persona-style providers redirect to a hosted inquiry URL that the user
// completes in-app). Also usable for terms-of-service, legal docs, etc.
//
// Route params:
//   url        (required) — the URL to load
//   title      (optional) — header text; defaults to "Web View"
//   onComplete (optional) — function called when the embedded page posts
//                           "KYC_COMPLETE" via window.ReactNativeWebView
//                           .postMessage(). The host can use this to refresh
//                           server-side state after the user finishes the
//                           flow.
//
// Registered as a root-stack Modal in App.tsx, so navigating here pops over
// any current tab without losing the user's context. Back button calls
// navigation.goBack().
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from "react-i18next";
import { Ionicons } from '@expo/vector-icons';
import { useTypedNavigation } from '../hooks/useTypedNavigation';

type WebViewRouteParams = {
  url: string;
  title?: string;
  onComplete?: () => void;
};

type WebViewRouteProp = RouteProp<{ WebView: WebViewRouteParams }, 'WebView'>;

const NAVY = '#0A2342';
const TEAL = '#00C6AE';

export default function WebViewScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<WebViewRouteProp>();
  const { url, title = 'Web View', onComplete } = route.params ?? {};

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Guard: a missing url means caller forgot a param. Surface and bail rather
  // than render an empty WebView that silently does nothing.
  if (!url) {
    // Alert.alert is async — schedule navigation back in a microtask so the
    // alert can render before we pop. Returning null below keeps the render
    // tree empty until that pop fires.
    setTimeout(() => {
      Alert.alert('Error', 'No URL provided.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }, 0);
    return null;
  }

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    if (data === 'KYC_COMPLETE') {
      if (onComplete) onComplete();
      navigation.goBack();
    }
  };

  const handleError = () => {
    if (hasError) return; // de-dupe — RN-WebView fires multiple error events
    setHasError(true);
    Alert.alert(
      'Could not load page',
      'Check your internet connection and try again.',
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading overlay — shown until onLoadEnd fires */}
      {loading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      <WebView
        source={{ uri: url }}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        onHttpError={handleError}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        // Keep file access disabled — not needed for hosted KYC/terms pages.
        allowFileAccess={false}
        allowsFullscreenVideo={false}
        // Surface decideAndLoad failures to onError above.
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 80,
  },
  backText: {
    fontSize: 16,
    color: NAVY,
    marginLeft: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: NAVY,
  },
  headerSpacer: {
    width: 80,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});
