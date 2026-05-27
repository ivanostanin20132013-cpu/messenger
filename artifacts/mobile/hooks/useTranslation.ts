import { translations, type TranslationKey } from "@/constants/i18n";
import { useSettings } from "@/context/SettingsContext";

export function useTranslation() {
  const { language } = useSettings();
  const t = (key: TranslationKey): string => translations[language][key];
  return { t, language };
}
