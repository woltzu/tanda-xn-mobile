// ═══════════════════════════════════════════════════════════════════════════════
// CreditReportScreen — Feature #13
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates a "Financial Behavior Report" PDF the member can share/save.
//
// Flow:
//   1. User taps "Download Credit Report".
//   2. We invoke the generate-financial-report Edge Function with the user's
//      JWT. The EF reads cycle_contributions, xn_scores, circles, etc. and
//      returns self-contained HTML.
//   3. We hand the HTML to expo-print which renders it to a PDF file on
//      disk.
//   4. We hand the resulting URI to expo-sharing's native share sheet so
//      the user can save to Files / send via email / etc.
//
// PDF rendering happens fully on-device — no server-side PDF binary
// needed, and the disclaimer / styling lives in the HTML the EF builds.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Months = 6 | 12 | 24;

export default function CreditReportScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [months, setMonths] = useState<Months>(12);
  const [generating, setGenerating] = useState(false);
  const [lastPdfUri, setLastPdfUri] = useState<string | null>(null);
  const [lastReportAt, setLastReportAt] = useState<string | null>(null);
  const [sharingAvailable, setSharingAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const avail = await Sharing.isAvailableAsync();
        setSharingAvailable(avail);
      } catch {
        setSharingAvailable(false);
      }
    })();
  }, []);

  const generatePDF = async () => {
    if (!user?.id) {
      Alert.alert(t("credit_report.alert_not_signed_title"), t("credit_report.alert_not_signed_body"));
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-financial-report",
        { body: { months } },
      );
      if (error) {
        Alert.alert(t("credit_report.alert_failed_title"), error.message);
        return;
      }
      const html = (data as { html?: string })?.html;
      if (!html) {
        Alert.alert(t("credit_report.alert_failed_title"), t("credit_report.alert_empty_body"));
        return;
      }

      // Render PDF on device
      const { uri } = await Print.printToFileAsync({
        html,
        // Letter size, modest margins; works for both phones and tablets
        base64: false,
      });
      setLastPdfUri(uri);
      setLastReportAt(new Date().toISOString());

      // Share / save
      if (sharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Financial Behavior Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(
          "Report ready",
          "Your report has been saved to the device, but sharing isn't available on this platform.",
        );
      }
    } catch (e: any) {
      Alert.alert(t("credit_report.alert_failed_title"), e?.message ?? t("credit_report.alert_unknown"));
    } finally {
      setGenerating(false);
    }
  };

  const reShare = async () => {
    if (!lastPdfUri) return;
    try {
      await Sharing.shareAsync(lastPdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "Financial Behavior Report",
        UTI: "com.adobe.pdf",
      });
    } catch (e: any) {
      Alert.alert(t("credit_report.alert_share_failed_title"), e?.message ?? t("credit_report.alert_unknown"));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("credit_report.header")}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={32} color="#0A2342" />
          </View>
          <Text style={styles.heroTitle}>{t("credit_report.hero_title")}</Text>
          <Text style={styles.heroSubtitle}>
            {t("credit_report.hero_subtitle")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("credit_report.card_window")}</Text>
          <View style={styles.segment}>
            {([6, 12, 24] as Months[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segItem, months === m && styles.segItemActive]}
                onPress={() => setMonths(m)}
                disabled={generating}
              >
                <Text
                  style={[styles.segText, months === m && styles.segTextActive]}
                >
                  {t("credit_report.segment_last_months", { n: m })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.help}>
            {t("credit_report.window_help")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("credit_report.card_contents")}</Text>
          {[
            { icon: "checkmark-circle-outline" as const, key: "credit_report.bullet_summary" },
            { icon: "trending-up-outline" as const,     key: "credit_report.bullet_streak" },
            { icon: "people-outline" as const,           key: "credit_report.bullet_circles" },
            { icon: "list-outline" as const,             key: "credit_report.bullet_transactions" },
            { icon: "shield-outline" as const,           key: "credit_report.bullet_disclaimer" },
          ].map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name={item.icon} size={18} color="#00C6AE" />
              <Text style={styles.bulletText}>{t(item.key)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, generating && styles.disabledButton]}
          onPress={generatePDF}
          disabled={generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Generating…</Text>
            </>
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{t("credit_report.btn_download")}</Text>
            </>
          )}
        </TouchableOpacity>

        {lastPdfUri && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={reShare}
            disabled={!sharingAvailable}
          >
            <Ionicons name="share-outline" size={16} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>
              Share last report{" "}
              {lastReportAt
                ? `(${new Date(lastReportAt).toLocaleTimeString()})`
                : ""}
            </Text>
          </TouchableOpacity>
        )}

        {!sharingAvailable && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color="#92400E" />
            <Text style={styles.warningText}>
              Native sharing isn&apos;t available on {Platform.OS}. The PDF will
              be generated and saved to the device.
            </Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          This is not a regulated credit score. It is a behavioural financial
          report generated from your activity on TandaXn. Recipients should
          independently verify any decision made on the basis of this report.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: "#0A2342",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBackButton: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerPlaceholder: { width: 40 },
  scroll: { flex: 1 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0A234215",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A2342",
    marginBottom: 6,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  segItemActive: { backgroundColor: "#0A2342" },
  segText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  segTextActive: { color: "#FFFFFF" },
  help: { fontSize: 12, color: "#6B7280", marginTop: 10, lineHeight: 17 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  bulletText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },
  primaryButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#2563EB",
    marginBottom: 12,
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "700", color: "#2563EB" },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 12, color: "#92400E" },
  disclaimer: {
    fontSize: 11,
    color: "#9CA3AF",
    lineHeight: 16,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
