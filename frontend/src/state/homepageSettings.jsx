import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const HomepageSettingsContext = createContext();

export function HomepageSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/homepage-settings");
      setSettings(data);
    } catch (err) {
      console.log("Could not load homepage settings");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reloadSettings();
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadSettings]);

  return (
    <HomepageSettingsContext.Provider value={{ settings, loading, reloadSettings }}>
      {children}
    </HomepageSettingsContext.Provider>
  );
}

export function useHomepageSettings() {
  const context = useContext(HomepageSettingsContext);
  if (!context) {
    throw new Error("useHomepageSettings must be used within HomepageSettingsProvider");
  }
  return context;
}
