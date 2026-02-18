import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const LAST_ACTIVITY_KEY = "@tandaxn_last_activity";

interface UseInactivityLockProps {
  onLock: () => void;
  isAuthenticated: boolean;
  isLocked: boolean;
}

export function useInactivityLock({
  onLock,
  isAuthenticated,
  isLocked,
}: UseInactivityLockProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // Reset the inactivity timer
  const resetTimer = useCallback(async () => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timer if authenticated and not already locked
    if (isAuthenticated && !isLocked) {
      // Store last activity time
      await AsyncStorage.setItem(
        LAST_ACTIVITY_KEY,
        Date.now().toString()
      );

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        onLock();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, isLocked, onLock]);

  // Check if session has expired on app resume
  const checkSessionExpiry = useCallback(async () => {
    if (!isAuthenticated || isLocked) return;

    try {
      const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const timeSinceActivity = Date.now() - lastActivityTime;

        if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
          onLock();
        } else {
          // Reset timer with remaining time
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          const remainingTime = INACTIVITY_TIMEOUT - timeSinceActivity;
          timeoutRef.current = setTimeout(() => {
            onLock();
          }, remainingTime);
        }
      }
    } catch (error) {
      console.error("Error checking session expiry:", error);
    }
  }, [isAuthenticated, isLocked, onLock]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        // App coming to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          checkSessionExpiry();
        }

        // App going to background - optionally lock immediately for better security
        // Uncomment the next lines if you want immediate lock on background
        // if (nextAppState.match(/inactive|background/) && isAuthenticated && !isLocked) {
        //   onLock();
        // }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [checkSessionExpiry, isAuthenticated, isLocked, onLock]);

  // Initialize timer when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLocked) {
      resetTimer();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, isLocked, resetTimer]);

  return {
    resetTimer,
  };
}

export default useInactivityLock;
