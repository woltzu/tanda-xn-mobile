// lib/navigation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared navigation ref. App.tsx wires it into the NavigationContainer;
// AuthContext consumes it to redirect on automatic session expiry (P0
// of the session-persistence review).
//
// The RootStackParamList type lives in App.tsx and is imported via
// `import type` so the type cycle is erased at runtime — at runtime
// only App.tsx → lib/navigation flows one way, no circular import.
// ─────────────────────────────────────────────────────────────────────────────

import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../App";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
