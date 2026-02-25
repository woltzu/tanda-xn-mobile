import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  ViewStyle,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/tokens";

interface VideoPlayerProps {
  uri: string;
  style?: ViewStyle;
  showControls?: boolean;
  autoplay?: boolean;
  thumbnailMode?: boolean;
}

export default function VideoPlayer({
  uri,
  style,
  showControls = true,
  autoplay = false,
  thumbnailMode = false,
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      setIsPlaying(status.isPlaying);
      setIsBuffering(status.isBuffering);
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (err) {
      console.warn("[VideoPlayer] Play/pause error:", err);
    }
  };

  if (hasError) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={autoplay}
        isLooping={false}
        useNativeControls={showControls && !thumbnailMode}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(err) => {
          console.warn("[VideoPlayer] Error:", err);
          setHasError(true);
        }}
      />

      {/* Loading overlay */}
      {!isLoaded && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      )}

      {/* Buffering indicator */}
      {isBuffering && isLoaded && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {/* Play button overlay for thumbnail mode */}
      {thumbnailMode && isLoaded && !isPlaying && (
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={togglePlayPause}
          activeOpacity={0.8}
        >
          <View style={styles.playButton}>
            <Ionicons name="play" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Pause overlay (tap to pause in thumbnail mode) */}
      {thumbnailMode && isPlaying && (
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={togglePlayPause}
          activeOpacity={1}
        />
      )}

      {/* Video badge */}
      <View style={styles.videoBadge}>
        <Ionicons name="videocam" size={12} color="#FFFFFF" />
        <Text style={styles.videoBadgeText}>VIDEO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 4 / 3,
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
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
