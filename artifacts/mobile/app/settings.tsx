import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useSettings, type AppTheme, type AppLanguage } from "@/context/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const APP_VERSION = "1.0.0";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username, signOut } = useAuth();
  const { theme, language, setTheme, setLanguage } = useSettings();
  const { t } = useTranslation();

  const themes: { value: AppTheme; label: string; icon: string }[] = [
    { value: "dark", label: t("themeDark"), icon: "moon" },
    { value: "light", label: t("themeLight"), icon: "sun" },
    { value: "system", label: t("themeSystem"), icon: "smartphone" },
  ];

  const langs: { value: AppLanguage; label: string }[] = [
    { value: "ru", label: t("langRu") },
    { value: "en", label: t("langEn") },
  ];

  const handleDeleteAccount = () => {
    Alert.alert(
      t("deleteAccount"),
      t("deleteAccountConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("deleteAccountBtn"),
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top },
    header: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: {
      flex: 1, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold",
      color: colors.foreground, textAlign: "center",
    },
    scroll: { paddingTop: 24 },
    sectionLabel: {
      fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold",
      letterSpacing: 1.5, textTransform: "uppercase",
      marginBottom: 8, marginTop: 20, paddingHorizontal: 20,
    },
    card: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLabel: { flex: 1, fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular" },
    rowIcon: { marginRight: 12 },
    themeChips: {
      flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 4,
    },
    chip: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 12, borderRadius: 12, gap: 6,
      borderWidth: 2, borderColor: "transparent", backgroundColor: colors.card,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.muted },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    chipTextActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    langChips: {
      flexDirection: "row", marginHorizontal: 16, gap: 10,
    },
    aboutRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 14,
    },
    aboutLabel: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular" },
    aboutValue: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    deleteBtn: {
      marginHorizontal: 16, marginTop: 24, borderRadius: 14,
      borderWidth: 1, borderColor: colors.destructive,
      paddingVertical: 14, alignItems: "center",
    },
    deleteBtnText: { color: colors.destructive, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    footer: { paddingVertical: 32, alignItems: "center" },
    footerText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>{t("settings")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* APPEARANCE */}
        <Text style={s.sectionLabel}>{t("appearance")}</Text>
        <View style={s.themeChips}>
          {themes.map(({ value, label, icon }) => (
            <Pressable
              key={value}
              style={[s.chip, theme === value && s.chipActive]}
              onPress={() => setTheme(value)}
            >
              <Feather
                name={icon as any}
                size={16}
                color={theme === value ? colors.primary : colors.mutedForeground}
              />
              <Text style={[s.chipText, theme === value && s.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* LANGUAGE */}
        <Text style={s.sectionLabel}>{t("language")}</Text>
        <View style={s.langChips}>
          {langs.map(({ value, label }) => (
            <Pressable
              key={value}
              style={[s.chip, language === value && s.chipActive]}
              onPress={() => setLanguage(value)}
            >
              <Text style={[s.chipText, language === value && s.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ACCOUNT */}
        <Text style={s.sectionLabel}>{t("account")}</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Feather name="user" size={18} color={colors.mutedForeground} style={s.rowIcon} />
            <Text style={s.rowLabel}>{username}</Text>
          </View>
          <Pressable style={s.rowLast} onPress={() => router.push("/profile" as any)}>
            <Feather name="edit-2" size={18} color={colors.mutedForeground} style={s.rowIcon} />
            <Text style={s.rowLabel}>{t("profile")}</Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* ABOUT */}
        <Text style={s.sectionLabel}>{t("about")}</Text>
        <View style={s.card}>
          <View style={s.aboutRow}>
            <Text style={s.aboutLabel}>{t("version")}</Text>
            <Text style={s.aboutValue}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* DELETE */}
        <Pressable style={s.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={s.deleteBtnText}>{t("deleteAccount")}</Text>
        </Pressable>

        <View style={s.footer}>
          <Text style={s.footerText}>Мессенджер · {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
