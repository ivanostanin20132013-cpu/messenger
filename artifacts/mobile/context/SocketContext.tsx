import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

export interface Reaction { [emoji: string]: string[] }

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  imageBase64?: string;
  timestamp: number;
  deleted?: boolean;
  reactions: Reaction;
}

export interface UserInfo {
  username: string;
  status: string;
  avatarBase64?: string;
}

export interface Story {
  id: string;
  author: string;
  text: string;
  imageBase64?: string;
  timestamp: number;
}

export interface CallSignalMsg {
  type: string;
  from: string;
  to?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type CallSignalHandler = (msg: CallSignalMsg) => void;
type NotificationHandler = (text: string, from: string) => void;

interface GroupMeta {
  pinnedMessageId?: string;
  isAdmin?: boolean;
}

interface SocketContextValue {
  connected: boolean;
  onlineUsers: UserInfo[];
  groupMessages: Record<string, ChatMessage[]>;
  dmMessages: Record<string, ChatMessage[]>;
  groupMeta: Record<string, GroupMeta>;
  typingUsers: Record<string, string[]>;
  stories: Story[];
  unreadCounts: Record<string, number>;
  clearUnread: (key: string) => void;

  sendMessage: (group: string, text: string, imageBase64?: string) => void;
  sendDm: (to: string, text: string, imageBase64?: string) => void;
  requestDmHistory: (withUser: string) => void;
  createGroup: (name: string) => void;
  joinGroup: (name: string) => void;
  sendTyping: (group?: string, to?: string) => void;
  sendReaction: (messageId: string, emoji: string, group?: string, to?: string) => void;
  deleteMessage: (messageId: string, group?: string, to?: string) => void;
  pinMessage: (messageId: string | undefined, group: string) => void;
  kickUser: (target: string, group: string) => void;
  updateProfile: (status: string, avatarBase64?: string) => void;
  postStory: (text: string, imageBase64?: string) => void;
  sendCallSignal: (to: string, type: string, extra?: object) => void;
  registerCallHandler: (h: CallSignalHandler) => () => void;
  registerNotificationHandler: (h: NotificationHandler) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const CALL_TYPES = new Set(["call_offer","call_answer","call_ice","call_reject","call_end","call_ring"]);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, username: myUsername } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const callHandlersRef = useRef<Set<CallSignalHandler>>(new Set());
  const notifHandlersRef = useRef<Set<NotificationHandler>>(new Set());

  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([]);
  const [groupMessages, setGroupMessages] = useState<Record<string, ChatMessage[]>>({ Общий: [] });
  const [dmMessages, setDmMessages] = useState<Record<string, ChatMessage[]>>({});
  const [groupMeta, setGroupMeta] = useState<Record<string, GroupMeta>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [stories, setStories] = useState<Story[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const clearUnread = useCallback((key: string) => {
    setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
  }, []);

  const incrementUnread = useCallback((key: string, from: string, text: string) => {
    setUnreadCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    notifHandlersRef.current.forEach((h) => h(text, from));
  }, []);

  const applyReactionUpdate = useCallback((messageId: string, reactions: Reaction, group?: string, peer?: string) => {
    if (group) {
      setGroupMessages((prev) => ({
        ...prev,
        [group]: (prev[group] ?? []).map((m) => m.id === messageId ? { ...m, reactions } : m),
      }));
    } else if (peer) {
      setDmMessages((prev) => ({
        ...prev,
        [peer]: (prev[peer] ?? []).map((m) => m.id === messageId ? { ...m, reactions } : m),
      }));
    }
  }, []);

  const applyMessageDeleted = useCallback((messageId: string, group?: string, peer?: string) => {
    const mark = (m: ChatMessage) => m.id === messageId ? { ...m, deleted: true, text: "", imageBase64: undefined } : m;
    if (group) setGroupMessages((prev) => ({ ...prev, [group]: (prev[group] ?? []).map(mark) }));
    else if (peer) setDmMessages((prev) => ({ ...prev, [peer]: (prev[peer] ?? []).map(mark) }));
  }, []);

  useEffect(() => {
    if (!token) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";
    const protocol = domain.includes("localhost") ? "ws" : "wss";
    const ws = new WebSocket(`${protocol}://${domain}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        const type = msg["type"] as string;

        if (CALL_TYPES.has(type)) { callHandlersRef.current.forEach((h) => h(msg as unknown as CallSignalMsg)); return; }

        if (type === "auth_ok") { setConnected(true); return; }

        if (type === "users") {
          setOnlineUsers(msg["online"] as UserInfo[] ?? []);
          return;
        }

        if (type === "stories") { setStories(msg["stories"] as Story[] ?? []); return; }
        if (type === "new_story") {
          const story = msg["story"] as Story;
          setStories((prev) => [story, ...prev]);
          return;
        }

        if (type === "message") {
          const group = msg["group"] as string;
          const message = msg["message"] as ChatMessage;
          setGroupMessages((prev) => ({ ...prev, [group]: [...(prev[group] ?? []), message] }));
          if (message.from !== myUsername) incrementUnread(group, message.from, message.text || "📷 Фото");
          return;
        }

        if (type === "history") {
          const group = msg["group"] as string;
          setGroupMessages((prev) => ({ ...prev, [group]: msg["messages"] as ChatMessage[] ?? [] }));
          setGroupMeta((prev) => ({ ...prev, [group]: { pinnedMessageId: msg["pinnedMessageId"] as string | undefined, isAdmin: msg["isAdmin"] as boolean | undefined } }));
          return;
        }

        if (type === "dm") {
          const from = msg["from"] as string;
          const to = msg["to"] as string;
          const message = msg["message"] as ChatMessage;
          const peer = from === myUsername ? to : from;
          setDmMessages((prev) => ({ ...prev, [peer]: [...(prev[peer] ?? []), message] }));
          if (from !== myUsername) incrementUnread(`@${from}`, from, message.text || "📷 Фото");
          return;
        }

        if (type === "dm_history") {
          const peer = msg["with"] as string;
          setDmMessages((prev) => ({ ...prev, [peer]: msg["messages"] as ChatMessage[] ?? [] }));
          return;
        }

        if (type === "typing") {
          const from = msg["from"] as string;
          const key = (msg["group"] as string) ?? `@${msg["from"] as string}`;
          setTypingUsers((prev) => {
            const cur = prev[key] ?? [];
            if (cur.includes(from)) return prev;
            return { ...prev, [key]: [...cur, from] };
          });
          return;
        }

        if (type === "stop_typing") {
          const from = msg["from"] as string;
          const key = (msg["group"] as string) ?? `@${msg["from"] as string}`;
          setTypingUsers((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((u) => u !== from) }));
          return;
        }

        if (type === "reaction_update") {
          const messageId = msg["messageId"] as string;
          const reactions = msg["reactions"] as Reaction;
          const group = msg["group"] as string | undefined;
          const peer = msg["peer"] as string | undefined;
          applyReactionUpdate(messageId, reactions, group, peer);
          return;
        }

        if (type === "message_deleted") {
          applyMessageDeleted(msg["messageId"] as string, msg["group"] as string | undefined, msg["peer"] as string | undefined);
          return;
        }

        if (type === "pinned_update") {
          const group = msg["group"] as string;
          setGroupMeta((prev) => ({ ...prev, [group]: { ...prev[group], pinnedMessageId: msg["pinnedMessageId"] as string | undefined } }));
          return;
        }

        if (type === "kicked") {
          const group = msg["group"] as string;
          setGroupMessages((prev) => { const n = { ...prev }; delete n[group]; return n; });
          return;
        }

        if (type === "system") {
          const group = msg["group"] as string;
          const text = msg["text"] as string;
          const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, from: "🔧 Система", text, timestamp: Date.now(), reactions: {} };
          setGroupMessages((prev) => ({ ...prev, [group]: [...(prev[group] ?? []), sysMsg] }));
          return;
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => { setConnected(false); setOnlineUsers([]); };
    return () => { ws.close(); wsRef.current = null; setConnected(false); };
  }, [token, myUsername, incrementUnread, applyReactionUpdate, applyMessageDeleted]);

  const sendMessage = useCallback((group: string, text: string, imageBase64?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "send", group, text, imageBase64 }));
  }, []);

  const sendDm = useCallback((to: string, text: string, imageBase64?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "dm", to, text, imageBase64 }));
  }, []);

  const requestDmHistory = useCallback((withUser: string) => {
    wsRef.current?.send(JSON.stringify({ type: "dm_history", with: withUser }));
  }, []);

  const createGroup = useCallback((name: string) => {
    wsRef.current?.send(JSON.stringify({ type: "create", name }));
    setGroupMessages((prev) => ({ ...prev, [name]: [] }));
  }, []);

  const joinGroup = useCallback((name: string) => {
    wsRef.current?.send(JSON.stringify({ type: "join", name }));
    setGroupMessages((prev) => ({ ...prev, [name]: [] }));
  }, []);

  const sendTyping = useCallback((group?: string, to?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "typing", group, to }));
  }, []);

  const sendReaction = useCallback((messageId: string, emoji: string, group?: string, to?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "react", messageId, emoji, group, to }));
  }, []);

  const deleteMessage = useCallback((messageId: string, group?: string, to?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "delete_msg", messageId, group, to }));
  }, []);

  const pinMessage = useCallback((messageId: string | undefined, group: string) => {
    wsRef.current?.send(JSON.stringify({ type: "pin_msg", messageId, group }));
  }, []);

  const kickUser = useCallback((target: string, group: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kick", target, group }));
  }, []);

  const updateProfile = useCallback((status: string, avatarBase64?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "update_profile", status, avatarBase64 }));
  }, []);

  const postStory = useCallback((text: string, imageBase64?: string) => {
    wsRef.current?.send(JSON.stringify({ type: "post_story", text, imageBase64 }));
  }, []);

  const sendCallSignal = useCallback((to: string, type: string, extra?: object) => {
    wsRef.current?.send(JSON.stringify({ type, to, ...extra }));
  }, []);

  const registerCallHandler = useCallback((h: CallSignalHandler) => {
    callHandlersRef.current.add(h);
    return () => callHandlersRef.current.delete(h);
  }, []);

  const registerNotificationHandler = useCallback((h: NotificationHandler) => {
    notifHandlersRef.current.add(h);
    return () => notifHandlersRef.current.delete(h);
  }, []);

  return (
    <SocketContext.Provider value={{
      connected, onlineUsers, groupMessages, dmMessages, groupMeta, typingUsers,
      stories, unreadCounts, clearUnread,
      sendMessage, sendDm, requestDmHistory, createGroup, joinGroup,
      sendTyping, sendReaction, deleteMessage, pinMessage, kickUser,
      updateProfile, postStory,
      sendCallSignal, registerCallHandler, registerNotificationHandler,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
