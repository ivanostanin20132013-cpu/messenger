import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSocket } from "@/context/SocketContext";

export function InAppNotification() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { registerNotificationHandler } = useSocket();
  const [notif, setNotif] = useState<{ text: string; from: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, from: string) => {
    setNotif({ text, from });
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => setNotif(null));
    }, 3000);
  }, [slideAnim]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => setNotif(null));
  }, [slideAnim]);

  useEffect(() => {
    return registerNotificationHandler(show);
  }, [registerNotificationHandler, show]);

  if (!notif) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + 8, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable style={styles.inner} onPress={dismiss}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <View style={styles.content}>
          <Text style={[styles.from, { color: colors.primary }]}>{notif.from}</Text>
          <Text style={[styles.text, { color: colors.foreground }]} numberOfLines={1}>{notif.text}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 999,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  inner: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { flex: 1 },
  from: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  text: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
