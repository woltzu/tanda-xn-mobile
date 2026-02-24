import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ToastType = "success" | "error" | "info";

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
};

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; color: string; iconColor: string }> = {
  success: {
    icon: "checkmark-circle",
    bg: "#ECFDF5",
    color: "#065F46",
    iconColor: "#10B981",
  },
  error: {
    icon: "alert-circle",
    bg: "#FEF2F2",
    color: "#991B1B",
    iconColor: "#EF4444",
  },
  info: {
    icon: "information-circle",
    bg: "#EFF6FF",
    color: "#1E40AF",
    iconColor: "#3B82F6",
  },
};

export default function Toast({
  visible,
  message,
  type = "success",
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const config = TOAST_CONFIG[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.8}
        onPress={dismiss}
      >
        <Ionicons name={config.icon as any} size={22} color={config.iconColor} />
        <Text style={[styles.message, { color: config.color }]} numberOfLines={2}>
          {message}
        </Text>
        <Ionicons name="close" size={16} color={config.color} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});

// ============================================
// Global Toast Manager (singleton)
// ============================================

type ToastRequest = {
  message: string;
  type: ToastType;
  duration?: number;
};

let _showToast: ((req: ToastRequest) => void) | null = null;

export function registerToastHandler(handler: (req: ToastRequest) => void) {
  _showToast = handler;
}

/**
 * Show a toast notification from anywhere in the app.
 * Usage: showToast("Goal created successfully!", "success")
 */
export function showToast(message: string, type: ToastType = "success", duration?: number) {
  if (_showToast) {
    _showToast({ message, type, duration });
  } else {
    console.warn("[Toast] No toast handler registered");
  }
}
