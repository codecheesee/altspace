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
import { evaluateDeveloperTransform } from "../lib/developerTransforms";
import {
  getFeatureMatrix,
  isFeatureEnabled,
  FEATURE_REGISTRY,
  type FeatureId,
} from "../lib/featureMatrix";
import { listEnvProfiles } from "../lib/secureVault";
import { getEnvironmentCockpit } from "../lib/dockerWsl";
import { isPlanQuery, synthesizeActionPlan } from "../lib/actionPlanner";
import { resolveGameHeroCard, isQueryMatchForGame } from "../lib/searchNormalizer";
import { isExtensionBlocked } from "../lib/fileFilter";
import type {
  Item,
  Mode,
  SpecialCard,
  GameItem,
  ShellResult,
  ActionPlan,
} from "../types";

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  keyword: string;
  script_path: string;
  icon: string;
  status?: string;
  status_message?: string;
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

  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);

  // Handle Action Plan synthesis (? fix, ? clean, ? reclaim, etc.)
  useEffect(() => {
    const qTrim = query.trim();
    if (isPlanQuery(qTrim) && isFeatureEnabled("local_copilot")) {
      let active = true;
      synthesizeActionPlan(qTrim).then((p) => {
        if (active) setActionPlan(p);
      });
      return () => {
        active = false;
      };
    } else {
      setActionPlan(null);
    }
  }, [query]);

  // Handle AI query streaming (? or ai: prompt)
  useEffect(() => {
    const qTrim = query.trim();
    const isAiQuery = qTrim.startsWith("?") || qTrim.toLowerCase().startsWith("ai:");
    if (!isAiQuery || (isPlanQuery(qTrim) && isFeatureEnabled("local_copilot"))) {
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
        if (isPlanQuery(qTrim) && isFeatureEnabled("local_copilot")) {
          synthesizeActionPlan(qTrim).then((plan) => {
            if (plan) {
              const planItems: Item[] = plan.steps.map((st, i) => ({
                id: `step-${st.id}`,
                title: `${i + 1}. ${st.title}`,
                subtitle: `${st.risk_tier === "read_only_auto" ? "Safe (Auto)" : "Review Required"} • ${st.description}`,
                category: "Command",
                iconType: "cmd",
                path: `plan-exec://${plan.id}/${st.id}`,
              }));
              setItems(planItems);
              setSelectedIndex(0);
            } else {
              setItems([]);
              setSelectedIndex(0);
            }
          });
          return;
        }

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
        subtitle: p.status === "blocked_migration_required"
          ? `${p.keyword} • [Migration Required] ${p.description}`
          : `${p.keyword} • ${p.description}`,
        category: "Command",
        iconType: "cmd",
        path: `plugin://${p.script_path}`,
      }));

      // Games & Intelligent Game Normalizer
      const isGameFilter = qLower === ":game" || qLower === ":games" || qLower.startsWith(":game ");
      const gameSearchText = isGameFilter ? qLower.replace(/^:games?\s*/, "") : qLower;
      const matchedGames = installedGames.filter((g) => {
        if (isGameFilter) {
          if (!gameSearchText) return true;
          return isQueryMatchForGame(gameSearchText, g.title).isMatch || g.platform.toLowerCase().includes(gameSearchText);
        }
        return isQueryMatchForGame(qTrim, g.title).isMatch || (qLower.length >= 3 && g.platform.toLowerCase().includes(qLower));
      });

      const gameItems: Item[] = [];
      for (const g of matchedGames) {
        // 1. Primary game launcher
        gameItems.push({
          id: g.id,
          title: g.title,
          subtitle: `${g.platform} • ${g.size_gb ? `${g.size_gb} GB • ` : ""}${g.install_path}`,
          category: "Game",
          iconType: "game",
          path: g.launch_uri,
          size: g.size_gb ? `${g.size_gb} GB` : undefined,
          bannerUrl: g.banner_url || undefined,
          platform: g.platform,
        });

        // 2. Direct folder launcher if install_path exists
        if (g.install_path) {
          gameItems.push({
            id: `${g.id}-folder`,
            title: `${g.title} (Game Folder)`,
            subtitle: `Open Directory • ${g.install_path}`,
            category: "Folder",
            iconType: "folder",
            path: g.install_path,
          });
        }

        // 3. Direct executable if executable_path exists
        if (g.executable_path) {
          const exeFilename = g.executable_path.split("\\").pop() || "Game Executable";
          gameItems.push({
            id: `${g.id}-exe`,
            title: `${exeFilename} (${g.title})`,
            subtitle: `Direct Binary • ${g.executable_path}`,
            category: "Application",
            iconType: "app",
            path: g.executable_path,
          });
        }
      }

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

      // Discord Community Command
      const isCommunityFilter =
        qLower === ":discord" ||
        qLower === ":community" ||
        qLower === "discord" ||
        qLower === "community";
      if (isCommunityFilter) {
        setItems([
          {
            id: "util-discord",
            title: "Join Discord Developer Community",
            subtitle: "Connect with developers, get AltSpace support, and discuss local systems engineering (discord.gg/EtVCN9m7JV)",
            category: "Command",
            iconType: "cmd",
            path: "altspace://discord",
          },
          {
            id: "util-community",
            title: "Star on GitHub & Discussions",
            subtitle: "View the open-source repository (codecheesee/altspace) and star the project",
            category: "Command",
            iconType: "cmd",
            path: "altspace://community",
          },
        ]);
        setSelectedIndex(0);
        return;
      }

      // System Update
      const isUpdateFilter = qLower === ":update" || qLower === ":upgrade" || qLower === "update";
      const updateItems: Item[] = isUpdateFilter
        ? [
            {
              id: "util-update",
              title: "Check for Updates & Upgrade AltSpace",
              subtitle: "Opens interactive release manager with features & bug fixes changelog",
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

      // Features & Modules Quick Toggle (Omnibar Option C)
      const isFeatureList =
        qLower === "features" ||
        qLower === ":features" ||
        qLower === "feature" ||
        qLower === ":feature" ||
        qLower === "modules" ||
        qLower === ":modules";

      const isFeatureCommand =
        qLower.startsWith("toggle ") ||
        qLower.startsWith(":toggle ") ||
        qLower.startsWith("enable ") ||
        qLower.startsWith(":enable ") ||
        qLower.startsWith("disable ") ||
        qLower.startsWith(":disable ");

      if (isFeatureList || isFeatureCommand) {
        const matrix = getFeatureMatrix();
        const searchTerm = qLower.replace(/^(:?toggle|:?enable|:?disable)\s*/, "").trim();

        const matchedIds = (Object.keys(FEATURE_REGISTRY) as FeatureId[]).filter((fid) => {
          if (!searchTerm) return true;
          const meta = FEATURE_REGISTRY[fid];
          return (
            meta.name.toLowerCase().includes(searchTerm) ||
            meta.keywords.some((k) => k.toLowerCase().includes(searchTerm)) ||
            fid.toLowerCase().includes(searchTerm)
          );
        });

        const featureItems: Item[] = matchedIds.map((fid) => {
          const meta = FEATURE_REGISTRY[fid];
          const isEnabled = matrix[fid]?.enabled ?? true;
          return {
            id: `feat-${fid}`,
            title: `${meta.name}: ${isEnabled ? "Enabled" : "Disabled"}`,
            subtitle: `${isEnabled ? "↵ Press Enter to Disable" : "↵ Press Enter to Enable"} • ${meta.description}`,
            category: "Setting",
            iconType: "setting",
            path: `feature-toggle://${fid}`,
          };
        });

        setItems(featureItems);
        setSelectedIndex(0);
        return;
      }

      // DPAPI Environment Profiles & Secret Switcher
      const isEnvTrigger =
        qLower === "env" ||
        qLower === ":env" ||
        qLower === "vault" ||
        qLower === ":vault" ||
        qLower.startsWith("env ") ||
        qLower.startsWith(":env ") ||
        qLower.startsWith("vault ");

      if (isEnvTrigger && isFeatureEnabled("secret_vault")) {
        const searchProfile = qLower.replace(/^(:?env|:?vault)\s*/, "").trim();
        listEnvProfiles().then((profiles) => {
          const matched = profiles.filter((p) =>
            !searchProfile ? true : p.name.toLowerCase().includes(searchProfile)
          );

          const envItems: Item[] = matched.map((p) => ({
            id: `env-${p.name}`,
            title: `Environment: ${p.name}`,
            subtitle: `${p.var_count} secrets [${p.redacted_keys.slice(0, 3).join(", ")}] • Enter to launch terminal`,
            category: "Command",
            iconType: "cmd",
            path: `env-launch://${p.name}`,
          }));

          envItems.push({
            id: "env-new-profile",
            title: "Create Encrypted Environment Profile",
            subtitle: "Add new DPAPI-encrypted environment variables & secrets (Ctrl+,)",
            category: "Setting",
            iconType: "setting",
            path: "altspace://features",
          });

          setItems(envItems);
          setSelectedIndex(0);
        });
        return;
      }

      // Docker & WSL2 Environment Cockpit (Option A + C Omnibar Trigger)
      const isDockerWslTrigger =
        qLower === "docker" ||
        qLower === ":docker" ||
        qLower === "wsl" ||
        qLower === ":wsl" ||
        qLower === "compose" ||
        qLower === ":compose" ||
        qLower === "containers" ||
        qLower === "vmmem" ||
        qLower.startsWith("docker ") ||
        qLower.startsWith(":docker ") ||
        qLower.startsWith("wsl ") ||
        qLower.startsWith(":wsl ") ||
        qLower.startsWith("compose ");

      if (isDockerWslTrigger && isFeatureEnabled("docker_wsl")) {
        const filterTerm = qLower.replace(/^(:?docker|:?wsl|:?compose)\s*/, "").trim();
        getEnvironmentCockpit().then((data) => {
          const cockpitItems: Item[] = [];

          // 1. WSL Section
          if (!qLower.startsWith("docker ") && !qLower.startsWith(":docker ")) {
            for (const distro of data.wsl.distros) {
              if (filterTerm && !distro.name.toLowerCase().includes(filterTerm)) continue;
              const isRunning = distro.state.toLowerCase() === "running";
              cockpitItems.push({
                id: `wsl-${distro.name}`,
                title: `WSL: ${distro.name} ${distro.is_default ? "★ Default" : ""}`,
                subtitle: `${isRunning ? "● Running" : "○ Stopped"} • WSL ${distro.version} • Enter to launch shell`,
                category: "Command",
                iconType: "cmd",
                path: `wsl://${distro.name}`,
              });
            }

            if (data.wsl.vmmem_detected) {
              cockpitItems.push({
                id: "wsl-shutdown-action",
                title: `Reclaim WSL Memory (${data.wsl.vmmem_ram_mb ? `${data.wsl.vmmem_ram_mb} MB` : "vmmem active"})`,
                subtitle: "Shutdown WSL VM and free dynamic memory back to Windows",
                category: "Command",
                iconType: "cmd",
                path: "wsl://shutdown",
              });
            }
          }

          // 2. Docker Section
          if (!qLower.startsWith("wsl ") && !qLower.startsWith(":wsl ")) {
            if (!data.docker.daemon_running) {
              cockpitItems.push({
                id: "docker-offline-action",
                title: "Docker Desktop Daemon: Offline",
                subtitle: "Docker pipe not responding • Press Enter to launch Docker Desktop",
                category: "Command",
                iconType: "cmd",
                path: "docker://start-daemon",
              });
            } else {
              for (const c of data.docker.containers) {
                if (
                  filterTerm &&
                  !c.names.toLowerCase().includes(filterTerm) &&
                  !c.image.toLowerCase().includes(filterTerm) &&
                  !(c.compose_project && c.compose_project.toLowerCase().includes(filterTerm))
                ) {
                  continue;
                }
                const isRunning = c.state.toLowerCase() === "running";
                cockpitItems.push({
                  id: `docker-${c.id}`,
                  title: `${c.names || c.id} (${c.image})`,
                  subtitle: `${isRunning ? "● Running" : "○ Stopped"} ${c.compose_project ? `• [${c.compose_project}]` : ""} ${c.ports ? `• Ports: ${c.ports}` : ""}`,
                  category: "Command",
                  iconType: "cmd",
                  path: `docker://${c.id}`,
                });
              }
            }
          }

          setItems(cockpitItems);
          setSelectedIndex(0);
        });
        return;
      }

      // Instant optimistic fallback with Context-Aware Hybrid Priority
      const fallbackList = getCachedOrInitialApps();
      if (!qTrim) {
        setItems(sortByFrequency(fallbackList));
      } else {
        const q = qTrim.toLowerCase();
        const isFileIntent = q.includes("/") || q.includes("\\") || /\.[a-z0-9]{1,6}$/i.test(q);
        const utilityMatches = q.startsWith(":")
          ? UTILITY_ITEMS.filter((item) =>
              item.title.toLowerCase().includes(q.slice(1)) ||
              item.path.toLowerCase().includes(q)
            )
          : [];
        const filtered = fallbackList.filter(
          (item) =>
            (item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)) &&
            (item.category !== "File" || !isExtensionBlocked(item.path, q))
        );
        const rankedFiltered = [...filtered].sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          const aIsApp = a.category === "Application" ? 1 : 0;
          const bIsApp = b.category === "Application" ? 1 : 0;
          if (!isFileIntent && aIsApp !== bIsApp) return bIsApp - aIsApp;
          if (isFileIntent && aIsApp !== bIsApp) return aIsApp - bIsApp;
          const aScore = aTitle === q ? 60000 : aTitle.startsWith(q) ? 50000 : aTitle.split(/\s+/).some((w) => w.startsWith(q)) ? 45000 : aTitle.includes(q) ? 35000 : 10000;
          const bScore = bTitle === q ? 60000 : bTitle.startsWith(q) ? 50000 : bTitle.split(/\s+/).some((w) => w.startsWith(q)) ? 45000 : bTitle.includes(q) ? 35000 : 10000;
          return bScore - aScore;
        });

        const appItems = rankedFiltered.filter((i) => i.category === "Application");
        const otherFiltered = rankedFiltered.filter((i) => i.category !== "Application");

        if (!isFileIntent) {
          setItems([
            ...utilityMatches,
            ...appItems,
            ...pluginItems,
            ...themeItems,
            ...gameItems,
            ...snapItems,
            ...settingItems,
            ...snippetItems,
            ...otherFiltered,
          ]);
        } else {
          setItems([
            ...utilityMatches,
            ...otherFiltered,
            ...appItems,
            ...pluginItems,
            ...themeItems,
            ...gameItems,
            ...snapItems,
            ...settingItems,
            ...snippetItems,
          ]);
        }
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
        const usage = consumeAdvancedSearch(Date.now(), debouncedQuery.trim());
        if (!usage.allowed) {
          const quotaCard: Item = {
            id: "quota-limit-notice",
            title: "100 Advanced Actions Used (30-Day Trial)",
            subtitle: "Normal local search remains 100% free forever. Connect GitHub or upgrade to unlock unmetered advanced actions.",
            category: "Command",
            iconType: "cmd",
            path: "altspace://license",
          };
          setItems((prev) => [quotaCard, ...prev]);
          return () => { active = false; };
        }
        if (usage.warning) {
          onNotify?.(`Advanced action trial: ${usage.remaining} actions remaining in this 30-day window.`);
        }
      }
    }

    runAdvancedSearch();
    function runAdvancedSearch() {
      tauriInvoke<any[]>("search", { query: debouncedQuery })
        .then((res) => {
          if (!active || currentSeq !== searchSeq.current || !res || !Array.isArray(res) || res.length === 0) return;

          const mapped: Item[] = res
            .map((r: any) => ({
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
            .filter((item: Item) => {
              if (item.category === "File") {
                return !isExtensionBlocked(item.path, debouncedQuery);
              }
              return true;
            });

          const isFileIntent = debouncedQuery.includes("/") || debouncedQuery.includes("\\") || /\.[a-z0-9]{1,6}$/i.test(debouncedQuery.trim());
          setItems((prev) => {
            const nonL2 = prev.filter(
              (i) =>
                i.category === "Setting" ||
                i.category === "Snippet" ||
                i.category === "Window Management" ||
                i.category === "Game" ||
                i.category === "Theme" ||
                i.id.endsWith("-folder") ||
                i.id.endsWith("-exe")
            );
            const appsOnly = mapped.filter((i) => i.category === "Application");
            const filesOnly = mapped.filter((i) => i.category !== "Application");
            if (appsOnly.length > 0) saveCachedApps(appsOnly);

            if (!isFileIntent) {
              // Default: Applications first, then Settings/Widgets, then Files & Folders
              return [...appsOnly, ...nonL2, ...filesOnly];
            } else {
              // File Intent: Files & Folders first, then Applications, then Settings
              return [...filesOnly, ...appsOnly, ...nonL2];
            }
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

  const transformResult =
    currentMode === "all" && !isAiQuery && !isTerminalCommand
      ? evaluateDeveloperTransform(query)
      : null;

  const calcResult = currentMode === "all" && !isAiQuery && !transformResult ? evaluateSmartQuery(query) : null;
  const quickJumpResult = currentMode === "all" && !isAiQuery && !transformResult && !calcResult ? evaluateQuickJump(query) : null;
  const directSnippetMatch =
    currentMode === "all" && !isAiQuery && !transformResult && !calcResult && !quickJumpResult && query.trim().startsWith("!")
      ? searchSnippets(query.trim())[0] || null
      : null;

  const gameHeroData =
    currentMode === "all" && !isAiQuery && !isTerminalCommand && !transformResult && !calcResult && !quickJumpResult && !directSnippetMatch
      ? resolveGameHeroCard(query, installedGames)
      : null;

  const specialCard: SpecialCard | null = actionPlan
    ? {
        kind: "plan",
        data: actionPlan,
      }
    : isAiQuery
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
    : transformResult
    ? { kind: "transform", data: transformResult }
    : calcResult
    ? { kind: "calc", data: calcResult }
    : quickJumpResult
    ? { kind: "quickjump", data: quickJumpResult }
    : directSnippetMatch
    ? { kind: "snippet", data: directSnippetMatch }
    : gameHeroData
    ? { kind: "game", data: gameHeroData }
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
    plugins,
    handleExecuteTerminalCommand,
    handleLaunchTerminalWindow,
  };
}
