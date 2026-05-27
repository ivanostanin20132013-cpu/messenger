import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePinLock } from "@/context/PinLockContext";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const DIGITS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function PinLockScreen() {
  const colors = useColors();
  const { unlock, unlockWithBiometrics } = usePinLock();
  const { signOut } = useAuth();
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);

  const handleDigit = async (d: string) => {
    if (d === "⌫") { setInput((p) => p.slice(0, -1)); return; }
    if (d === "") return;
    const next = input + d;
    setInput(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.length >= 4) {
      const ok = await unlock(next);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setShake(true);
        setTimeout(() => { setShake(false); setInput(""); }, 500);
      }
    }
  };

  const handleBio = async () => {
    const ok = await unlockWithBiometrics();
    if (!ok) Alert.alert("Биометрия недоступна", "Введите PIN вручную");
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 40 },
    logo: { alignItems: "center", gap: 8 },
    logoIcon: { fontSize: 40 },
    logoText: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    dotsRow: { flexDirection: "row", gap: 16 },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
    dotFilled: { borderColor: colors.primary, backgroundColor: colors.primary },
    dotEmpty: { borderColor: colors.border, backgroundColor: "transparent" },
    keypad: { gap: 16, alignItems: "center" },
    keyRow: { flexDirection: "row", gap: 24 },
    key: {
      width: 72, height: 72, borderRadius: 36,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.card,
    },
    keyText: { fontSize: 26, color: colors.foreground, fontFamily: "Inter_400Regular" },
    keyEmpty: { backgroundColor: "transparent" },
    bioBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20,
      backgroundColor: colors.muted,
    },
    bioBtnText: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 },
    signoutBtn: { paddingTop: 8 },
    signoutText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 },
  });

  const rows = [DIGITS.slice(0,3), DIGITS.slice(3,6), DIGITS.slice(6,9), DIGITS.slice(9,12)];

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoIcon}>💬</Text>
        <Text style={styles.logoText}>Введите PIN</Text>
      </View>

      <View style={styles.dotsRow}>
        {[0,1,2,3].map((i) => (
          <View key={i} style={[styles.dot, input.length > i ? styles.dotFilled : styles.dotEmpty]} />
        ))}
      </View>

      <View style={styles.keypad}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((d, di) => (
              <Pressable
                key={di}
                style={({ pressed }) => [styles.key, d === "" && styles.keyEmpty, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => handleDigit(d)}
              >
                {d === "⌫"
                  ? <Feather name="delete" size={22} color={colors.foreground} />
                  : <Text style={styles.keyText}>{d}</Text>
                }
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Pressable style={styles.bioBtn} onPress={handleBio}>
        <Feather name="eye" size={18} color={colors.foreground} />
        <Text style={styles.bioBtnText}>Биометрия</Text>
      </Pressable>

      <Pressable style={styles.signoutBtn} onPress={signOut}>
        <Text style={styles.signoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </View>
  );
}
