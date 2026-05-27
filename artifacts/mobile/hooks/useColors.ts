import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";

export function useColors() {
  const systemScheme = useColorScheme();
  const { theme } = useSettings();

  const resolved = theme === "system" ? systemScheme ?? "dark" : theme;
  const palette = resolved === "light" ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius };
}
