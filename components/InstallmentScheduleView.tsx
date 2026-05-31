// ══════════════════════════════════════════════════════════════════════════════
// components/InstallmentScheduleView.tsx — reusable installment schedule list
// ══════════════════════════════════════════════════════════════════════════════
//
// Displays the JSONB envelope stored at trips.installment_schedule (see
// services/TripOrganizerEngine.extractInstallmentSchedule for the shape).
// Used in two contexts:
//
//   - OrganizerTripDashboardScreen: showStatus=false. Organizer sees the
//     raw schedule the wizard generated — no per-installment status is
//     meaningful here since the organizer doesn't have a per-participant
//     payment history at this level.
//
//   - TripPaymentScreen: showStatus=true, payments=<participant's rows>.
//     Each installment gets a paid / upcoming / overdue badge derived
//     from the participant's trip_payments rows by
//     lib/tripHelpers.computeInstallmentStatus.
//
// scrollEnabled is false on the FlatList because this component is intended
// to live inside a parent ScrollView (both target screens use one).
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import type { InstallmentSchedule } from "../services/TripOrganizerEngine";
import {
  formatDate,
  formatMoneyCents,
  mergeInstallmentsWithPayments,
  type InstallmentStatus,
  type TripPaymentRecord,
} from "../lib/tripHelpers";

interface Props {
  schedule: InstallmentSchedule | null | undefined;
  payments?: TripPaymentRecord[];
  /** Default true. Set false for organizer view (no per-row badge). */
  showStatus?: boolean;
  /** Optional section title rendered above the list. */
  title?: string;
}

const STATUS_STYLES: Record<
  InstallmentStatus,
  { bg: string; text: string; label: string }
> = {
  paid: { bg: "rgba(16,185,129,0.15)", text: "#059669", label: "Paid" },
  upcoming: { bg: "#E5E7EB", text: "#6B7280", label: "Upcoming" },
  overdue: { bg: "#FEE2E2", text: "#DC2626", label: "Overdue" },
};

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const TEXT_DARK = "#1F2937";
const MUTED = "#6B7280";

const InstallmentScheduleView: React.FC<Props> = ({
  schedule,
  payments,
  showStatus = true,
  title,
}) => {
  // Empty / unset schedule → friendly placeholder so the screen layout
  // doesn't collapse and the user knows there's nothing to render.
  if (
    !schedule ||
    !schedule.installments ||
    schedule.installments.length === 0
  ) {
    return (
      <View style={styles.empty}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.emptyText}>No installment plan set</Text>
      </View>
    );
  }

  const merged = mergeInstallmentsWithPayments(schedule, payments ?? []);

  // "4 monthly payments" / "3 weekly payments" subtitle. Cadence is
  // capitalised by the style sheet so we can store it lowercase here.
  const cadenceLabel = schedule.cadence ?? "";
  const subtitle =
    schedule.count > 0
      ? `${schedule.count} ${cadenceLabel} ${schedule.count === 1 ? "payment" : "payments"}`.trim()
      : "";

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <FlatList
        data={merged}
        keyExtractor={(item) => `${item.index}-${item.dueDate}`}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const sty = STATUS_STYLES[item.status];
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.indexBubble}>
                  <Text style={styles.indexText}>{item.index + 1}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.dueDate}>
                    {formatDate(item.dueDate)}
                  </Text>
                  <Text style={styles.amount}>
                    {formatMoneyCents(item.amountCents)}
                  </Text>
                </View>
              </View>
              {showStatus && (
                <View style={[styles.badge, { backgroundColor: sty.bg }]}>
                  <Text style={[styles.badgeText, { color: sty.text }]}>
                    {sty.label}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  empty: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 10,
    textTransform: "capitalize",
  },
  emptyText: {
    fontSize: 13,
    color: MUTED,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  indexBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,198,174,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL,
  },
  dueDate: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  amount: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  separator: {
    height: 1,
    backgroundColor: BORDER,
  },
});

export default InstallmentScheduleView;
