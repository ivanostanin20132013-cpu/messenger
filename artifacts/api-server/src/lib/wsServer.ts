import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { tokens } from "../routes/auth.js";
import { logger } from "./logger.js";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Reaction { emoji: string; users: Set<string> }
interface Message {
  id: string;
  from: string;
  text: string;
  imageBase64?: string;
  timestamp: number;
  deleted?: boolean;
  reactions: Record<string, Set<string>>;
  pinnedBy?: string;
}

interface Group {
  members: Set<string>;
  admins: Set<string>;
  messages: Message[];
  pinnedMessageId?: string;
}

interface Story {
  id: string;
  author: string;
  text: string;
  imageBase64?: string;
  timestamp: number;
}

interface UserProfile {
  status: string;
  avatarBase64?: string;
}

const CALL_SIGNAL_TYPES = new Set(["call_offer","call_answer","call_ice","call_reject","call_end","call_ring"]);
const STORY_TTL = 24 * 60 * 60 * 1000;

const groups = new Map<string, Group>();
const dmHistory = new Map<string, Message[]>();
const clients = new Map<WebSocket, string>();
const userSockets = new Map<string, Set<WebSocket>>();
const userProfiles = new Map<string, UserProfile>();
const stories: Story[] = [];
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

groups.set("Общий", { members: new Set(), admins: new Set(), messages: [] });

function dmKey(a: string, b: string) { return [a, b].sort().join("::"); }

function getOrCreateGroup(name: string, creator?: string): Group {
  if (!groups.has(name)) {
    const g: Group = { members: new Set(), admins: new Set(), messages: [] };
    if (creator) g.admins.add(creator);
    groups.set(name, g);
  }
  return groups.get(name)!;
}

function sendToUser(username: string, payload: object) {
  const sockets = userSockets.get(username);
  if (!sockets) return;
  const json = JSON.stringify(payload);
  for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.send(json);
}

function broadcastGroup(groupName: string, payload: object, exclude?: string) {
  const group = groups.get(groupName);
  if (!group) return;
  for (const username of group.members) {
    if (username === exclude) continue;
    sendToUser(username, payload);
  }
}

function broadcastAll(payload: object) {
  const json = JSON.stringify(payload);
  for (const sockets of userSockets.values())
    for (const ws of sockets)
      if (ws.readyState === WebSocket.OPEN) ws.send(json);
}

function broadcastUserList() {
  const online = Array.from(userSockets.keys()).map((u) => ({
    username: u,
    ...(userProfiles.get(u) ?? { status: "", avatarBase64: undefined }),
  }));
  broadcastAll({ type: "users", online });
}

function serializeMessage(m: Message) {
  return {
    ...m,
    reactions: Object.fromEntries(
      Object.entries(m.reactions).map(([e, s]) => [e, Array.from(s)])
    ),
  };
}

function purgeOldStories() {
  const now = Date.now();
  for (let i = stories.length - 1; i >= 0; i--) {
    if (now - stories[i].timestamp > STORY_TTL) stories.splice(i, 1);
  }
}

