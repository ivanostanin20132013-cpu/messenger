import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";
  const baseUrl = domain.includes("localhost")
    ? `http://${domain}/api`
    : `https://${domain}/api`;

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Введите имя и пароль");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as { ok: boolean; msg?: string; token?: string; username?: string };
      if (data.ok && data.token && data.username) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await signIn(data.token, data.username);
      } else {
        setError(data.msg ?? "Ошибка");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError("Сервер недоступен");
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    inner: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    logoText: {
      fontSize: 36,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: "Inter_700Bold",
      marginBottom: 8,
      letterSpacing: 2,
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 40,
    },
    input: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 16,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    error: {
      color: colors.primary,
      fontSize: 13,
      marginBottom: 12,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    primaryBtn: {
      width: "100%",
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 4,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      letterSpacing: 1,
    },
    switchRow: {
      flexDirection: "row",
      marginTop: 28,
      alignItems: "center",
      gap: 4,
    },
    switchText: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    switchLink: {
      color: colors.secondary,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>💬</Text>
        </View>
        <Text style={styles.title}>МЕССЕНДЖЕР</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Войдите в свой аккаунт" : "Создайте новый аккаунт"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Имя пользователя"
          placeholderTextColor={colors.mutedForeground}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {mode === "login" ? "ВОЙТИ" : "ЗАРЕГИСТРИРОВАТЬСЯ"}
            </Text>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          </Text>
          <Pressable onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            <Text style={styles.switchLink}>
              {mode === "login" ? " Регистрация" : " Войти"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
