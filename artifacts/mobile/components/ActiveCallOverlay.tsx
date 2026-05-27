import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCall } from "@/context/CallContext";
import { useColors } from "@/hooks/useColors";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function stringToColor(str: string): string {
  const cs = ["#e94560", "#533483", "#0f3460", "#1a6b4a", "#6b4a1a", "#4a1a6b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cs[Math.abs(hash) % cs.length];
}

export function ActiveCallOverlay() {
  const colors = useColors();
  const { callState, callPeer, isMuted, callDuration, endCall, toggleMute } = useCall();

  const visible = callState === "calling" || callState === "connected";
  if (!visible || !callPeer) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {callState === "calling" ? "Звоним..." : "Идёт звонок"}
        </Text>

        <View style={[styles.avatarWrap, { backgroundColor: stringToColor(callPeer) }]}>
          <Text style={styles.avatarText}>{callPeer[0]?.toUpperCase()}</Text>
        </View>

        <Text style={[styles.peerName, { color: colors.foreground }]}>{callPeer}</Text>

        {callState === "connected" && (
          <Text style={[styles.timer, { color: colors.primary }]}>
            {formatDuration(callDuration)}
          </Text>
        )}

        <View style={styles.controls}>
          <Pressable
            style={[styles.controlBtn, { backgroundColor: isMuted ? colors.primary : colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleMute();
            }}
          >
            <Feather name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.endBtn, { backgroundColor: "#ef4444" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              endCall();
            }}
          >
            <Feather name="phone-off" size={30} color="#fff" />
          </Pressable>

          <View style={[styles.controlBtn, { backgroundColor: colors.card, opacity: 0 }]} />
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {isMuted ? "Микрофон выключен" : "Микрофон включён"}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 40,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 52,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  peerName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  timer: {
    fontSize: 22,
    fontFamily: "Inter_500Medium",
    letterSpacing: 3,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
    marginTop: 40,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
});
