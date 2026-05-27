import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCall } from "@/context/CallContext";
import { useColors } from "@/hooks/useColors";

function stringToColor(str: string): string {
  const cs = ["#e94560", "#533483", "#0f3460", "#1a6b4a", "#6b4a1a", "#4a1a6b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cs[Math.abs(hash) % cs.length];
}

export function IncomingCallModal() {
  const colors = useColors();
  const { callState, callPeer, acceptCall, rejectCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const visible = callState === "ringing";

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible, pulseAnim]);

  if (!visible || !callPeer) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Входящий звонок</Text>

          <Animated.View
            style={[
              styles.avatarWrap,
              { backgroundColor: stringToColor(callPeer), transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.avatarText}>{callPeer[0]?.toUpperCase()}</Text>
          </Animated.View>

          <Text style={[styles.callerName, { color: colors.foreground }]}>{callPeer}</Text>

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, { backgroundColor: "#22c55e" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void acceptCall();
              }}
            >
              <Feather name="phone" size={28} color="#fff" />
            </Pressable>

            <Pressable
              style={[styles.btn, { backgroundColor: "#ef4444" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                rejectCall();
              }}
            >
              <Feather name="phone-off" size={28} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Принять</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Отклонить</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  callerName: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 48,
    marginTop: 16,
  },
  btn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  labelRow: {
    flexDirection: "row",
    gap: 80,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
