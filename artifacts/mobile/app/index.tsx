import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import { useSocket, type ChatMessage, type UserInfo } from "@/context/SocketContext";
import { useColors } from "@/hooks/useColors";
import { EmojiReactionPicker } from "@/components/EmojiReactionPicker";
import { PinnedMessageBanner } from "@/components/PinnedMessageBanner";
import { TypingIndicator } from "@/components/TypingIndicator";
import { StoriesBar } from "@/components/StoriesBar";

const GENERAL = "Общий";

type ChatMode = { kind: "group"; name: string } | { kind: "dm"; peer: string };

function stringToColor(str: string): string {
  const cs = ["#e94560", "#533483", "#0f3460", "#1a6b4a", "#6b4a1a", "#4a1a6b"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cs[Math.abs(hash) % cs.length];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username, signOut } = useAuth();
  const { callState, startCall } = useCall();
  const {
    connected, onlineUsers, groupMessages, dmMessages, groupMeta, typingUsers,
    stories, unreadCounts, clearUnread,
    sendMessage, sendDm, requestDmHistory, createGroup, joinGroup,
    sendTyping, sendReaction, deleteMessage, pinMessage, kickUser,
    updateProfile, postStory,
  } = useSocket();

  const [chat, setChat] = useState<ChatMode>({ kind: "group", name: GENERAL });
  const [myGroups, setMyGroups] = useState<string[]>([GENERAL]);
  const [inputText, setInputText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"groups" | "users">("groups");
  const [reactionTarget, setReactionTarget] = useState<ChatMessage | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatKey = chat.kind === "group" ? chat.name : `@${chat.peer}`;
  const messages: ChatMessage[] =
    chat.kind === "group" ? (groupMessages[chat.name] ?? []) : (dmMessages[chat.peer] ?? []);
  const meta = chat.kind === "group" ? (groupMeta[chat.name] ?? {}) : {};
  const pinnedMessage = meta.pinnedMessageId
    ? messages.find((m) => m.id === meta.pinnedMessageId)
    : undefined;
  const typingKey = chat.kind === "group" ? chat.name : `@${chat.peer}`;
  const currentTyping = (typingUsers[typingKey] ?? []).filter((u) => u !== username);
  const isAdmin = meta.isAdmin ?? false;
  const otherOnline = onlineUsers.filter((u) => u.username !== username);

  useEffect(() => {
    clearUnread(chatKey);
  }, [chat, clearUnread, chatKey]);

  useEffect(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const handleSend = useCallback(async (imageBase64?: string) => {
    const text = inputText.trim();
    if (!text && !imageBase64) return;
    if (chat.kind === "group") sendMessage(chat.name, text, imageBase64);
    else sendDm(chat.peer, text, imageBase64);
    setInputText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [inputText, chat, sendMessage, sendDm]);

  const handleTextChange = (val: string) => {
    setInputText(val);
    if (chat.kind === "group") sendTyping(chat.name);
    else sendTyping(undefined, chat.peer);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {}, 3000);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Нужен доступ к галерее"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      handleSend(result.assets[0].base64);
    }
  };

  const openCreateGroup = () => {
    Alert.prompt("Создать группу", "Название группы", (name) => {
      if (!name || myGroups.includes(name)) return;
      setMyGroups((g) => [...g, name]);
      createGroup(name);
      setChat({ kind: "group", name });
      setSidebarOpen(false);
    });
  };

  const openJoinGroup = () => {
    Alert.prompt("Вступить в группу", "Название группы", (name) => {
      if (!name) return;
      if (!myGroups.includes(name)) setMyGroups((g) => [...g, name]);
      joinGroup(name);
      setChat({ kind: "group", name });
      setSidebarOpen(false);
    });
  };

  const openDm = (peer: string) => {
    if (peer === username) return;
    requestDmHistory(peer);
    setChat({ kind: "dm", peer });
    clearUnread(`@${peer}`);
    setSidebarOpen(false);
  };

  const handleLongPress = (msg: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isMe = msg.from === username;
    const options: { text: string; style?: "destructive" | "cancel"; onPress: () => void }[] = [
      { text: "😊 Реакция", onPress: () => setReactionTarget(msg) },
    ];
    if (isMe || (isAdmin && chat.kind === "group")) {
      options.push({
        text: "🗑 Удалить",
        style: "destructive",
        onPress: () => {
          if (chat.kind === "group") deleteMessage(msg.id, chat.name);
          else deleteMessage(msg.id, undefined, chat.peer);
        },
      });
    }
    if (isAdmin && chat.kind === "group" && !msg.deleted) {
      const alreadyPinned = meta.pinnedMessageId === msg.id;
      options.push({
        text: alreadyPinned ? "📌 Открепить" : "📌 Закрепить",
        onPress: () => pinMessage(alreadyPinned ? undefined : msg.id, (chat as { name: string }).name),
      });
    }
    options.push({ text: "Отмена", style: "cancel", onPress: () => {} });
    Alert.alert("Действие", "", options.map((o) => ({ text: o.text, style: o.style, onPress: o.onPress })));
  };

  const handleReaction = (emoji: string) => {
    if (!reactionTarget) return;
    if (chat.kind === "group") sendReaction(reactionTarget.id, emoji, chat.name);
    else sendReaction(reactionTarget.id, emoji, undefined, chat.peer);
    setReactionTarget(null);
  };

  const handleKick = (target: string) => {
    if (!isAdmin || chat.kind !== "group") return;
    Alert.alert(`Исключить ${target}?`, "", [
      { text: "Отмена", style: "cancel" },
      { text: "Исключить", style: "destructive", onPress: () => kickUser(target, (chat as { name: string }).name) },
    ]);
  };

  const renderReactions = (msg: ChatMessage) => {
    const entries = Object.entries(msg.reactions ?? {}).filter(([, users]) => users.length > 0);
    if (entries.length === 0) return null;
    return (
      <View style={styles.reactionsRow}>
        {entries.map(([emoji, users]) => (
          <Pressable
            key={emoji}
            style={[styles.reactionChip, { backgroundColor: colors.muted, borderColor: users.includes(username ?? "") ? colors.primary : "transparent" }]}
            onPress={() => {
              if (chat.kind === "group") sendReaction(msg.id, emoji, chat.name);
              else sendReaction(msg.id, emoji, undefined, chat.peer);
            }}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={[styles.reactionCount, { color: colors.mutedForeground }]}>{users.length}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.from === username;
    const isSystem = item.from === "🔧 Система";
    if (isSystem) {
      return (
        <View style={styles.systemMsgWrap}>
          <Text style={[styles.systemMsg, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>{item.text}</Text>
        </View>
      );
    }
    return (
      <Pressable onLongPress={() => !item.deleted && handleLongPress(item)}>
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={[styles.avatar, { backgroundColor: stringToColor(item.from) }]}>
              {(() => {
                const u = onlineUsers.find((u) => u.username === item.from);
                return u?.avatarBase64
                  ? <Image source={{ uri: `data:image/jpeg;base64,${u.avatarBase64}` }} style={styles.avatar} />
                  : <Text style={styles.avatarText}>{item.from[0]?.toUpperCase()}</Text>;
              })()}
            </View>
          )}
          <View style={{ maxWidth: "70%" }}>
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && !isSystem && <Text style={styles.bubbleSender}>{item.from}</Text>}
              {item.deleted ? (
                <Text style={[styles.deletedText, { color: isMe ? "rgba(255,255,255,0.5)" : colors.mutedForeground }]}>Сообщение удалено</Text>
              ) : item.imageBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
                  style={styles.msgImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
              )}
              <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{formatTime(item.timestamp)}</Text>
            </View>
            {renderReactions(item)}
          </View>
        </View>
      </Pressable>
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", backgroundColor: colors.card,
      paddingTop: insets.top + (Platform.OS === "web" ? 30 : 0),
      paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
    },
    headerTitle: { flex: 1 },
    headerGroup: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.primary },
    headerUser: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    list: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
    msgRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end", gap: 6 },
    msgRowMe: { flexDirection: "row-reverse" },
    avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
    avatarText: { fontSize: 12, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
    bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
    bubbleThem: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
    bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleSender: { fontSize: 10, fontWeight: "600", color: colors.secondary, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    bubbleText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 20 },
    bubbleTextMe: { color: "#fff" },
    bubbleTime: { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", alignSelf: "flex-end", marginTop: 2 },
    bubbleTimeMe: { color: "rgba(255,255,255,0.6)" },
    deletedText: { fontSize: 13, fontStyle: "italic" },
    msgImage: { width: 200, height: 160, borderRadius: 10, marginVertical: 2 },
    reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3, paddingHorizontal: 2 },
    reactionChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: 11, fontFamily: "Inter_500Medium" },
    systemMsgWrap: { alignItems: "center", marginVertical: 4 },
    systemMsg: { fontSize: 11, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
    inputArea: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 10,
      paddingVertical: 8, paddingBottom: insets.bottom + 8,
      backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
    },
    textInput: {
      flex: 1, backgroundColor: colors.muted, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular", maxHeight: 100,
    },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    emptyWrap: { alignItems: "center", marginTop: 60 },
    emptyText: { color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 14 },
    sidebarOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, flexDirection: "row" },
    sidebar: {
      width: 290, backgroundColor: colors.card,
      paddingTop: insets.top + (Platform.OS === "web" ? 60 : 0),
      borderRightWidth: 1, borderRightColor: colors.border,
    },
    sidebarHeader: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
    },
    sidebarTitle: { flex: 1, fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    tabRow: { flexDirection: "row", margin: 10, backgroundColor: colors.muted, borderRadius: 10, padding: 3 },
    tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 7, borderRadius: 8, gap: 5 },
    tabActive: { backgroundColor: colors.card },
    tabText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    tabTextActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    listItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
    listItemActive: { backgroundColor: colors.muted },
    listIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    listIconActive: { backgroundColor: colors.primary },
    listName: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    listNameActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    badge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    badgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
    statusDotSm: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
    statusText: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    actionButtons: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 7 },
    actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 8 },
    actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
    kickBtn: { padding: 4 },
    sidebarDismiss: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    userAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    userAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  });

  const isActiveGroup = (name: string) => chat.kind === "group" && chat.name === name;
  const isActiveDm = (peer: string) => chat.kind === "dm" && chat.peer === peer;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setSidebarOpen(true)} hitSlop={12}>
          <Feather name="menu" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.headerGroup} numberOfLines={1}>
            {chat.kind === "group" ? `# ${chat.name}` : `💬 ${chat.peer}`}
          </Text>
          <Text style={styles.headerUser}>@{username}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: connected ? "#22c55e" : "#ef4444" }]} />
        {chat.kind === "dm" && callState === "idle" && (
          <Pressable hitSlop={12} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void startCall(chat.peer); }}>
            <Feather name="phone" size={20} color="#22c55e" />
          </Pressable>
        )}
        <Pressable hitSlop={12} onPress={() => router.push("/profile")}>
          <Feather name="user" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable hitSlop={12} onPress={() => router.push("/settings" as any)}>
          <Feather name="settings" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Pinned message */}
      {chat.kind === "group" && pinnedMessage && (
        <PinnedMessageBanner
          message={pinnedMessage}
          isAdmin={isAdmin}
          onUnpin={() => pinMessage(undefined, (chat as { name: string }).name)}
        />
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={styles.emptyText}>Нет сообщений. Начните общение!</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      <TypingIndicator users={currentTyping} />

      {/* Input */}
      <View style={styles.inputArea}>
        <Pressable style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={pickImage}>
          <Feather name="image" size={18} color={colors.mutedForeground} />
        </Pressable>
        <TextInput
          style={styles.textInput}
          placeholder="Сообщение..."
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          blurOnSubmit={false}
        />
        <Pressable style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => handleSend()}>
          <Feather name="send" size={17} color="#fff" />
        </Pressable>
      </View>

      {/* Emoji reaction picker */}
      <EmojiReactionPicker
        visible={!!reactionTarget}
        onSelect={handleReaction}
        onClose={() => setReactionTarget(null)}
      />

      {/* Sidebar */}
      {sidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>💬 Мессенджер</Text>
              <Pressable hitSlop={8} onPress={() => setSidebarOpen(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Stories */}
            <StoriesBar stories={stories} onPost={postStory} />

            {/* Tabs */}
            <View style={styles.tabRow}>
              {(["groups", "users"] as const).map((tab) => (
                <Pressable key={tab} style={[styles.tab, sidebarTab === tab && styles.tabActive]} onPress={() => setSidebarTab(tab)}>
                  <Feather name={tab === "groups" ? "hash" : "users"} size={13} color={sidebarTab === tab ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.tabText, sidebarTab === tab && styles.tabTextActive]}>
                    {tab === "groups" ? "Группы" : `Люди (${otherOnline.length})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {sidebarTab === "groups" ? (
                <>
                  {myGroups.map((g) => {
                    const count = unreadCounts[g] ?? 0;
                    return (
                      <Pressable key={g} style={[styles.listItem, isActiveGroup(g) && styles.listItemActive]}
                        onPress={() => { setChat({ kind: "group", name: g }); clearUnread(g); setSidebarOpen(false); }}>
                        <View style={[styles.listIcon, isActiveGroup(g) && styles.listIconActive]}>
                          <Feather name="hash" size={14} color={isActiveGroup(g) ? "#fff" : colors.mutedForeground} />
                        </View>
                        <Text style={[styles.listName, isActiveGroup(g) && styles.listNameActive]} numberOfLines={1}>{g}</Text>
                        {count > 0 && !isActiveGroup(g) && (
                          <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text></View>
                        )}
                      </Pressable>
                    );
                  })}
                  <View style={styles.actionButtons}>
                    <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={openCreateGroup}>
                      <Feather name="plus" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Создать группу</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, { backgroundColor: colors.secondary }]} onPress={openJoinGroup}>
                      <Feather name="unlock" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Вступить</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                otherOnline.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24, fontFamily: "Inter_400Regular", fontSize: 13 }}>Нет онлайн пользователей</Text>
                ) : (
                  otherOnline.map((u: UserInfo) => {
                    const count = unreadCounts[`@${u.username}`] ?? 0;
                    return (
                      <Pressable key={u.username} style={[styles.listItem, isActiveDm(u.username) && styles.listItemActive]}
                        onPress={() => openDm(u.username)}>
                        <View style={[styles.userAvatar, { backgroundColor: stringToColor(u.username) }]}>
                          {u.avatarBase64
                            ? <Image source={{ uri: `data:image/jpeg;base64,${u.avatarBase64}` }} style={styles.userAvatar} />
                            : <Text style={styles.userAvatarText}>{u.username[0]?.toUpperCase()}</Text>}
                        </View>
                        <View style={{ flex: 1, overflow: "hidden" }}>
                          <Text style={[styles.listName, isActiveDm(u.username) && styles.listNameActive]} numberOfLines={1}>{u.username}</Text>
                          <View style={styles.statusRow}>
                            <View style={styles.statusDotSm} />
                            <Text style={styles.statusText} numberOfLines={1}>{u.status || "онлайн"}</Text>
                          </View>
                        </View>
                        {count > 0 && !isActiveDm(u.username) && (
                          <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text></View>
                        )}
                        {isAdmin && chat.kind === "group" && (
                          <Pressable style={styles.kickBtn} onPress={() => handleKick(u.username)} hitSlop={8}>
                            <Feather name="user-x" size={14} color={colors.destructive} />
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })
                )
              )}
            </ScrollView>
          </View>
          <Pressable style={styles.sidebarDismiss} onPress={() => setSidebarOpen(false)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
