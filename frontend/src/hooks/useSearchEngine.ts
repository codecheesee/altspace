import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { evaluateSmartQuery } from "../lib/calc";
import { evaluateQuickJump } from "../lib/quickjumps";
import { searchSnippets } from "../lib/snippets";
import { searchWindowsSettings } from "../lib/windowsSettings";
import { searchWindowSnaps } from "../lib/windowSnaps";
import { PRESET_THEMES } from "../lib/theme";
import {
  tauriInvoke,
  saveCachedApps,
  getCachedOrInitialApps,
  sortByFrequency,
  UTILITY_ITEMS,
  consumeAdvancedSearch,
  isPremiumSearchQuery,
} from "../lib/appStorage";
import { getLicenseStatus, isUnlimitedTier } from "../lib/license";
import { streamOllamaResponse, OLLAMA_DEFAULT_MODEL } from "../lib/ai";
import type {
  Item,
  Mode,
  SpecialCard,
  GameItem,
  ShellResult,
} from "../types";

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  keyword: string;
  script_path: string;
  icon: string;
}

export function useSearchEngine({
  currentMode,
  currentThemeId,
  onNotify,
  onPremiumRequired,
  onConfirmShellCommand,
}: {
  currentMode: Mode;
  currentThemeId: string;
  onNotify?: (msg: string) => void;
  onPremiumRequired?: () => void;
  onConfirmShellCommand?: (command: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [items, setItems] = useState<Item[]>(getCachedOrInitialApps);
  const [installedGames, setInstalledGames] = useState<GameItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [suggestedProjects, setSuggestedProjects] = useState<Item[]>([]);

  // Terminal Runner State
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [terminalResult, setTerminalResult] = useState<ShellResult | null>(null);

  // Local AI (Ollama) Streaming State
  const [aiState, setAiState] = useState<{
    prompt: string;
    response: string;
    isLoading: boolean;
    error: string | null;
  }>({
    prompt: "",
    response: "",
    isLoading: false,
    error: null,
  });
  const aiAbortController = useRef<AbortController | null>(null);

  const searchSeq = useRef(0);

  // Load plugins from %LOCALAPPDATA%\AltSpace\plugins
  useEffect(() => {
    tauriInvoke<PluginItem[]>("list_plugins")
      .then((res) => {
        if (res && Array.isArray(res)) {
          setPlugins(res);
        }
      })
      .catch(() => {});
  }, []);

  // Load installed games
  useEffect(() => {
    tauriInvoke<GameItem[]>("get_installed_games")
      .then((res) => {
        if (res && Array.isArray(res)) setInstalledGames(res);
      })
      .catch(() => {});
  }, []);

  // Load suggested projects
  useEffect(() => {
    tauriInvoke<any[]>("get_suggested_projects")
      .then((res) => {
        if (res && Array.isArray(res) && res.length > 0) {
          setSuggestedProjects(
            res.map((r: any) => ({
              id: r.id,
              title: r.title,
              subtitle: r.subtitle,
              category: r.category,
              iconType: r.icon_type,
              iconData: r.icon_data || undefined,
              path: r.path,
              size: r.size || undefined,
              updated: r.updated || undefined,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Debounce query for L2 multi-drive Everything search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle AI query streaming (? or ai: prompt)
  useEffect(() => {
    const qTrim = query.trim();
    const isAiQuery = qTrim.startsWith("?") || qTrim.toLowerCase().startsWith("ai:");
    if (!isAiQuery) {
      if (aiAbortController.current) {
        aiAbortController.current.abort();
        aiAbortController.current = null;
      }
      return;
    }

    const promptText = qTrim.startsWith("?")
      ? qTrim.slice(1).trim()
      : qTrim.slice(3).trim();

    if (!promptText || promptText.length < 3) {
      setAiState({
        prompt: promptText,
        response: "",
        isLoading: false,
        error: null,
      });
      return;
    }

    // Debounce AI trigger so typing doesn't spam requests
    const aiTimer = setTimeout(() => {
      if (aiAbortController.current) {
        aiAbortController.current.abort();
      }
      const controller = new AbortController();
      aiAbortController.current = controller;

      setAiState({
        prompt: promptText,
        response: "",
        isLoading: true,
        error: null,
      });

      streamOllamaResponse({
        prompt: promptText,
        model: OLLAMA_DEFAULT_MODEL,
        signal: controller.signal,
        onToken: (chunk) => {
          setAiState((prev) => ({
            ...prev,
            response: prev.response + chunk,
          }));
        },
        onDone: () => {
          setAiState((prev) => ({ ...prev, isLoading: false }));
        },
        onError: (err) => {
          setAiState((prev) => ({
            ...prev,
            isLoading: false,
            error: err,
          }));
        },
        confirmShellCommand: onConfirmShellCommand,
      });
    }, 400);

    return () => clearTimeout(aiTimer);
  }, [query, onConfirmShellCommand]);

  // Phase 1: Instant L1 Search & Matching
  useEffect(() => {
    if (currentMode !== "all") return;

    function executeSearch() {
      const qTrim = query.trim();
      const qLower = qTrim.toLowerCase();

      // Check if AI query
      if (qTrim.startsWith("?") || qLower.startsWith("ai:")) {
        setItems([]);
        setSelectedIndex(0);
        return;
      }

      // Settings
      const settingsMatches = qTrim ? searchWindowsSettings(qTrim) : [];
      const settingItems: Item[] = settingsMatches.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: `Windows 11 ${s.area} • ${s.subtitle}`,
        category: "Setting",
        iconType: "setting",
        path: s.uri,
      }));

      // Snippets
      const snippetMatches = qTrim ? searchSnippets(qTrim) : [];
      const snippetItems: Item[] = snippetMatches.map((m) => ({
        id: m.snippet.id,
        title: `${m.snippet.name} (${m.snippet.keyword})`,
        subtitle: `Expand snippet: "${m.resolvedContent.slice(0, 60)}"`,
        category: "Snippet",
        iconType: "snippet",
        path: m.resolvedContent,
      }));

      // Snaps
      const snapMatches = qTrim ? searchWindowSnaps(qTrim) : [];
      const snapItems: Item[] = snapMatches.map((snap) => ({
        id: snap.id,
        title: snap.title,
        subtitle: snap.subtitle,
        category: "Window Management",
        iconType: "window-snap",
        path: snap.position,
        size: snap.layoutType,
      }));

      // Plugins
      const isPluginFilter = qLower === ":plugin" || qLower === ":plugins";
      const matchedPlugins = plugins.filter((p) => {
        if (isPluginFilter) return true;
        if (!qTrim) return true;
        return (
          p.name.toLowerCase().includes(qLower) ||
          p.description.toLowerCase().includes(qLower) ||
          p.keyword.toLowerCase().includes(qLower)
        );
      });
      const pluginItems: Item[] = matchedPlugins.map((p) => ({
        id: `plugin-${p.id}`,
        title: p.name,
        subtitle: `${p.keyword} • ${p.description}`,
        category: "Command",
        iconType: "cmd",
        path: `plugin://${p.script_path}`,
      }));

      // Games
      const isGameFilter = qLower === ":game" || qLower === ":games" || qLower.startsWith(":game ");
      const gameSearchText = isGameFilter ? qLower.replace(/^:games?\s*/, "") : qLower;
      const matchedGames = installedGames.filter((g) => {
        if (isGameFilter) {
          if (!gameSearchText) return true;
          return g.title.toLowerCase().includes(gameSearchText) || g.platform.toLowerCase().includes(gameSearchText);
        }
        return g.title.toLowerCase().includes(qLower) || (qLower.length >= 3 && g.platform.toLowerCase().includes(qLower));
      });
      const gameItems: Item[] = matchedGames.map((g) => ({
        id: g.id,
        title: g.title,
        subtitle: `${g.platform} • ${g.size_gb ? `${g.size_gb} GB • ` : ""}${g.install_path}`,
        category: "Game",
        iconType: "game",
        path: g.launch_uri,
        size: g.size_gb ? `${g.size_gb} GB` : undefined,
        bannerUrl: g.banner_url || undefined,
        platform: g.platform,
      }));

      // Themes
      const isThemeFilter = qLower === ":theme" || qLower === ":themes" || qLower.startsWith(":theme ");
      const themeSearchText = isThemeFilter ? qLower.replace(/^:themes?\s*/, "") : qLower;
      const matchedThemes = PRESET_THEMES.filter((t) => {
        if (isThemeFilter) {
          if (!themeSearchText) return true;
          return t.name.toLowerCase().includes(themeSearchText) || t.description.toLowerCase().includes(themeSearchText);
        }
        return (
          qLower.length >= 3 &&
          ("theme".includes(qLower) || "themes".includes(qLower) || t.name.toLowerCase().includes(qLower) || t.description.toLowerCase().includes(qLower))
        );
      });
      const themeItems: Item[] = matchedThemes.map((t) => ({
        id: `theme-${t.id}`,
        title: `${t.name}${t.id === currentThemeId ? " (Active)" : ""}`,
        subtitle: `${t.description} • Accent ${t.accentHex}`,
        category: "Theme",
        iconType: "theme",
        path: `theme://${t.id}`,
      }));

      // System Update
      const isUpdateFilter = qLower === ":update" || qLower === ":upgrade" || qLower === "update";
      const updateItems: Item[] = isUpdateFilter
        ? [
            {
              id: "util-update",
              title: "Check for Updates & Upgrade AltSpace",
              subtitle: "Fetches and applies the latest verified release from GitHub",
              category: "Command",
              iconType: "cmd",
              path: "update://latest",
            },
          ]
        : [];

      if (isUpdateFilter) {
        setItems(updateItems);
        setSelectedIndex(0);
        return;
      }

      if (isGameFilter) {
        setItems(gameItems);
        setSelectedIndex(0);
        return;
      }

      if (isThemeFilter) {
        setItems(themeItems);
        setSelectedIndex(0);
        return;
      }

      // Instant optimistic fallback
      const fallbackList = getCachedOrInitialApps();
      if (!qTrim) {
        setItems(sortByFrequency(fallbackList));
      } else {
        const q = qTrim.toLowerCase();
        const utilityMatches = q.startsWith(":")
          ? UTILITY_ITEMS.filter((item) =>
              item.title.toLowerCase().includes(q.slice(1)) ||
              item.path.toLowerCase().includes(q)
            )
          : [];
        const filtered = fallbackList.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        );
        setItems([
          ...utilityMatches,
          ...pluginItems,
          ...themeItems,
          ...gameItems,
          ...snapItems,
          ...settingItems,
          ...snippetItems,
          ...filtered,
        ]);
      }
      setSelectedIndex(0);
    }

    executeSearch();
  }, [query, currentMode, currentThemeId, installedGames, plugins]);

  // Phase 2: Asynchronous Debounced Deep Multi-Drive Search (L2 Everything MFT)
  useEffect(() => {
    if (currentMode !== "all") return;
    const qTrim = debouncedQuery.trim();
    if (!qTrim || qTrim.length < 2) return;
    if (qTrim.startsWith(":") || qTrim.startsWith(">") || qTrim.startsWith("!") || qTrim.startsWith("?")) return;

    let active = true;
    const currentSeq = ++searchSeq.current;

    // Premium feature gatekeeper: Normal searches are ALWAYS 100% free and unmetered!
    const isPremium = isPremiumSearchQuery(debouncedQuery);
    if (isPremium) {
      const license = getLicenseStatus();
      if (!isUnlimitedTier(license) && !license.isSupporter) {
        const usage = consumeAdvancedSearch();
        if (!usage.allowed) {
          const quotaCard: Item = {
            id: "quota-limit-notice",
            title: "1,000 Free Premium Searches Used",
            subtitle: "Normal searches remain 100% free forever. Connect GitHub or sponsor to unlock unlimited multi-drive indexing.",
            category: "Command",
            iconType: "cmd",
            path: "altspace://license",
          };
          setItems((prev) => [quotaCard, ...prev]);
          return () => { active = false; };
        }
        if (usage.warning) {
          onNotify?.(`Premium trial: ${usage.remaining} searches remaining in this 30-day window.`);
        }
      }
    }

    runAdvancedSearch();
    function runAdvancedSearch() {
      tauriInvoke<any[]>("search", { query: debouncedQuery })
        .then((res) => {
          if (!active || currentSeq !== searchSeq.current || !res || !Array.isArray(res) || res.length === 0) return;

          const mapped: Item[] = res.map((r: any) => ({
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            category: r.category,
            iconType: r.icon_type,
            iconData: r.icon_data || undefined,
            path: r.path,
            size: r.size || undefined,
            updated: r.updated || undefined,
          }));

          setItems((prev) => {
            const nonL2 = prev.filter(
              (i) =>
                i.category === "Setting" ||
                i.category === "Snippet" ||
                i.category === "Window Management" ||
                i.category === "Game" ||
                i.category === "Theme"
            );
            const appsOnly = mapped.filter((i) => i.category === "Application");
            if (appsOnly.length > 0) saveCachedApps(appsOnly);
            return [...nonL2, ...mapped];
          });
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [debouncedQuery, currentMode, onNotify, onPremiumRequired]);

  // Recommendations
  const frequentApps = useMemo(() => {
    return items.filter((i) => i.category === "Application").slice(0, 8);
  }, [items]);

  const recentWorkspaces = useMemo(() => {
    if (suggestedProjects.length > 0) return suggestedProjects.slice(0, 6);
    return [];
  }, [suggestedProjects]);

  const activeSuggestionsList = useMemo(() => {
    return [...frequentApps, ...recentWorkspaces];
  }, [frequentApps, recentWorkspaces]);

  const activeList = !query.trim() ? activeSuggestionsList : items.slice(0, 30);

  // Special Card Evaluation (Math, QuickJump, Snippet, Terminal, AI)
  const isAiQuery = query.trim().startsWith("?") || query.trim().toLowerCase().startsWith("ai:");
  const isTerminalCommand = currentMode === "all" && query.trim().startsWith(">");
  const terminalCmdText = isTerminalCommand ? query.trim().slice(1).trim() : "";

  const calcResult = currentMode === "all" && !isAiQuery ? evaluateSmartQuery(query) : null;
  const quickJumpResult = currentMode === "all" && !isAiQuery && !calcResult ? evaluateQuickJump(query) : null;
  const directSnippetMatch =
    currentMode === "all" && !isAiQuery && !calcResult && !quickJumpResult && query.trim().startsWith("!")
      ? searchSnippets(query.trim())[0] || null
      : null;

  const specialCard: SpecialCard | null = isAiQuery
    ? {
        kind: "ai",
        data: {
          prompt: aiState.prompt || query.replace(/^\?|^ai:\s*/i, "").trim() || "Ask local AI anything...",
          response: aiState.response,
          isLoading: aiState.isLoading,
          model: OLLAMA_DEFAULT_MODEL,
          error: aiState.error,
        },
      }
    : isTerminalCommand && terminalCmdText
    ? {
        kind: "terminal",
        data: {
          command: terminalCmdText,
          result: terminalResult,
          isRunning: terminalRunning,
        },
      }
    : calcResult
    ? { kind: "calc", data: calcResult }
    : quickJumpResult
    ? { kind: "quickjump", data: quickJumpResult }
    : directSnippetMatch
    ? { kind: "snippet", data: directSnippetMatch }
    : null;

  const selectedSpecial = currentMode === "all" && specialCard && selectedIndex === 0 ? specialCard : null;
  const selectedItemIndex = specialCard ? selectedIndex - 1 : selectedIndex;
  const selectedItem = currentMode === "all"
    ? (selectedSpecial ? null : activeList[selectedItemIndex] || activeList[0])
    : activeList[selectedIndex] || activeList[0];

  const handleExecuteTerminalCommand = useCallback(async (cmdText: string) => {
    if (!cmdText) return;
    setTerminalRunning(true);
    if (tauriInvoke) {
      try {
        const res = await tauriInvoke<ShellResult>("execute_shell_command", { command: cmdText });
        if (res) setTerminalResult(res);
      } catch (err: any) {
        setTerminalResult({
          success: false,
          exit_code: 1,
          stdout: "",
          stderr: String(err),
          elapsed_ms: 0,
        });
      } finally {
        setTerminalRunning(false);
      }
    } else {
      setTerminalRunning(false);
    }
  }, []);

  const handleLaunchTerminalWindow = useCallback(async (cmdText: string) => {
    if (!cmdText) return;
    if (tauriInvoke) {
      try {
        await tauriInvoke("launch_in_terminal_window", { command: cmdText });
        onNotify?.("Launched in Windows Terminal");
      } catch (err: any) {
        onNotify?.(`Terminal error: ${err}`);
      }
    }
  }, [onNotify]);

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    items,
    setItems,
    frequentApps,
    recentWorkspaces,
    specialCard,
    selectedItem,
    selectedSpecial,
    terminalRunning,
    terminalResult,
    handleExecuteTerminalCommand,
    handleLaunchTerminalWindow,
  };
}
