import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

interface PinLockContextValue {
  pinEnabled: boolean;
  locked: boolean;
  setupPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
}

const PinLockContext = createContext<PinLockContextValue | null>(null);

async function hashPin(pin: string): Promise<string> {
  // Pure JS djb2 hash — no native modules needed, fine for local PIN
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h) ^ pin.charCodeAt(i);
    h = h >>> 0;
  }
  return `pin_${h.toString(16)}_${pin.length}`;
}

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const pinHashRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("pin_hash");
      if (stored) {
        pinHashRef.current = stored;
        setPinEnabled(true);
        setLocked(true);
      }
    })();
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    await AsyncStorage.setItem("pin_hash", hash);
    pinHashRef.current = hash;
    setPinEnabled(true);
    setLocked(false);
  }, []);

  const removePin = useCallback(async () => {
    await AsyncStorage.removeItem("pin_hash");
    pinHashRef.current = null;
    setPinEnabled(false);
    setLocked(false);
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const hash = await hashPin(pin);
    if (hash === pinHashRef.current) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Подтвердите личность",
      cancelLabel: "Отмена",
    });
    if (result.success) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    if (pinEnabled) setLocked(true);
  }, [pinEnabled]);

  return (
    <PinLockContext.Provider value={{ pinEnabled, locked, setupPin, removePin, unlock, unlockWithBiometrics, lock }}>
      {children}
    </PinLockContext.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinLockContext);
  if (!ctx) throw new Error("usePinLock must be used within PinLockProvider");
  return ctx;
}
