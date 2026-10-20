export interface Theme {
  id: string;
  name: string;
  description: string;
  bg: string;
  cardBg: string;
  headerBg: string;
  selectedBg: string;
  selectedBorder: string;
  accentHex: string;
  accentTextClass: string;
  accentBadgeBg: string;
  accentBadgeBorder: string;
  accentBadgeText: string;
  borderColor: string;
  accentGlow: string;
  isOled?: boolean;
}

export const PRESET_THEMES: Theme[] = [
  {
    id: "raycast-obsidian",
    name: "Windows Graphite",
    description: "Premium Windows 11 graphite acrylic with cool azure accent and linear precision",
    bg: "#111114",
    cardBg: "#16161a",
    headerBg: "#131317",
    selectedBg: "rgba(56, 189, 248, 0.08)",
    selectedBorder: "rgba(56, 189, 248, 0.28)",
    accentHex: "#38bdf8",
    accentTextClass: "text-[#38bdf8]",
    accentBadgeBg: "rgba(56, 189, 248, 0.12)",
    accentBadgeBorder: "rgba(56, 189, 248, 0.25)",
    accentBadgeText: "#7dd3fc",
    borderColor: "rgba(255, 255, 255, 0.08)",
    accentGlow: "none",
  },
  {
    id: "midnight-void",
    name: "Midnight Void (OLED)",
    description: "21st.dev pitch-black OLED with electric cyan glow",
    bg: "#000000",
    cardBg: "#0a0a0c",
    headerBg: "#050507",
    selectedBg: "rgba(0, 242, 254, 0.09)",
    selectedBorder: "rgba(0, 242, 254, 0.25)",
    accentHex: "#00f2fe",
    accentTextClass: "text-[#00f2fe]",
    accentBadgeBg: "rgba(0, 242, 254, 0.15)",
    accentBadgeBorder: "rgba(0, 242, 254, 0.35)",
    accentBadgeText: "#38efff",
    borderColor: "rgba(255, 255, 255, 0.08)",
    accentGlow: "0 0 18px rgba(0, 242, 254, 0.3)",
    isOled: true,
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Subtle indigo darkness with soft neon violet accents",
    bg: "#10121b",
    cardBg: "#161926",
    headerBg: "#131522",
    selectedBg: "rgba(122, 162, 247, 0.10)",
    selectedBorder: "rgba(122, 162, 247, 0.25)",
    accentHex: "#7aa2f7",
    accentTextClass: "text-[#7aa2f7]",
    accentBadgeBg: "rgba(122, 162, 247, 0.15)",
    accentBadgeBorder: "rgba(122, 162, 247, 0.3)",
    accentBadgeText: "#9ab8fc",
    borderColor: "rgba(122, 162, 247, 0.10)",
    accentGlow: "0 0 16px rgba(122, 162, 247, 0.25)",
  },
  {
    id: "vercel-monochrome",
    name: "Vercel Clean",
    description: "High-contrast minimalist zinc monochrome",
    bg: "#09090b",
    cardBg: "#121216",
    headerBg: "#0c0c0f",
    selectedBg: "rgba(255, 255, 255, 0.12)",
    selectedBorder: "rgba(255, 255, 255, 0.20)",
    accentHex: "#ffffff",
    accentTextClass: "text-white",
    accentBadgeBg: "rgba(255, 255, 255, 0.12)",
    accentBadgeBorder: "rgba(255, 255, 255, 0.22)",
    accentBadgeText: "#ffffff",
    borderColor: "rgba(255, 255, 255, 0.10)",
    accentGlow: "0 0 14px rgba(255, 255, 255, 0.2)",
  },
  {
    id: "emerald-matrix",
    name: "Emerald Phosphor",
    description: "Hacker terminal dark green with phosphor emerald highlights",
    bg: "#080d0a",
    cardBg: "#0e1612",
    headerBg: "#0b120e",
    selectedBg: "rgba(16, 185, 129, 0.10)",
    selectedBorder: "rgba(16, 185, 129, 0.25)",
    accentHex: "#10b981",
    accentTextClass: "text-[#10b981]",
    accentBadgeBg: "rgba(16, 185, 129, 0.15)",
    accentBadgeBorder: "rgba(16, 185, 129, 0.3)",
    accentBadgeText: "#34d399",
    borderColor: "rgba(16, 185, 129, 0.12)",
    accentGlow: "0 0 16px rgba(16, 185, 129, 0.25)",
  },
];

const THEME_STORAGE_KEY = "altspace_active_theme_id_v1";
const CUSTOM_ACCENT_KEY = "altspace_custom_accent_hex_v1";

export function getSavedThemeId(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "raycast-obsidian";
  } catch (_) {
    return "raycast-obsidian";
  }
}

export function saveThemeId(id: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch (_) {}
}

export function getSavedCustomAccent(): string | null {
  try {
    return localStorage.getItem(CUSTOM_ACCENT_KEY) || null;
  } catch (_) {
    return null;
  }
}

export function saveCustomAccent(hex: string): void {
  try {
    localStorage.setItem(CUSTOM_ACCENT_KEY, hex);
  } catch (_) {}
}

export function resolveTheme(themeId: string, customHex?: string | null): Theme {
  const base = PRESET_THEMES.find((t) => t.id === themeId) || PRESET_THEMES[0];
  if (customHex && customHex.startsWith("#")) {
    return {
      ...base,
      accentHex: customHex,
      accentTextClass: "", // Dynamic style applied via style attribute
      accentBadgeBg: `${customHex}26`,
      accentBadgeBorder: `${customHex}4d`,
      accentBadgeText: customHex,
      accentGlow: `0 0 16px ${customHex}40`,
    };
  }
  return base;
}
