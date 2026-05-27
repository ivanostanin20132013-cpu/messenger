import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { usePinLock } from "@/context/PinLockContext";
import { useColors } from "@/hooks/useColors";

function stringToColor(str: string): string {
  const cs = ["#e94560", "#533483", "#0f3460", "#1a6b4a", "#6b4a1a", "#4a1a6b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cs[Math.abs(hash) % cs.length];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username, signOut } = useAuth();
  const { onlineUsers, updateProfile } = useSocket();
  const { pinEnabled, setupPin, removePin } = usePinLock();

  const myProfile = onlineUsers.find((u) => u.username === username);
  const [status, setStatus] = useState(myProfile?.status ?? "");
  const [avatar, setAvatar] = useState<string | undefined>(myProfile?.avatarBase64);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Нужен доступ к галерее"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.4,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatar(result.assets[0].base64);
    }
  };

  const saveProfile = () => {
    updateProfile(status, avatar);
    Alert.alert("Сохранено", "Профиль обновлён");
  };

  const handlePinToggle = async () => {
    if (pinEnabled) {
      Alert.alert("Удалить PIN?", "", [
        { text: "Отмена", style: "cancel" },
        { text: "Удалить", style: "destructive", onPress: () => removePin() },
      ]);
    } else {
      setShowPinInput(true);
    }
  };

  const confirmPin = async () => {
    if (pinInput.length < 4) { Alert.alert("PIN должен быть минимум 4 цифры"); return; }
    await setupPin(pinInput);
    setPinInput("");
    setShowPinInput(false);
    Alert.alert("PIN установлен");
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top },
    header: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    avatarSection: { alignItems: "center", paddingVertical: 32 },
    avatarWrap: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: stringToColor(username ?? ""),
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    avatarImg: { width: 100, height: 100 },
    avatarInitial: { fontSize: 40, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
    username: { marginTop: 12, fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    editBtn: {
      marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 6,
    },
    editBtnText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" },
    section: { paddingHorizontal: 16, marginBottom: 20 },
    sectionTitle: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 },
    input: {
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
      borderWidth: 1, borderColor: colors.border,
    },
    row: {
      backgroundColor: colors.card, borderRadius: 12, flexDirection: "row",
      alignItems: "center", padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    rowLabel: { flex: 1, fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular" },
    saveBtn: {
      marginHorizontal: 16, backgroundColor: colors.primary, borderRadius: 12,
      padding: 16, alignItems: "center", marginBottom: 12,
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    logoutBtn: {
      marginHorizontal: 16, backgroundColor: "transparent", borderRadius: 12, borderWidth: 1,
      borderColor: colors.destructive, padding: 16, alignItems: "center",
    },
    logoutBtnText: { color: colors.destructive, fontSize: 16, fontFamily: "Inter_600SemiBold" },
    pinInputWrap: { marginTop: 10 },
    pinInput: {
      backgroundColor: colors.muted, borderRadius: 10, padding: 12, fontSize: 22,
      color: colors.foreground, textAlign: "center", letterSpacing: 10, fontFamily: "Inter_400Regular",
    },
    pinConfirmBtn: {
      marginTop: 8, backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center",
    },
    pinConfirmText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{(username ?? "?")[0]?.toUpperCase()}</Text>
              )}
            </View>
          </Pressable>
          <Text style={styles.username}>@{username}</Text>
          <Pressable style={styles.editBtn} onPress={pickAvatar}>
            <Feather name="camera" size={14} color={colors.foreground} />
            <Text style={styles.editBtnText}>Изменить фото</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Статус</Text>
          <TextInput
            style={styles.input}
            placeholder="Что у вас нового?"
            placeholderTextColor={colors.mutedForeground}
            value={status}
            onChangeText={setStatus}
            maxLength={60}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Безопасность</Text>
          <Pressable style={styles.row} onPress={handlePinToggle}>
            <Feather name="lock" size={18} color={pinEnabled ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.rowLabel, { marginLeft: 10 }]}>
              {pinEnabled ? "PIN включён" : "Включить PIN / биометрию"}
            </Text>
            <Feather name={pinEnabled ? "toggle-right" : "toggle-left"} size={22} color={pinEnabled ? colors.primary : colors.mutedForeground} />
          </Pressable>
          {showPinInput && (
            <View style={styles.pinInputWrap}>
              <TextInput
                style={styles.pinInput}
                placeholder="• • • •"
                placeholderTextColor={colors.mutedForeground}
                value={pinInput}
                onChangeText={setPinInput}
                keyboardType="numeric"
                secureTextEntry
                maxLength={8}
              />
              <Pressable style={styles.pinConfirmBtn} onPress={confirmPin}>
                <Text style={styles.pinConfirmText}>Сохранить PIN</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable style={styles.saveBtn} onPress={saveProfile}>
          <Text style={styles.saveBtnText}>Сохранить профиль</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
