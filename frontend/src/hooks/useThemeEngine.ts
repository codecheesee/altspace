import { useState, useCallback } from "react";
import {
  PRESET_THEMES,
  resolveTheme,
  getSavedThemeId,
  saveThemeId,
  getSavedCustomAccent,
  saveCustomAccent,
} from "../lib/theme";

export function useThemeEngine(onNotify?: (msg: string) => void) {
  const [currentThemeId, setCurrentThemeId] = useState<string>(getSavedThemeId);
  const [customAccent, setCustomAccent] = useState<string | null>(getSavedCustomAccent);
  const activeTheme = resolveTheme(currentThemeId, customAccent);

  const handleSelectTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
    saveThemeId(themeId);
    const target = PRESET_THEMES.find((t) => t.id === themeId);
    onNotify?.(`Theme activated: ${target?.name || themeId}`);
  }, [onNotify]);

  const handleCycleTheme = useCallback(() => {
    const idx = PRESET_THEMES.findIndex((t) => t.id === currentThemeId);
    const nextTheme = PRESET_THEMES[(idx + 1) % PRESET_THEMES.length];
    handleSelectTheme(nextTheme.id);
  }, [currentThemeId, handleSelectTheme]);

  const handleSetCustomAccent = useCallback((hex: string) => {
    const clean = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      setCustomAccent(clean);
      saveCustomAccent(clean);
      onNotify?.(`Custom Accent Set: ${clean}`);
    }
  }, [onNotify]);

  const handleResetCustomAccent = useCallback(() => {
    setCustomAccent(null);
    try {
      localStorage.removeItem("altspace_custom_accent_hex_v1");
    } catch (_) {}
    onNotify?.("Accent reset to preset default");
  }, [onNotify]);

  return {
    currentThemeId,
    customAccent,
    activeTheme,
    handleSelectTheme,
    handleCycleTheme,
    handleSetCustomAccent,
    handleResetCustomAccent,
  };
}
