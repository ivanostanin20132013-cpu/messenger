import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

export type CallState = "idle" | "calling" | "ringing" | "connected";

interface CallContextValue {
  callState: CallState;
  callPeer: string | null;
  isMuted: boolean;
  callDuration: number;
  startCall: (peer: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { sendCallSignal, registerCallHandler } = useSocket();
  const { username } = useAuth();

  const [callState, setCallState] = useState<CallState>("idle");
  const [callPeer, setCallPeer] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  const getRTCPeerConnection = useCallback((): typeof RTCPeerConnection => {
    if (Platform.OS !== "web") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("react-native-webrtc").RTCPeerConnection;
    }
    return window.RTCPeerConnection;
  }, []);

  const getMediaDevices = useCallback((): MediaDevices => {
    if (Platform.OS !== "web") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("react-native-webrtc").mediaDevices;
    }
    return navigator.mediaDevices;
  }, []);

  const createPeerConnection = useCallback((peer: string) => {
    const PeerConnection = getRTCPeerConnection();
    const pc = new PeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        sendCallSignal(peer, "call_ice", { candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      }
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        cleanup();
      }
    };

    return pc;
  }, [getRTCPeerConnection, sendCallSignal]);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      (localStreamRef.current.getTracks() as MediaStreamTrack[]).forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setCallState("idle");
    setCallPeer(null);
    setIsMuted(false);
    setCallDuration(0);
    pendingOfferRef.current = null;
  }, []);

  const startCall = useCallback(async (peer: string) => {
    if (callState !== "idle") return;
    setCallPeer(peer);
    setCallState("calling");

    const pc = createPeerConnection(peer);
    pcRef.current = pc;

    try {
      const stream = await getMediaDevices().getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      (stream.getTracks() as MediaStreamTrack[]).forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      sendCallSignal(peer, "call_ring", {});
      sendCallSignal(peer, "call_offer", { sdp: offer });
    } catch (err) {
      console.error("startCall error", err);
      cleanup();
    }
  }, [callState, createPeerConnection, getMediaDevices, sendCallSignal, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!callPeer || !pendingOfferRef.current) return;
    const peer = callPeer;
    const offer = pendingOfferRef.current;
    setCallState("connected");

    const pc = createPeerConnection(peer);
    pcRef.current = pc;

    try {
      const stream = await getMediaDevices().getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      (stream.getTracks() as MediaStreamTrack[]).forEach((t) => pc.addTrack(t, stream));

      const RTCSessionDescription =
        Platform.OS !== "web"
          ? // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("react-native-webrtc").RTCSessionDescription
          : window.RTCSessionDescription;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendCallSignal(peer, "call_answer", { sdp: answer });

      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error("acceptCall error", err);
      cleanup();
    }
  }, [callPeer, createPeerConnection, getMediaDevices, sendCallSignal, cleanup]);

  const rejectCall = useCallback(() => {
    if (callPeer) sendCallSignal(callPeer, "call_reject", {});
    cleanup();
  }, [callPeer, sendCallSignal, cleanup]);

  const endCall = useCallback(() => {
    if (callPeer) sendCallSignal(callPeer, "call_end", {});
    cleanup();
  }, [callPeer, sendCallSignal, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      (localStreamRef.current.getAudioTracks() as MediaStreamTrack[]).forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

  // Handle incoming call signals
  useEffect(() => {
    const unregister = registerCallHandler(async (msg) => {
      if (msg.type === "call_ring") {
        if (callState !== "idle") {
          sendCallSignal(msg.from, "call_reject", {});
          return;
        }
        setCallPeer(msg.from);
        setCallState("ringing");
        return;
      }

      if (msg.type === "call_offer" && msg.sdp) {
        pendingOfferRef.current = msg.sdp;
        return;
      }

      if (msg.type === "call_answer" && msg.sdp && pcRef.current) {
        const RTCSessionDescription =
          Platform.OS !== "web"
            ? // eslint-disable-next-line @typescript-eslint/no-require-imports
              require("react-native-webrtc").RTCSessionDescription
            : window.RTCSessionDescription;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        setCallState("connected");
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
        return;
      }

      if (msg.type === "call_ice" && msg.candidate && pcRef.current) {
        const RTCIceCandidate =
          Platform.OS !== "web"
            ? // eslint-disable-next-line @typescript-eslint/no-require-imports
              require("react-native-webrtc").RTCIceCandidate
            : window.RTCIceCandidate;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch { /* ignore */ }
        return;
      }

      if (msg.type === "call_reject" || msg.type === "call_end") {
        cleanup();
        return;
      }
    });

    return unregister;
  }, [registerCallHandler, callState, sendCallSignal, cleanup, username]);

  useEffect(() => () => cleanup(), [cleanup]);

  return (
    <CallContext.Provider value={{ callState, callPeer, isMuted, callDuration, startCall, acceptCall, rejectCall, endCall, toggleMute }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
