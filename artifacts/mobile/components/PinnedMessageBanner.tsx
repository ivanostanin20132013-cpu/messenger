import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ChatMessage } from "@/context/SocketContext";

interface Props {
  message: ChatMessage | undefined;
  isAdmin?: boolean;
  onUnpin?: () => void;
}

export function PinnedMessageBanner({ message, isAdmin, onUnpin }: Props) {
  const colors = useColors();
  if (!message) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Feather name="bookmark" size={14} color={colors.primary} />
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.primary }]}>Закреплено</Text>
        <Text style={[styles.text, { color: colors.foreground }]} numberOfLines={1}>
          {message.deleted ? "Сообщение удалено" : (message.text || "📷 Фото")}
        </Text>
      </View>
      {isAdmin && (
        <Pressable onPress={onUnpin} hitSlop={8}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  content: { flex: 1 },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
