"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { normalizeLanguage, type Language } from "@/lib/i18n-utils";
import { translateToEn, translateToZh } from "@/lib/translations";

const storageKey = "ffe-language";


type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: "zh",
  setLanguage: () => undefined,
  t: (text) => text
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");

  useEffect(() => {
    const queryLanguage = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
    if (queryLanguage === "en" || queryLanguage === "zh") {
      setLanguageState(queryLanguage);
      window.localStorage.setItem(storageKey, queryLanguage);
      document.documentElement.lang = queryLanguage === "en" ? "en" : "zh-CN";
      document.documentElement.dataset.language = queryLanguage;
      return;
    }

    const saved = normalizeLanguage(window.localStorage.getItem(storageKey));
    if (saved === "en") {
      setLanguageState("en");
      document.documentElement.lang = "en";
      document.documentElement.dataset.language = "en";
      return;
    }

    if (!window.localStorage.getItem(storageKey) && window.navigator.language?.toLowerCase().startsWith("en")) {
      setLanguageState("en");
      document.documentElement.lang = "en";
      document.documentElement.dataset.language = "en";
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = (nextLanguage: Language) => {
      setLanguageState(nextLanguage);
      window.localStorage.setItem(storageKey, nextLanguage);
      document.documentElement.lang = nextLanguage === "en" ? "en" : "zh-CN";
      document.documentElement.dataset.language = nextLanguage;
    };

    const t = (text: string, vars?: Record<string, string | number>) =>
      language === "en" ? translateToEn(text, vars) : translateToZh(text, vars);

    return { language, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
