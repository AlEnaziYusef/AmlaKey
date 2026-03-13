import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { useLanguage } from "../context/LanguageContext";

const ONBOARDING_KEY = "@onboarding_completed";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const { setLanguage } = useLanguage();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => {
        if (val !== "true") {
          // First time — detect OS language
          try {
            const locales = getLocales();
            const osLang = locales[0]?.languageCode === "ar" ? "ar" : "en";
            setLanguage(osLang);
          } catch {
            // Fallback to English if localization fails
          }
          setShowOnboarding(true);
        }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  };

  return { showOnboarding: checked && showOnboarding, completeOnboarding };
}
