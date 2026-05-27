import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppTheme = "dark" | "light" | "system";
export type AppLanguage = "ru" | "en";

interface SettingsContextValue {
  theme: AppTheme;
  language: AppLanguage;
  setTheme: (t: AppTheme) => void;
  setLanguage: (l: AppLanguage) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const THEME_KEY = "app_theme";
const LANG_KEY = "app_language";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [language, setLanguageState] = useState<AppLanguage>("ru");

  useEffect(() => {
    (async () => {
      const [t, l] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(LANG_KEY),
      ]);
      if (t === "dark" || t === "light" || t === "system") setThemeState(t);
      if (l === "ru" || l === "en") setLanguageState(l);
    })();
  }, []);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    await AsyncStorage.setItem(THEME_KEY, t);
  }, []);

  const setLanguage = useCallback(async (l: AppLanguage) => {
    setLanguageState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  return (
    <SettingsContext.Provider value={{ theme, language, setTheme, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
