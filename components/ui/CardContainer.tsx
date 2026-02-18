import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius } from "../../theme/tokens";

interface CardContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  noBorder?: boolean;
}

export default function CardContainer({
  children,
  style,
  noBorder = false,
}: CardContainerProps) {
  return (
    <View style={[styles.card, noBorder && styles.noBorder, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noBorder: {
    borderWidth: 0,
  },
});
