// =============================================================================
// ViewerHistoryModal — host-only viewer summary popup.
//
// Opens from HostDashboardScreen's ActiveViewersList when the host taps a
// viewer avatar. Calls public.get_viewer_summary(p_user_id, p_room_id),
// which enforces the host-only gate server-side — this UI is not the
// authoritative permission check.
//
// Display: scrollable Modal with sections for circle contributions,
// in-room activity, and last-active timestamp. Close button dismisses.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

interface ViewerSummary {
  success: boolean;
  circle_contributions_dollars: number;
  in_room_donations_cents: number;
  candle_count: number;
  candle_donations_cents: number;
  mass_count: number;
  mass_donations_cents: number;
  last_active: string | null;
  error?: string;
}

interface Props {
  visible: boolean;
  viewerId: string | null;
  roomId: string;
  onClose: () => void;
}

const formatCents = (c: number | null | undefined): string => {
  const n = c ?? 0;
  return `$${(n / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
const formatDollars = (d: number | null | undefined): string => {
  const n = d ?? 0;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
const formatTimestamp = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const ViewerHistoryModal: React.FC<Props> = ({
  visible,
  viewerId,
  roomId,
  onClose,
}) => {
  const [summary, setSummary] = useState<ViewerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!viewerId) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    const { data, error: rpcErr } = await supabase.rpc("get_viewer_summary", {
      p_user_id: viewerId,
      p_room_id: roomId,
    });
    if (rpcErr) {
      setError(rpcErr.message ?? "Failed to load viewer summary");
    } else if (data && (data as ViewerSummary).success === false) {
      setError((data as ViewerSummary).error ?? "Failed to load viewer summary");
    } else if (data) {
      setSummary(data as ViewerSummary);
    }
    setLoading(false);
  }, [viewerId, roomId]);

  useEffect(() => {
    if (visible) fetchSummary();
  }, [visible, fetchSummary]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Viewer History</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close viewer history"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color="#0A2342" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {loading ? (
            <ActivityIndicator color="#00C6AE" style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : summary ? (
            <>
              <Section title="Circle contributions">
                <Stat
                  label="All-time total"
                  value={formatDollars(summary.circle_contributions_dollars)}
                />
              </Section>

              <Section title="In this room">
                <Stat
                  label="Reaction donations"
                  value={formatCents(summary.in_room_donations_cents)}
                />
                <Stat
                  label="Candle requests"
                  value={`${summary.candle_count} (${formatCents(summary.candle_donations_cents)})`}
                />
                <Stat
                  label="Mass intentions"
                  value={`${summary.mass_count} (${formatCents(summary.mass_donations_cents)})`}
                />
              </Section>

              <Section title="Activity">
                <Stat label="Last active" value={formatTimestamp(summary.last_active)} />
              </Section>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#0A2342" },
  body: { padding: 16, gap: 16 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 10,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  statLabel: { fontSize: 13, color: "#6B7280" },
  statValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 16,
  },
});

export default ViewerHistoryModal;
