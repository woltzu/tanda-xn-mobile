// ══════════════════════════════════════════════════════════════════════════════
// QuickJoinPendingConfirmationScreen
// Shown after QuickJoin submit. Tells the user to check their email for the
// magic link. When they click it, Supabase sends them to /join-confirm which
// runs JoinConfirmScreen to finalize the join.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

const NAVY = "#0A2342";
const NAVY_DEEP = "#071832";
const TEAL = "#00C6AE";
const WHITE = "#FFFFFF";
const MUTED = "#9AA7BD";
const BORDER = "rgba(255,255,255,0.12)";
const CARD = "rgba(255,255,255,0.06)";

type NavProp = StackNavigationProp<RootStackParamList, "QuickJoinPendingConfirmation">;
type RouteParams = RouteProp<RootStackParamList, "QuickJoinPendingConfirmation">;

function formatMoney(amount?: number) {
  if (amount == null) return "$--";
  return `$${amount.toFixed(2)}`;
}

export default function QuickJoinPendingConfirmationScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { email, circleName, amount, inviteCode } = route.params;

  const openMail = () => {
    // Best-effort: open the default mail client. On web this is a no-op
    // unless the browser has a mailto handler registered.
    if (Platform.OS === "web") {
      try {
        window.location.href = "mailto:";
      } catch {}
    } else {
      Linking.openURL("mailto:").catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-outline" size={56} color={TEAL} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to{" "}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.description}>
            Tap the link to confirm your spot in{" "}
            <Text style={styles.bold}>{circleName}</Text>.
            {amount ? (
              <>
                {" "}Your first{" "}
                <Text style={styles.bold}>{formatMoney(amount)}</Text>
                {" "}contribution will be processed after confirmation.
              </>
            ) : null}
          </Text>

          <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={openMail}>
            <Ionicons name="open-outline" size={18} color={NAVY} />
            <Text style={styles.primaryText}>Open email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondary}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("QuickJoin", { inviteCode })}
          >
            <Text style={styles.secondaryText}>Use a different email</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Didn't get the link? Check your spam folder. You can re-enter your email after 60 seconds.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY_DEEP },
  container: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,198,174,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: WHITE,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  email: { color: TEAL, fontWeight: "700" },
  description: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 22,
  },
  bold: { color: WHITE, fontWeight: "700" },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignSelf: "stretch",
  },
  primaryText: { color: NAVY, fontSize: 15, fontWeight: "800" },
  secondary: {
    paddingVertical: 12,
    marginTop: 10,
  },
  secondaryText: { color: MUTED, fontSize: 14, fontWeight: "600" },
  footnote: {
    marginTop: 14,
    color: MUTED,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
});
