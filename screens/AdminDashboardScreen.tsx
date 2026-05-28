// ══════════════════════════════════════════════════════════════════════════════
// screens/AdminDashboardScreen.tsx — ADVANCE-006 internal portfolio monitor
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 108-ADVANCE-006-AdminDashboard.jsx.
//
// ⚠️ INTERNAL / STAFF-ONLY. This screen is the advance-portfolio
// monitoring dashboard for TandaXn operators — NOT part of any user
// flow. It will be registered in HomeStack so it's reachable for
// testing, but is intentionally not linked from any user-facing menu.
// A future admin-gate (role check) should guard it before production.
//
// Sections: header KPI strip (total advanced / default rate /
// collection rate), alerts, portfolio-health grid, per-region
// metrics list, auto-calibration logs, profitability (navy card).
//
// Route params (all optional — defaults are illustrative mock data):
//   portfolioHealth?, regionMetrics?, calibrationLogs?,
//   profitability?, alerts?
//
// Navigation:
//   - back → goBack
//   - Export button → Alert placeholder (real CSV/PDF export in a
//     later admin-tooling phase)
//   - Region rows / "Adjust Risk" → Alert placeholders (no user-flow
//     navigation; deeper admin screens aren't part of this stage)
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const RED = "#DC2626";

type RegionStatus = "healthy" | "monitoring" | "warning";

type PortfolioHealth = {
  totalAdvanced: number;
  totalOutstanding: number;
  totalRepaid: number;
  defaultRate: number;
  collectionsEfficiency: number;
  activeAdvances: number;
  averageAdvanceSize: number;
};

type RegionMetric = {
  region: string;
  defaultRate: number;
  riskFactor: number;
  advances: number;
  status: RegionStatus;
};

type CalibrationLog = {
  date: string;
  action: string;
  region: string;
  reason: string;
};

type Profitability = {
  platformReturnRate: number;
  saverReturnsAvg: number;
  netMargin: number;
  revenueThisMonth: number;
  projectedAnnual: number;
};

type AlertItem = {
  type: "warning" | "info";
  message: string;
  time: string;
};

type AdminDashboardParams = {
  portfolioHealth?: PortfolioHealth;
  regionMetrics?: RegionMetric[];
  calibrationLogs?: CalibrationLog[];
  profitability?: Profitability;
  alerts?: AlertItem[];
};
type AdminDashboardRouteProp = RouteProp<
  { AdminDashboard: AdminDashboardParams },
  "AdminDashboard"
>;

const DEFAULT_HEALTH: PortfolioHealth = {
  totalAdvanced: 125000,
  totalOutstanding: 48500,
  totalRepaid: 76500,
  defaultRate: 2.3,
  collectionsEfficiency: 97.2,
  activeAdvances: 156,
  averageAdvanceSize: 312,
};

const DEFAULT_REGIONS: RegionMetric[] = [
  { region: "USA", defaultRate: 1.8, riskFactor: 1.0, advances: 89, status: "healthy" },
  { region: "Nigeria", defaultRate: 3.2, riskFactor: 2.5, advances: 34, status: "monitoring" },
  { region: "Bangladesh", defaultRate: 4.5, riskFactor: 3.0, advances: 21, status: "warning" },
  { region: "Ghana", defaultRate: 2.1, riskFactor: 2.0, advances: 12, status: "healthy" },
];

const DEFAULT_LOGS: CalibrationLog[] = [
  { date: "Jan 20, 2025", action: "Risk factor +0.5%", region: "Bangladesh", reason: "Default rate above 4%" },
  { date: "Jan 18, 2025", action: "Base rate -0.2%", region: "USA", reason: "Strong repayment performance" },
  { date: "Jan 15, 2025", action: "Max advance lowered", region: "Nigeria", reason: "New user segment launch" },
];

const DEFAULT_PROFIT: Profitability = {
  platformReturnRate: 11.2,
  saverReturnsAvg: 8.5,
  netMargin: 2.7,
  revenueThisMonth: 4250,
  projectedAnnual: 51000,
};

