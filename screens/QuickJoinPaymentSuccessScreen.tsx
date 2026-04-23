// ══════════════════════════════════════════════════════════════════════════════
// QuickJoinPaymentSuccessScreen
// Intermediate celebration screen shown after JoinConfirm succeeds. Sits for
// ~3.5 seconds so the user sees their first contribution amount prominently,
// then auto-navigates to MainTabs (Dashboard).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type NavProp = StackNavigationProp<RootStackParamList, "QuickJoinPaymentSuccess">;
type RouteParams = RouteProp<RootStackParamList, "QuickJoinPaymentSuccess">;

export default function QuickJoinPaymentSuccessScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { circleName, amount, memberCount } = route.params;

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    }, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatted = typeof amount === "number" && Number.isFinite(amount)
    ? `$${amount.toFixed(2)}`
    : "$--";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name="checkmark" size={48} color="#00C6AE" />
          </View>
          <Text style={styles.title}>Welcome to {circleName}!</Text>
          <Text style={styles.amountLabel}>First contribution confirmed</Text>
          <Text style={styles.amount}>{formatted}</Text>
          {typeof memberCount === "number" && memberCount > 0 ? (
            <Text style={styles.memberCount}>
              Joining {memberCount} other member{memberCount === 1 ? "" : "s"}
            </Text>
          ) : null}
          <View style={styles.divider} />
          <Text style={styles.subtext}>
            You'll receive a reminder 3 days before each cycle.
          </Text>
          <Text style={styles.subtext}>
            Redirecting to your dashboard…
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0A1628" },
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#14233D",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0, 198, 174, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(0, 198, 174, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  amountLabel: {
    color: "#8A9BB5",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  amount: {
    color: "#00C6AE",
    fontSize: 44,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  memberCount: {
    color: "#8A9BB5",
    fontSize: 13,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    width: "100%",
    marginVertical: 16,
  },
  subtext: {
    color: "#B8C4D6",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
});
