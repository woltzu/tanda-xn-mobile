import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import Svg, { Circle, Ellipse, Line, Polygon, G, SvgText } from "react-native-svg";
import { useCircles, type CircleMember } from "../context/CirclesContext";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#1D9E75",
  greenLight: "#5DCAA5",
  gold: "#EF9F27",
  red: "#EF4444",
  gray: "#D1D5DB",
  bg: "#F5F7FA",
  muted: "#6B7280",
  white: "#FFFFFF",
};

type RouteParams = { CircleVisualizer: { circleId: string } };

const PHASES = [
  { id: 1, label: "1. Circle created" },
  { id: 2, label: "2. Members joining" },
  { id: 3, label: "3. Contributions" },
  { id: 4, label: "4. Payout" },
];

const TOTAL_SEATS = 8;
const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS_X = 150;
const RADIUS_Y = 140;
const TABLE_RX = 80;
const TABLE_RY = 70;

function getInitials(name: string) {
  return name.charAt(0).toUpperCase();
}

export default function CircleVisualizerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "CircleVisualizer">>();
  const { circleId } = route.params;

  const { circles, getCircleMembers, loading: circlesLoading } = useCircles();
  const circle = circles.find((c) => c.id === circleId);

  const [activePhase, setActivePhase] = useState(1);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const loading = circlesLoading || membersLoading;

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const m = await getCircleMembers(circleId);
      setMembers(m);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setMembersLoading(false);
    }
  }, [circleId, getCircleMembers]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = useCallback(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Build display names (up to TOTAL_SEATS)
  const memberNames = members.map((m) => m.name || "Member");
  while (memberNames.length < TOTAL_SEATS) {
    memberNames.push(`Seat ${memberNames.length + 1}`);
  }

  const membersJoined =
    activePhase === 1 ? 0 : activePhase === 2 ? Math.min(members.length, 5) : members.length || TOTAL_SEATS;

  const payoutRecipientIndex = 2;

  const getTableLabel = () => {
    switch (activePhase) {
      case 1:
        return { line1: "Circle created", line2: `0/${TOTAL_SEATS} members` };
      case 2:
        return { line1: `${membersJoined}/${TOTAL_SEATS} members`, line2: "joined" };
      case 3:
        return { line1: "Round 1", line2: "Everyone contributed" };
      case 4:
        return { line1: "Payout", line2: memberNames[payoutRecipientIndex] ?? "Member" };
      default:
        return { line1: "", line2: "" };
    }
  };

  const screenWidth = Dimensions.get("window").width - 32;
  const tableLabel = getTableLabel();

  if (loading && members.length === 0 && !circle) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loaderText}>Loading circle...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{circle?.name ?? "Circle Visualizer"}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* Phase Buttons */}
        <View style={styles.phaseRow}>
          {PHASES.map((phase) => (
            <TouchableOpacity
              key={phase.id}
              style={[styles.phaseBtn, activePhase === phase.id && styles.phaseBtnActive]}
              onPress={() => setActivePhase(phase.id)}
            >
              <Text style={[styles.phaseBtnText, activePhase === phase.id && styles.phaseBtnTextActive]}>
                {phase.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Circle Visualization */}
        <View style={styles.svgContainer}>
          <Svg
            width={screenWidth}
            height={screenWidth}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          >
            {/* Round table */}
            <Ellipse
              cx={CENTER}
              cy={CENTER}
              rx={TABLE_RX}
              ry={TABLE_RY}
              fill={COLORS.green}
            />
            <SvgText
              x={CENTER}
              y={CENTER - 5}
              textAnchor="middle"
              fill={COLORS.white}
              fontSize={10}
              fontWeight="500"
            >
              {tableLabel.line1}
            </SvgText>
            <SvgText
              x={CENTER}
              y={CENTER + 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize={9}
            >
              {tableLabel.line2}
            </SvgText>

            {/* Pot symbol (phase 3 & 4) */}
            {(activePhase === 3 || activePhase === 4) && (
              <G opacity={activePhase === 3 ? 1 : 0.3}>
                <Circle cx={CENTER} cy={CENTER} r={20} fill={COLORS.gold} />
                <SvgText
                  x={CENTER}
                  y={CENTER + 5}
                  textAnchor="middle"
                  fill={COLORS.white}
                  fontSize={14}
                  fontWeight="bold"
                >
                  $
                </SvgText>
              </G>
            )}

            {/* Chairs and Members */}
            {memberNames.slice(0, TOTAL_SEATS).map((name, index) => {
              const angle = (index * 2 * Math.PI) / TOTAL_SEATS - Math.PI / 2;
              const x = CENTER + RADIUS_X * Math.cos(angle);
              const y = CENTER + RADIUS_Y * Math.sin(angle);
              const coinX = CENTER + RADIUS_X * 0.55 * Math.cos(angle);
              const coinY = CENTER + RADIUS_Y * 0.55 * Math.sin(angle);

              const isOccupied = index < membersJoined;
              const isPayoutRecipient = activePhase === 4 && index === payoutRecipientIndex;

              return (
                <G key={index}>
                  {/* Payout ring */}
                  {isPayoutRecipient && (
                    <Circle
                      cx={x}
                      cy={y}
                      r={32}
                      fill="none"
                      stroke={COLORS.red}
                      strokeWidth={3}
                    />
                  )}

                  {/* Chair */}
                  <Circle
                    cx={x}
                    cy={y}
                    r={26}
                    fill={isOccupied ? COLORS.greenLight : COLORS.gray}
                  />

                  {/* Member initials */}
                  {isOccupied && (
                    <G>
                      <Circle cx={x} cy={y - 5} r={12} fill={COLORS.green} />
                      <SvgText
                        x={x}
                        y={y - 1}
                        textAnchor="middle"
                        fill={COLORS.white}
                        fontSize={11}
                        fontWeight="bold"
                      >
                        {getInitials(name)}
                      </SvgText>
                    </G>
                  )}

                  {/* Name label */}
                  <SvgText
                    x={x}
                    y={y + 45}
                    textAnchor="middle"
                    fill={isOccupied ? COLORS.green : COLORS.gray}
                    fontSize={11}
                    fontWeight="500"
                  >
                    {name.length > 8 ? name.slice(0, 7) + ".." : name}
                  </SvgText>

                  {/* Coins (phase 3) */}
                  {activePhase === 3 && isOccupied && (
                    <G>
                      <Circle cx={coinX} cy={coinY} r={10} fill={COLORS.gold} />
                      <SvgText
                        x={coinX}
                        y={coinY + 4}
                        textAnchor="middle"
                        fill={COLORS.white}
                        fontSize={9}
                        fontWeight="bold"
                      >
                        $
                      </SvgText>
                    </G>
                  )}

                  {/* Payout arrow (phase 4) */}
                  {isPayoutRecipient && (
                    <G>
                      <Line
                        x1={CENTER}
                        y1={CENTER}
                        x2={CENTER + RADIUS_X * 0.6 * Math.cos(angle)}
                        y2={CENTER + RADIUS_Y * 0.6 * Math.sin(angle)}
                        stroke={COLORS.red}
                        strokeWidth={3}
                        strokeDasharray="5,5"
                      />
                      <Polygon
                        points={`
                          ${CENTER + RADIUS_X * 0.65 * Math.cos(angle)},${CENTER + RADIUS_Y * 0.65 * Math.sin(angle)}
                          ${CENTER + RADIUS_X * 0.55 * Math.cos(angle - 0.2)},${CENTER + RADIUS_Y * 0.55 * Math.sin(angle - 0.2)}
                          ${CENTER + RADIUS_X * 0.55 * Math.cos(angle + 0.2)},${CENTER + RADIUS_Y * 0.55 * Math.sin(angle + 0.2)}
                        `}
                        fill={COLORS.red}
                      />
                    </G>
                  )}
                </G>
              );
            })}
          </Svg>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.gray }]} />
            <Text style={styles.legendText}>Empty seat</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.greenLight }]} />
            <Text style={styles.legendText}>Member joined</Text>
          </View>
          {(activePhase === 3 || activePhase === 4) && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.gold }]} />
              <Text style={styles.legendText}>Contribution</Text>
            </View>
          )}
          {activePhase === 4 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDotOutline, { borderColor: COLORS.red }]} />
              <Text style={styles.legendText}>Payout recipient</Text>
            </View>
          )}
        </View>

        {/* Circle Info */}
        {circle && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{circle.name}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Members</Text>
              <Text style={styles.infoValue}>{circle.currentMembers}/{circle.memberCount}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contribution</Text>
              <Text style={styles.infoValue}>${(circle.amount / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Frequency</Text>
              <Text style={styles.infoValue}>{circle.frequency}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: COLORS.teal }]}>{circle.status}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    width: 34,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  phaseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  phaseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  phaseBtnActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  phaseBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.green,
  },
  phaseBtnTextActive: {
    color: COLORS.white,
  },
  svgContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendDotOutline: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  legendText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.muted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
});