export function createWsServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = msg["type"] as string | undefined;

        // ─── AUTH ────────────────────────────────────────────────────────────
        if (type === "auth") {
          const username = tokens.get((msg["token"] as string) ?? "");
          if (!username) { ws.send(JSON.stringify({ type: "error", msg: "Неверный токен" })); ws.close(); return; }
          clients.set(ws, username);
          if (!userSockets.has(username)) userSockets.set(username, new Set());
          userSockets.get(username)!.add(ws);

          const general = getOrCreateGroup("Общий");
          general.members.add(username);
          if (!userProfiles.has(username)) userProfiles.set(username, { status: "" });

          ws.send(JSON.stringify({ type: "auth_ok", username }));
          ws.send(JSON.stringify({ type: "history", group: "Общий", messages: general.messages.map(serializeMessage), pinnedMessageId: general.pinnedMessageId }));
          purgeOldStories();
          ws.send(JSON.stringify({ type: "stories", stories }));
          broadcastUserList();
          return;
        }

        // ─── CALL SIGNALS ─────────────────────────────────────────────────────
        if (type && CALL_SIGNAL_TYPES.has(type)) {
          const username = clients.get(ws);
          if (!username) return;
          const to = msg["to"] as string;
          if (to) sendToUser(to, { ...msg, from: username });
          return;
        }

        const username = clients.get(ws);
        if (!username) { ws.send(JSON.stringify({ type: "error", msg: "Не авторизован" })); return; }

        // ─── GROUP MESSAGE ────────────────────────────────────────────────────
        if (type === "send") {
          const groupName = msg["group"] as string;
          const group = groups.get(groupName);
          if (!group) return;
          const message: Message = {
            id: uid(),
            from: username,
            text: msg["text"] as string ?? "",
            imageBase64: msg["imageBase64"] as string | undefined,
            timestamp: Date.now(),
            reactions: {},
          };
          group.messages.push(message);
          broadcastGroup(groupName, { type: "message", group: groupName, message: serializeMessage(message) });
          return;
        }

        // ─── DM ──────────────────────────────────────────────────────────────
        if (type === "dm") {
          const to = msg["to"] as string;
          if (!to || to === username) return;
          const key = dmKey(username, to);
          if (!dmHistory.has(key)) dmHistory.set(key, []);
          const message: Message = {
            id: uid(),
            from: username,
            text: msg["text"] as string ?? "",
            imageBase64: msg["imageBase64"] as string | undefined,
            timestamp: Date.now(),
            reactions: {},
          };
          dmHistory.get(key)!.push(message);
          const payload = { type: "dm", from: username, to, message: serializeMessage(message) };
          sendToUser(to, payload);
          sendToUser(username, payload);
          return;
        }

        if (type === "dm_history") {
          const with_ = msg["with"] as string;
          if (!with_) return;
          const key = dmKey(username, with_);
          ws.send(JSON.stringify({ type: "dm_history", with: with_, messages: (dmHistory.get(key) ?? []).map(serializeMessage) }));
          return;
        }

        // ─── TYPING ───────────────────────────────────────────────────────────
        if (type === "typing") {
          const target = msg["group"] as string | undefined;
          const toPeer = msg["to"] as string | undefined;
          const typingKey = `${username}:${target ?? toPeer}`;

          if (target) broadcastGroup(target, { type: "typing", from: username, group: target }, username);
          else if (toPeer) sendToUser(toPeer, { type: "typing", from: username });

          // stop typing after 3s
          if (typingTimers.has(typingKey)) clearTimeout(typingTimers.get(typingKey)!);
          typingTimers.set(typingKey, setTimeout(() => {
            if (target) broadcastGroup(target, { type: "stop_typing", from: username, group: target }, username);
            else if (toPeer) sendToUser(toPeer as string, { type: "stop_typing", from: username });
            typingTimers.delete(typingKey);
          }, 3000));
          return;
        }

        // ─── REACT ────────────────────────────────────────────────────────────
        if (type === "react") {
          const groupName = msg["group"] as string | undefined;
          const toPeer = msg["to"] as string | undefined;
          const messageId = msg["messageId"] as string;
          const emoji = msg["emoji"] as string;

          let message: Message | undefined;
          if (groupName) {
            message = groups.get(groupName)?.messages.find((m) => m.id === messageId);
          } else if (toPeer) {
            const key = dmKey(username, toPeer);
            message = dmHistory.get(key)?.find((m) => m.id === messageId);
          }
          if (!message) return;

          if (!message.reactions[emoji]) message.reactions[emoji] = new Set();
          if (message.reactions[emoji].has(username)) message.reactions[emoji].delete(username);
          else message.reactions[emoji].add(username);
          if (message.reactions[emoji].size === 0) delete message.reactions[emoji];

          const payload = { type: "reaction_update", messageId, reactions: Object.fromEntries(Object.entries(message.reactions).map(([e, s]) => [e, Array.from(s)])) };
          if (groupName) broadcastGroup(groupName, { ...payload, group: groupName });
          else if (toPeer) { sendToUser(toPeer, { ...payload, peer: username }); sendToUser(username, { ...payload, peer: toPeer }); }
          return;
        }

        // ─── DELETE MESSAGE ───────────────────────────────────────────────────
        if (type === "delete_msg") {
          const groupName = msg["group"] as string | undefined;
          const toPeer = msg["to"] as string | undefined;
          const messageId = msg["messageId"] as string;

          let message: Message | undefined;
          if (groupName) {
            message = groups.get(groupName)?.messages.find((m) => m.id === messageId);
            if (message && (message.from === username || groups.get(groupName)?.admins.has(username))) {
              message.deleted = true; message.text = ""; message.imageBase64 = undefined;
              broadcastGroup(groupName, { type: "message_deleted", messageId, group: groupName });
            }
          } else if (toPeer) {
            const key = dmKey(username, toPeer);
            message = dmHistory.get(key)?.find((m) => m.id === messageId && m.from === username);
            if (message) {
              message.deleted = true; message.text = ""; message.imageBase64 = undefined;
              sendToUser(toPeer, { type: "message_deleted", messageId, peer: username });
              sendToUser(username, { type: "message_deleted", messageId, peer: toPeer });
            }
          }
          return;
        }

        // ─── PIN MESSAGE ──────────────────────────────────────────────────────
        if (type === "pin_msg") {
          const groupName = msg["group"] as string;
          const messageId = msg["messageId"] as string | undefined;
          const group = groups.get(groupName);
          if (!group || !group.admins.has(username)) return;
          group.pinnedMessageId = messageId ?? undefined;
          broadcastGroup(groupName, { type: "pinned_update", group: groupName, pinnedMessageId: group.pinnedMessageId });
          return;
        }

        // ─── CREATE / JOIN GROUP ──────────────────────────────────────────────
        if (type === "create") {
          const name = msg["name"] as string;
          if (!name) return;
          const group = getOrCreateGroup(name, username);
          group.members.add(username);
          ws.send(JSON.stringify({ type: "history", group: name, messages: group.messages.map(serializeMessage), pinnedMessageId: group.pinnedMessageId, isAdmin: group.admins.has(username) }));
          return;
        }

        if (type === "join") {
          const name = msg["name"] as string;
          if (!name) return;
          const group = getOrCreateGroup(name);
          group.members.add(username);
          ws.send(JSON.stringify({ type: "history", group: name, messages: group.messages.map(serializeMessage), pinnedMessageId: group.pinnedMessageId, isAdmin: group.admins.has(username) }));
          return;
        }

        // ─── KICK ─────────────────────────────────────────────────────────────
        if (type === "kick") {
          const groupName = msg["group"] as string;
          const target = msg["target"] as string;
          const group = groups.get(groupName);
          if (!group || !group.admins.has(username)) return;
          group.members.delete(target);
          sendToUser(target, { type: "kicked", group: groupName });
          broadcastGroup(groupName, { type: "system", group: groupName, text: `${target} был исключён администратором` });
          return;
        }

        // ─── UPDATE PROFILE ───────────────────────────────────────────────────
        if (type === "update_profile") {
          const status = msg["status"] as string ?? "";
          const avatarBase64 = msg["avatarBase64"] as string | undefined;
          userProfiles.set(username, { status, avatarBase64 });
          broadcastUserList();
          return;
        }

        // ─── POST STORY ───────────────────────────────────────────────────────
        if (type === "post_story") {
          purgeOldStories();
          const story: Story = {
            id: uid(),
            author: username,
            text: msg["text"] as string ?? "",
            imageBase64: msg["imageBase64"] as string | undefined,
            timestamp: Date.now(),
          };
          stories.push(story);
          broadcastAll({ type: "new_story", story });
          return;
        }

      } catch (e) {
        logger.error({ e }, "WS parse error");
      }
    });

    ws.on("close", () => {
      const username = clients.get(ws);
      if (username) {
        const sockets = userSockets.get(username);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSockets.delete(username);
            for (const group of groups.values()) group.members.delete(username);
          }
        }
        clients.delete(ws);
        broadcastUserList();
      }
    });
  });

  return wss;
}
