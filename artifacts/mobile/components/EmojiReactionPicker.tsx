import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface Props {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiReactionPicker({ visible, onSelect, onClose }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              style={({ pressed }) => [styles.emoji, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => { onSelect(e); onClose(); }}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    flexDirection: "row",
    borderRadius: 32,
    padding: 12,
    gap: 4,
    borderWidth: 1,
  },
  emoji: {
    padding: 8,
    borderRadius: 24,
  },
  emojiText: {
    fontSize: 28,
  },
});
