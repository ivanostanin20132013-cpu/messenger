import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  users: string[];
}

export function TypingIndicator({ users }: Props) {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (users.length === 0) return;
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0); const a2 = anim(dot2, 150); const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [users.length, dot1, dot2, dot3]);

  if (users.length === 0) return null;

  const label = users.length === 1
    ? `${users[0]} печатает`
    : `${users.slice(0, 2).join(", ")} печатают`;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{label}</Text>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: colors.mutedForeground, transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 4, gap: 3 },
  text: { fontSize: 11, fontFamily: "Inter_400Regular", marginRight: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
