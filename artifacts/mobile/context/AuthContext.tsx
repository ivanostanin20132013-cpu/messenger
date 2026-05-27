import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  token: string | null;
  username: string | null;
  isLoaded: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    username: null,
    isLoaded: false,
  });

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("auth_token");
      const username = await AsyncStorage.getItem("auth_username");
      setState({ token, username, isLoaded: true });
    })();
  }, []);

  const signIn = async (token: string, username: string) => {
    await AsyncStorage.setItem("auth_token", token);
    await AsyncStorage.setItem("auth_username", username);
    setState({ token, username, isLoaded: true });
  };

  const signOut = async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_username");
    setState({ token: null, username: null, isLoaded: true });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
