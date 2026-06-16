// components/PasswordStrengthBar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared 4-pip + Weak/Okay/Strong strength indicator. Each pip lights up
// per individual check (length / uppercase / lowercase / digit) so the
// user can see which requirement is still missing without us having to
// list them all explicitly. The label aggregates the score:
//
//   0 → no label (panel hides itself for empty input)
//   1 → Weak   (red)
//   2 → Okay   (amber)
//   3-4 → Strong (green)
//
// Consumers (SignupScreen, ResetPasswordScreen) own their submit-button
// gate. This component is purely presentational — it does not decide
// whether the password is acceptable.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

export type StrengthChecks = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
};

// Exported so consumers can derive the same acceptance criteria
// without duplicating the regexes.
export function computeStrengthChecks(password: string): StrengthChecks {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export default function PasswordStrengthBar({
  password,
}: {
  password: string;
}) {
  const { t } = useTranslation();
  if (password.length === 0) return null;

  const checks = computeStrengthChecks(password);
  const score =
    (checks.length ? 1 : 0) +
    (checks.uppercase ? 1 : 0) +
    (checks.lowercase ? 1 : 0) +
    (checks.number ? 1 : 0);

  const labelInfo: { key: string; color: string } = (() => {
    if (score <= 1) {
      return { key: "auth.password_strength_weak", color: "#EF4444" };
    }
    if (score === 2) {
      return { key: "auth.password_strength_okay", color: "#F59E0B" };
    }
    return { key: "auth.password_strength_strong", color: "#10B981" };
  })();

  const pipBoolList = [
    checks.length,
    checks.uppercase,
    checks.lowercase,
    checks.number,
  ];

  return (
    <View style={styles.row}>
      <View style={styles.pipsRow}>
        {pipBoolList.map((ok, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              { backgroundColor: ok ? labelInfo.color : "#E5E7EB" },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: labelInfo.color }]}>
        {t(labelInfo.key)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pipsRow: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  pip: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 12,
    minWidth: 50,
    textAlign: "right",
  },
});