const DEFAULT_ALERTS: AlertItem[] = [
  {
    type: "warning",
    message:
      "Bangladesh default rate rising - consider increasing risk premium",
    time: "2 hours ago",
  },
  { type: "info", message: "156 active advances, 23 due this week", time: "Today" },
];

function statusColor(status: RegionStatus): string {
  switch (status) {
    case "healthy":
      return TEAL;
    case "monitoring":
      return AMBER;
    case "warning":
      return RED;
  }
}

export default function AdminDashboardScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AdminDashboardRouteProp>();

  const health = route.params?.portfolioHealth ?? DEFAULT_HEALTH;
  const regions = route.params?.regionMetrics ?? DEFAULT_REGIONS;
  const logs = route.params?.calibrationLogs ?? DEFAULT_LOGS;
  const profit = route.params?.profitability ?? DEFAULT_PROFIT;
  const alerts = route.params?.alerts ?? DEFAULT_ALERTS;

  const adminStub = (label: string) =>
    Alert.alert(
      "Admin tool",
      `"${label}" is an internal admin action. Deeper admin tooling will be built in a later phase.`,
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>Admin Dashboard</Text>
                <Text style={styles.headerSubtitle}>
                  Advance Portfolio Monitoring
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => adminStub("Export")}
              accessibilityRole="button"
              accessibilityLabel="Export report"
            >
              <Ionicons name="download-outline" size={14} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>

          {/* KPI strip */}
          <View style={styles.kpiRow}>
            <KpiTile
              value={`$${(health.totalAdvanced / 1000).toFixed(0)}K`}
              label="Total Advanced"
            />
            <KpiTile
              value={`${health.defaultRate}%`}
              label="Default Rate"
              valueColor={TEAL}
            />
            <KpiTile
              value={`${health.collectionsEfficiency}%`}
              label="Collection Rate"
            />
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Alerts */}
          {alerts.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="warning-outline" size={16} color={AMBER} />
                <Text style={styles.sectionTitle}>Alerts</Text>
              </View>
              <View style={styles.alertsList}>
                {alerts.map((alert, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.alertRow,
                      {
                        backgroundColor:
                          alert.type === "warning" ? "#FEF3C7" : "#F0FDFB",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        alert.type === "warning"
                          ? "alert-circle"
                          : "information-circle"
                      }
                      size={16}
                      color={alert.type === "warning" ? AMBER : "#00897B"}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.alertMessage,
                          {
                            color:
                              alert.type === "warning" ? "#92400E" : "#065F46",
                          },
                        ]}
                      >
                        {alert.message}
                      </Text>
                      <Text style={styles.alertTime}>{alert.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Portfolio health grid */}
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
              Portfolio Health
            </Text>
            <View style={styles.healthGrid}>
              <HealthTile
                label="Outstanding"
                value={`$${health.totalOutstanding.toLocaleString()}`}
              />
              <HealthTile
                label="Repaid"
                value={`$${health.totalRepaid.toLocaleString()}`}
                bg="#F0FDFB"
                valueColor={TEAL}
              />
              <HealthTile
                label="Active Advances"
                value={String(health.activeAdvances)}
              />
              <HealthTile
                label="Avg Size"
                value={`$${health.averageAdvanceSize}`}
              />
            </View>
          </View>

          {/* Region metrics */}
          <View style={styles.sectionCard}>
            <View style={styles.regionHeader}>
              <Text style={styles.sectionTitle}>By Region</Text>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => adminStub("Adjust Risk")}
                accessibilityRole="button"
                accessibilityLabel="Adjust risk"
              >
                <Text style={styles.adjustButtonText}>Adjust Risk</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.regionList}>
              {regions.map((region, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.regionRow}
                  onPress={() => adminStub(`${region.region} detail`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${region.region} metrics`}
                >
                  <View style={styles.regionLeft}>
                    <View
                      style={[
                        styles.regionDot,
                        { backgroundColor: statusColor(region.status) },
                      ]}
                    />
                    <View>
                      <Text style={styles.regionName}>{region.region}</Text>
                      <Text style={styles.regionSub}>
                        {region.advances} advances
                      </Text>
                    </View>
                  </View>
                  <View style={styles.regionRight}>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.regionMicroLabel}>Default</Text>
                      <Text
                        style={[
                          styles.regionMetricValue,
                          { color: statusColor(region.status) },
                        ]}
                      >
                        {region.defaultRate}%
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.regionMicroLabel}>Risk +</Text>
                      <Text style={styles.regionMetricValueNavy}>
                        {region.riskFactor}%
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={MUTED} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Auto-calibration logs */}
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
              Auto-Calibration Logs
            </Text>
            <View style={styles.logsList}>
              {logs.map((log, idx) => (
                <View key={idx} style={styles.logRow}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logAction}>{log.action}</Text>
                    <Text style={styles.logDate}>{log.date}</Text>
                  </View>
                  <Text style={styles.logReason}>
                    <Text style={styles.logRegion}>{log.region}</Text> —{" "}
                    {log.reason}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Profitability — navy */}
          <View style={styles.profitCard}>
            <Text style={styles.profitTitle}>Profitability</Text>
            <View style={styles.profitGrid}>
              <ProfitTile
                label="Platform Return"
                value={`${profit.platformReturnRate}%`}
                valueColor={TEAL}
              />
              <ProfitTile
                label="Saver Returns"
                value={`${profit.saverReturnsAvg}%`}
              />
              <ProfitTile
                label="Net Margin"
                value={`${profit.netMargin}%`}
                valueColor={TEAL}
              />
              <ProfitTile
                label="This Month"
                value={`$${profit.revenueThisMonth}`}
              />
            </View>
            <View style={styles.projectedBanner}>
              <Text style={styles.projectedLabel}>
                Projected Annual Revenue
              </Text>
              <Text style={styles.projectedValue}>
                ${profit.projectedAnnual.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function KpiTile({
  value,
  label,
  valueColor,
}: {
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function HealthTile({
  label,
  value,
  bg,
  valueColor,
}: {
  label: string;
  value: string;
  bg?: string;
  valueColor?: string;
}) {
  return (
    <View style={[styles.healthTile, bg && { backgroundColor: bg }]}>
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={[styles.healthValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function ProfitTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.profitTile}>
      <Text style={styles.profitLabel}>{label}</Text>
      <Text
        style={[
          styles.profitValue,
          { color: valueColor ?? "#FFFFFF" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  exportButtonText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },

  kpiRow: { flexDirection: "row", gap: 10 },
  kpiTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  kpiValue: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  kpiLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    textAlign: "center",
  },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  alertsList: { gap: 8 },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  alertMessage: { fontSize: 13 },
  alertTime: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },

  healthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  healthTile: {
    width: "47%",
    flexGrow: 1,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  healthLabel: { fontSize: 11, color: MUTED },
  healthValue: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 4,
  },

  regionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  adjustButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F7FA",
    borderRadius: 6,
  },
  adjustButtonText: { fontSize: 11, fontWeight: "600", color: NAVY },
  regionList: { gap: 8 },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  regionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  regionDot: { width: 10, height: 10, borderRadius: 5 },
  regionName: { fontSize: 14, fontWeight: "600", color: NAVY },
  regionSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  regionRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  regionMicroLabel: { fontSize: 12, color: MUTED },
  regionMetricValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  regionMetricValueNavy: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginTop: 2,
  },

  logsList: { gap: 8 },
  logRow: {
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  logAction: { fontSize: 13, fontWeight: "600", color: NAVY },
  logDate: { fontSize: 11, color: "#9CA3AF" },
  logReason: { fontSize: 12, color: MUTED },
  logRegion: { color: TEAL, fontWeight: "500" },

  profitCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
  },
  profitTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  profitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  profitTile: {
    width: "47%",
    flexGrow: 1,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  profitLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  profitValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  projectedBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(0,198,174,0.2)",
    borderRadius: 10,
    alignItems: "center",
  },
  projectedLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  projectedValue: {
    fontSize: 24,
    fontWeight: "700",
    color: TEAL,
    marginTop: 4,
  },
});
