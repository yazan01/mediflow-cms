"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language, T } from "./translations";

type ContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  t: T;
  dir: "ltr" | "rtl";
};

const LanguageContext = createContext<ContextType>({
  lang: "en",
  setLang: () => {},
  t: translations.en,
  dir: "ltr",
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("mediflow_lang") as Language | null;
    const initial = saved === "ar" || saved === "en" ? saved : "en";
    setLangState(initial);
    applyLang(initial);
  }, []);

  function applyLang(l: Language) {
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }

  function setLang(l: Language) {
    setLangState(l);
    localStorage.setItem("mediflow_lang", l);
    applyLang(l);
  }

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, t: translations[lang], dir: lang === "ar" ? "rtl" : "ltr" }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
