import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemberInvites, type MemberInvite, type CsvRow, type SmsLanguage } from "../hooks/useMarketplace";
import { MarketplaceEngine } from "../services/MarketplaceEngine";

type Tab = "members" | "send" | "upload";

export default function BulkInvitesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const storeId = (route.params as any)?.storeId ?? "";
  const storeName = (route.params as any)?.storeName ?? "Your Store";
  const ownerName = (route.params as any)?.ownerName ?? "Store Owner";

  const {
    invites, pendingInvites, sentInvites, joinedInvites,
    stats, uploads, loading, uploading,
    processCsv, markSent, refresh,
  } = useMemberInvites(storeId);

  const [tab, setTab] = useState<Tab>("members");
  const [searchText, setSearchText] = useState("");
  const [smsLanguage, setSmsLanguage] = useState<SmsLanguage>("fr");
  const [sendTarget, setSendTarget] = useState<"all" | "pending">("pending");
  const [sending, setSending] = useState(false);

  // CSV paste state
  const [csvText, setCsvText] = useState("");
  const [csvParsing, setCsvParsing] = useState(false);

  const filteredInvites = invites.filter(i => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return i.firstName.toLowerCase().includes(s)
      || (i.lastName?.toLowerCase().includes(s))
      || i.phone.includes(s)
      || (i.circleName?.toLowerCase().includes(s));
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#F59E0B";
      case "sent": case "delivered": return "#3B82F6";
      case "failed": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const handleParseCsv = useCallback(async () => {
    if (!csvText.trim()) {
      Alert.alert("Required", "Please paste CSV data");
      return;
    }

    setCsvParsing(true);
    try {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        Alert.alert("Error", "CSV must have a header row and at least one data row");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const fnIdx = headers.indexOf("first_name");
      const lnIdx = headers.indexOf("last_name");
      const phIdx = headers.indexOf("phone");
      const cnIdx = headers.indexOf("circle_name");

      if (fnIdx === -1 || phIdx === -1) {
        Alert.alert("Error", "CSV must have 'first_name' and 'phone' columns");
        return;
      }

      const rows: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
        if (cols.length > Math.max(fnIdx, phIdx)) {
          rows.push({
            first_name: cols[fnIdx],
            last_name: lnIdx >= 0 ? cols[lnIdx] : undefined,
            phone: cols[phIdx],
            circle_name: cnIdx >= 0 ? cols[cnIdx] : undefined,
          });
        }
      }

      const result = await processCsv("paste_upload.csv", rows);
      Alert.alert(
        "Upload Complete",
        `${result.validRows} members added, ${result.duplicateRows} duplicates skipped, ${result.errorRows} errors.`
      );
      setCsvText("");
      setTab("members");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to process CSV");
    } finally {
      setCsvParsing(false);
    }
  }, [csvText, processCsv]);

  const handleSendSms = async () => {
    const targets = sendTarget === "all" ? invites : pendingInvites;
    if (targets.length === 0) {
      Alert.alert("No recipients", "No invites to send");
      return;
    }

    Alert.alert(
      "Send SMS Invites",
      `Send ${targets.length} SMS messages in ${smsLanguage === "both" ? "French + English" : smsLanguage === "fr" ? "French" : "English"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setSending(true);
            try {
              // Generate SMS texts and mark as sent (Twilio integration point)
              const ids = targets.map(i => i.id);
              await markSent(ids);
              Alert.alert("Done!", `${targets.length} SMS invites queued for delivery.`);
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to send");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const renderInviteCard = (invite: MemberInvite) => (
    <View key={invite.id} style={styles.inviteCard}>
      <View style={styles.inviteAvatar}>
        <Text style={styles.inviteInitial}>{invite.firstName.charAt(0)}</Text>
      </View>
      <View style={styles.inviteInfo}>
        <Text style={styles.inviteName}>
          {invite.firstName} {invite.lastName ?? ""}
        </Text>
        <Text style={styles.invitePhone}>{invite.phone}</Text>
        {invite.circleName && (
          <Text style={styles.inviteCircle}>{invite.circleName}</Text>
        )}
      </View>
      <View style={styles.inviteStatus}>
        {invite.joinedAt ? (
          <View style={[styles.statusPill, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark-circle" size={12} color="#059669" />
            <Text style={[styles.statusText, { color: "#059669" }]}>Joined</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: getStatusColor(invite.smsStatus) + "20" }]}>
            <Text style={[styles.statusText, { color: getStatusColor(invite.smsStatus) }]}>
              {invite.smsStatus === "pending" ? "Not Invited" : invite.smsStatus}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Invites</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats Bar */}
        {stats && (
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#3B82F6" }]}>{stats.sent + stats.delivered}</Text>
              <Text style={styles.statLabel}>Sent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#10B981" }]}>{stats.joined}</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {([
            { key: "members" as Tab, label: "Members" },
            { key: "send" as Tab, label: "Send Invites" },
            { key: "upload" as Tab, label: "Upload CSV" },
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* Members Tab */}
        {tab === "members" && (
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone, circle..."
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {filteredInvites.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={56} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No members yet</Text>
                <Text style={styles.emptySubtitle}>Upload a CSV or add members manually</Text>
              </View>
            )}

            {filteredInvites.map(renderInviteCard)}
          </>
        )}

        {/* Send Invites Tab */}
        {tab === "send" && (
          <>
            {/* SMS Preview */}
            <View style={styles.smsPreview}>
              <Text style={styles.smsPreviewLabel}>SMS Preview</Text>
              <View style={styles.smsBubble}>
                <Text style={styles.smsBubbleText}>
                  {smsLanguage === "en"
                    ? `Hi [Name]! ${ownerName} invites you to join TandaXn — your tontine circle is waiting. Set up in 2 min: https://tandaxn.app/join/...`
                    : smsLanguage === "both"
                    ? `Bonjour [Nom]! ${ownerName} vous invite sur TandaXn. / Hi [Name]! Join your tontine circle: https://tandaxn.app/join/...`
                    : `Bonjour [Nom] ! ${ownerName} vous invite à rejoindre TandaXn — votre cercle de tontine vous attend. Inscrivez-vous en 2 min : https://tandaxn.app/join/...`
                  }
                </Text>
              </View>
            </View>

            {/* Send Target */}
            <Text style={styles.fieldLabel}>Send to</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radioOption, sendTarget === "pending" && styles.radioOptionActive]}
                onPress={() => setSendTarget("pending")}
              >
                <View style={[styles.radio, sendTarget === "pending" && styles.radioActive]}>
                  {sendTarget === "pending" && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>Pending only ({pendingInvites.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radioOption, sendTarget === "all" && styles.radioOptionActive]}
                onPress={() => setSendTarget("all")}
              >
                <View style={[styles.radio, sendTarget === "all" && styles.radioActive]}>
                  {sendTarget === "all" && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>All {invites.length} members</Text>
              </TouchableOpacity>
            </View>

            {/* Language */}
            <Text style={styles.fieldLabel}>Language</Text>
            <View style={styles.langRow}>
              {([
                { key: "fr" as SmsLanguage, label: "Français" },
                { key: "en" as SmsLanguage, label: "English" },
                { key: "both" as SmsLanguage, label: "Both" },
              ]).map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.langBtn, smsLanguage === l.key && styles.langBtnActive]}
                  onPress={() => setSmsLanguage(l.key)}
                >
                  <Text style={[styles.langBtnText, smsLanguage === l.key && { color: "#FFFFFF" }]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={handleSendSms}
              disabled={sending}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>
                {sending ? "Sending..." : `Send ${sendTarget === "all" ? invites.length : pendingInvites.length} SMS Invites`}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Upload CSV Tab */}
        {tab === "upload" && (
          <>
            <View style={styles.uploadInfo}>
              <Ionicons name="document-text-outline" size={24} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadInfoTitle}>CSV Format</Text>
                <Text style={styles.uploadInfoText}>
                  Required columns: first_name, phone{"\n"}
                  Optional: last_name, circle_name
                </Text>
              </View>
            </View>

            <View style={styles.csvExample}>
              <Text style={styles.csvExampleLabel}>Example:</Text>
              <Text style={styles.csvExampleText}>
                first_name,last_name,phone,circle_name{"\n"}
                Aicha,Diabate,+14045551234,Cercle Diamant A{"\n"}
                Fatou,Koné,+14045555678,Cercle Diamant B
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Paste CSV data</Text>
            <TextInput
              style={styles.csvInput}
              placeholder="Paste your CSV data here..."
              placeholderTextColor="#9CA3AF"
              value={csvText}
              onChangeText={setCsvText}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.uploadBtn, (csvParsing || uploading) && { opacity: 0.6 }]}
              onPress={handleParseCsv}
              disabled={csvParsing || uploading}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.uploadBtnText}>
                {csvParsing || uploading ? "Processing..." : "Process CSV"}
              </Text>
            </TouchableOpacity>

            {/* Upload History */}
            {uploads.length > 0 && (
              <View style={styles.uploadHistory}>
                <Text style={styles.fieldLabel}>Upload History</Text>
                {uploads.map(u => (
                  <View key={u.id} style={styles.uploadRow}>
                    <Ionicons name="document-outline" size={16} color="#6B7280" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadFileName}>{u.fileName}</Text>
                      <Text style={styles.uploadMeta}>
                        {u.validRows} added · {u.duplicateRows} dupes · {u.errorRows} errors
                      </Text>
                    </View>
                    <Text style={styles.uploadDate}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 0, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  statsBar: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },

  tabs: { flexDirection: "row", gap: 0 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#00C6AE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  tabTextActive: { color: "#FFFFFF" },

  content: { flex: 1, padding: 20 },

  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, fontSize: 14, color: "#0A2342" },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },

  inviteCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  inviteAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  inviteInitial: { fontSize: 18, fontWeight: "700", color: "#00C6AE" },
  inviteInfo: { flex: 1 },
  inviteName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  invitePhone: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  inviteCircle: { fontSize: 12, color: "#00C6AE", fontWeight: "500", marginTop: 2 },
  inviteStatus: {},
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },

  smsPreview: { marginBottom: 20 },
  smsPreviewLabel: { fontSize: 13, fontWeight: "600", color: "#9CA3AF", marginBottom: 8 },
  smsBubble: { backgroundColor: "#DCF8C6", borderRadius: 14, padding: 14, borderTopLeftRadius: 4 },
  smsBubbleText: { fontSize: 13, color: "#0A2342", lineHeight: 18 },

  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 10, marginTop: 16 },

  radioGroup: { gap: 8 },
  radioOption: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 2, borderColor: "#E5E7EB" },
  radioOptionActive: { borderColor: "#00C6AE", backgroundColor: "#F0FDFB" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#00C6AE" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00C6AE" },
  radioLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },

  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  langBtnActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  langBtnText: { fontSize: 13, fontWeight: "600", color: "#0A2342" },

  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  sendBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  uploadInfo: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  uploadInfoTitle: { fontSize: 14, fontWeight: "600", color: "#1E40AF", marginBottom: 4 },
  uploadInfoText: { fontSize: 12, color: "#3B82F6", lineHeight: 18 },

  csvExample: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 16 },
  csvExampleLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 6 },
  csvExampleText: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: "#E2E8F0", lineHeight: 18 },

  csvInput: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 13, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", minHeight: 160, textAlignVertical: "top", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 16, marginTop: 16 },
  uploadBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  uploadHistory: { marginTop: 24 },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  uploadFileName: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  uploadMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  uploadDate: { fontSize: 11, color: "#9CA3AF" },
});
