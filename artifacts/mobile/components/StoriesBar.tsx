import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Story } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";

function stringToColor(str: string): string {
  const cs = ["#e94560", "#533483", "#0f3460", "#1a6b4a", "#6b4a1a", "#4a1a6b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cs[Math.abs(hash) % cs.length];
}

interface Props {
  stories: Story[];
  onPost: (text: string, imageBase64?: string) => void;
}

export function StoriesBar({ stories, onPost }: Props) {
  const colors = useColors();
  const { username } = useAuth();
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [composing, setComposing] = useState(false);
  const [storyText, setStoryText] = useState("");

  const pickImageAndPost = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Нужен доступ к галерее"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      onPost(storyText, result.assets[0].base64 ?? undefined);
    } else if (storyText.trim()) {
      onPost(storyText);
    }
    setComposing(false);
    setStoryText("");
  };

  const uniqueAuthors = Array.from(new Map(stories.map((s) => [s.author, s])).values());

  return (
    <>
      <FlatList
        horizontal
        data={[null, ...uniqueAuthors]}
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item === null) {
            return (
              <Pressable style={styles.addStory} onPress={() => setComposing(true)}>
                <View style={[styles.storyRing, { borderColor: colors.border }]}>
                  <View style={[styles.storyAvatar, { backgroundColor: colors.muted }]}>
                    <Feather name="plus" size={20} color={colors.mutedForeground} />
                  </View>
                </View>
                <Text style={[styles.storyName, { color: colors.mutedForeground }]}>История</Text>
              </Pressable>
            );
          }
          const story = item as Story;
          return (
            <Pressable style={styles.addStory} onPress={() => setViewStory(story)}>
              <View style={[styles.storyRing, { borderColor: colors.primary }]}>
                {story.imageBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${story.imageBase64}` }} style={styles.storyAvatar} />
                ) : (
                  <View style={[styles.storyAvatar, { backgroundColor: stringToColor(story.author) }]}>
                    <Text style={styles.storyInitial}>{story.author[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.storyName, { color: colors.foreground }]} numberOfLines={1}>{story.author}</Text>
            </Pressable>
          );
        }}
      />

      {/* View story modal */}
      <Modal visible={!!viewStory} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setViewStory(null)}>
          <View style={[styles.storyViewer, { backgroundColor: colors.card }]}>
            <Text style={[styles.storyViewerAuthor, { color: colors.primary }]}>@{viewStory?.author}</Text>
            {viewStory?.imageBase64 && (
              <Image source={{ uri: `data:image/jpeg;base64,${viewStory.imageBase64}` }} style={styles.storyImage} resizeMode="contain" />
            )}
            {!!viewStory?.text && (
              <Text style={[styles.storyViewerText, { color: colors.foreground }]}>{viewStory.text}</Text>
            )}
            <Text style={[styles.storyTime, { color: colors.mutedForeground }]}>
              {viewStory ? new Date(viewStory.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* Compose story modal */}
      <Modal visible={composing} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setComposing(false)}>
          <Pressable style={[styles.composeCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.composeTitle, { color: colors.foreground }]}>Новая история</Text>
            <TextInput
              style={[styles.composeInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="Что происходит? (24 часа)"
              placeholderTextColor={colors.mutedForeground}
              value={storyText}
              onChangeText={setStoryText}
              multiline
            />
            <View style={styles.composeRow}>
              <Pressable style={[styles.composeBtn, { backgroundColor: colors.muted }]} onPress={pickImageAndPost}>
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={[styles.composeBtnText, { color: colors.foreground }]}>Фото</Text>
              </Pressable>
              <Pressable style={[styles.composeBtn, { backgroundColor: colors.primary }]} onPress={() => {
                if (storyText.trim()) { onPost(storyText); setComposing(false); setStoryText(""); }
              }}>
                <Text style={[styles.composeBtnText, { color: "#fff" }]}>Опубликовать</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  addStory: { alignItems: "center", gap: 4, width: 60 },
  storyRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, padding: 2 },
  storyAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  storyInitial: { fontSize: 20, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  storyName: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  storyViewer: { width: "100%", borderRadius: 20, padding: 24, alignItems: "center", gap: 12 },
  storyViewerAuthor: { fontSize: 16, fontFamily: "Inter_700Bold" },
  storyImage: { width: "100%", height: 220, borderRadius: 12 },
  storyViewerText: { fontSize: 18, fontFamily: "Inter_400Regular", textAlign: "center" },
  storyTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  composeCard: { width: "100%", borderRadius: 20, padding: 24, gap: 12 },
  composeTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  composeInput: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80 },
  composeRow: { flexDirection: "row", gap: 10 },
  composeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 10, gap: 6 },
  composeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
