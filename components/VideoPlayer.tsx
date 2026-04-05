import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  ViewStyle,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent, useEventListener } from "expo";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/tokens";

interface VideoPlayerProps {
  uri: string;
  style?: ViewStyle;
  showControls?: boolean;
  autoplay?: boolean;
  thumbnailMode?: boolean;
  /** Disable touch overlays so scroll gestures pass through */
  disableTouch?: boolean;
  /** Aspect ratio override (default 4/3) */
  aspectRatio?: number;
}

export default function VideoPlayer({
  uri,
  style,
  showControls = true,
  autoplay = false,
  thumbnailMode = false,
  disableTouch = false,
  aspectRatio = 4 / 3,
}: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);

  // Create player instance with expo-video hook
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    if (autoplay) {
      p.play();
    }
  });

  // Track playing state reactively
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  // Track player status (idle → loading → readyToPlay → error)
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  const isLoaded = status === "readyToPlay";
  const isBuffering = status === "loading";

  // Listen for errors
  useEventListener(player, "statusChange", ({ status: newStatus, error }) => {
    if (newStatus === "error") {
      console.warn("[VideoPlayer] Error:", error);
      setHasError(true);
    }
  });

  const togglePlayPause = useCallback(() => {
    if (disableTouch) return;
    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.warn("[VideoPlayer] Play/pause error:", err);
    }
  }, [disableTouch, isPlaying, player]);

  if (hasError) {
    return (
      <View style={[styles.container, { aspectRatio }, styles.errorContainer, style]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { aspectRatio }, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={showControls && !thumbnailMode}
      />

      {/* Loading overlay — pointerEvents none so scroll passes through */}
      {!isLoaded && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      )}

      {/* Buffering indicator */}
      {isBuffering && isLoaded && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {/* Centered play button — only when paused and not disableTouch */}
      {thumbnailMode && isLoaded && !isPlaying && !disableTouch && (
        <Pressable
          style={styles.playCenter}
          onPress={togglePlayPause}
        >
          <View style={styles.playButton}>
            <Ionicons name="play" size={28} color="#FFFFFF" />
          </View>
        </Pressable>
      )}

      {/* Tap to pause — only when playing, not disableTouch */}
      {thumbnailMode && isPlaying && !disableTouch && (
        <Pressable
          style={styles.tapOverlay}
          onPress={togglePlayPause}
        />
      )}

      {/* Video badge */}
      <View style={styles.videoBadge} pointerEvents="none">
        <Ionicons name="videocam" size={12} color="#FFFFFF" />
        <Text style={styles.videoBadgeText}>VIDEO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  bufferingOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    padding: 6,
  },
  playCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -28,
    marginLeft: -28,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 198, 174, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  videoBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  videoBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
});
