import { useState, useEffect } from "react";
import {
  Download,
  Trash2,
  Check,
  Star,
  ExternalLink,
  Globe,
  GitBranch,
  Terminal,
  Wifi,
  Code,
  Volume2,
  Sparkles,
  ShoppingBag,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { ErrorBoundary } from "./ErrorBoundary";
import { cn } from "../lib/utils";
import {
  BUILTIN_EXTENSIONS,
  getExtensionRegistry,
  installRegistryExtension,
  uninstallRegistryExtension,
  type ExtensionRegistryItem,
} from "../lib/registry";
import { tauriInvoke } from "../lib/appStorage";

interface StoreTabProps {
  query: string;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  onCopiedNotification: (msg: string) => void;
  onRefreshInstalledPlugins?: () => void;
}

export function StoreTab({
  query,
  selectedIndex,
  setSelectedIndex,
  onCopiedNotification,
  onRefreshInstalledPlugins,
}: StoreTabProps) {
  const [plugins, setPlugins] = useState<ExtensionRegistryItem[]>(BUILTIN_EXTENSIONS);
  const [installedPluginIds, setInstalledPluginIds] = useState<Set<string>>(new Set());
  const [loadingPluginId, setLoadingPluginId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Dev Tools", "System", "Network", "Media"];

  // Load registry from SWR cache/remote
  useEffect(() => {
    getExtensionRegistry().then((list) => {
      setPlugins(list);
    });
  }, []);

  // Scan installed plugins from backend
  const refreshInstalled = async () => {
    try {
      const installed = await tauriInvoke<{ id: string }[]>("list_plugins");
      if (Array.isArray(installed)) {
        setInstalledPluginIds(new Set(installed.map((p) => p.id)));
      }
    } catch (_) {
      // ignore
    }
  };

  useEffect(() => {
    refreshInstalled();
  }, []);

  // Filter plugins based on query and selected category
  const cleanQuery = query.replace(/^:(store|ext|plugins?)\s*/i, "").trim().toLowerCase();
  const filteredPlugins = plugins.filter((p) => {
    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    const matchesQuery =
      !cleanQuery ||
      p.name.toLowerCase().includes(cleanQuery) ||
      p.description.toLowerCase().includes(cleanQuery) ||
      p.keyword.toLowerCase().includes(cleanQuery) ||
      p.author.toLowerCase().includes(cleanQuery);
    return matchesCategory && matchesQuery;
  });

  const handleInstall = async (plugin: ExtensionRegistryItem) => {
    setLoadingPluginId(plugin.id);
    try {
      await installRegistryExtension(plugin);
      await refreshInstalled();
      if (onRefreshInstalledPlugins) onRefreshInstalledPlugins();
      onCopiedNotification(`Installed ${plugin.name}! Type "${plugin.keyword}" to run`);
    } catch (err: any) {
      onCopiedNotification(`Failed to install: ${err?.message || err}`);
    } finally {
      setLoadingPluginId(null);
    }
  };

  const handleUninstall = async (plugin: ExtensionRegistryItem) => {
    setLoadingPluginId(plugin.id);
    try {
      await uninstallRegistryExtension(plugin.id);
      await refreshInstalled();
      if (onRefreshInstalledPlugins) onRefreshInstalledPlugins();
      onCopiedNotification(`Uninstalled ${plugin.name}`);
    } catch (err: any) {
      onCopiedNotification(`Failed to uninstall: ${err?.message || err}`);
    } finally {
      setLoadingPluginId(null);
    }
  };

  const handleOpenSponsor = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url });
    } else {
      window.open(url, "_blank");
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "globe":
        return <Globe className="w-5 h-5 text-sky-400" />;
      case "git":
        return <GitBranch className="w-5 h-5 text-orange-400" />;
      case "code":
        return <Code className="w-5 h-5 text-purple-400" />;
      case "network":
        return <Wifi className="w-5 h-5 text-emerald-400" />;
      case "terminal":
        return <Terminal className="w-5 h-5 text-amber-400" />;
      case "volume":
        return <Volume2 className="w-5 h-5 text-pink-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <ErrorBoundary label="Community Extension Store">
    <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden">
      {/* Top Banner: Registry Info & Categories */}
      <div className="px-5 py-3 border-b border-white/[0.06] bg-gradient-to-r from-purple-500/[0.08] via-pink-500/[0.05] to-transparent flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-tight">
                AltSpace Community Extensions
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Sandboxed & Verified
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              100% Free Open-Source Extensions • Direct Creator Sponsorships • Safe Process Isolation
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer",
                selectedCategory === cat
                  ? "bg-white/[0.12] text-white border border-white/[0.15]"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Plugins List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-500 text-sm">
            <span>No community extensions match "{query}"</span>
          </div>
        ) : (
          filteredPlugins.map((plugin, index) => {
            const isInstalled = installedPluginIds.has(plugin.id);
            const isSelected = selectedIndex === index;
            const isLoading = loadingPluginId === plugin.id;

            return (
              <div
                key={plugin.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer",
                  isSelected
                    ? "bg-white/[0.08] border-white/[0.20] shadow-lg shadow-black/20"
                    : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                )}
              >
                {/* Icon & Metadata */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] shrink-0">
                    {renderIcon(plugin.icon)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm tracking-tight truncate">
                        {plugin.name}
                      </span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-300 border border-white/[0.06]">
                        {plugin.keyword}
                      </span>
                      {plugin.verified && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          ✓ Verified
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-500 font-mono">
                        v{plugin.version}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {plugin.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <GithubIcon className="w-3 h-3 text-neutral-400" />
                        @{plugin.authorGithub || "altspace"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {plugin.rating ?? 5.0}
                      </span>
                      <span>•</span>
                      <span>{(plugin.downloads ?? 0).toLocaleString()} installs</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Direct Sponsor & Install/Uninstall */}
                <div className="flex items-center gap-2 shrink-0">
                  {plugin.sponsorUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSponsor(plugin.sponsorUrl);
                      }}
                      title={`Sponsor @${plugin.authorGithub || "creator"} directly`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium transition cursor-pointer"
                    >
                      <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
                      <span>Tip Creator</span>
                    </button>
                  )}

                  {isInstalled ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                        Installed
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUninstall(plugin);
                        }}
                        disabled={isLoading}
                        title="Uninstall plugin"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstall(plugin);
                      }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.12] hover:bg-white/[0.18] text-white text-xs font-medium transition cursor-pointer border border-white/[0.15] active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isLoading ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Contributor Prompt Banner */}
      <div className="px-5 py-2.5 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs text-neutral-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Build an extension for AltSpace and receive direct sponsorships & community grants!</span>
        </span>
        <a
          href="https://github.com/codecheesee/altspace#contributing"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-purple-300 hover:text-purple-200 font-medium underline underline-offset-2"
        >
          Submit an Extension (PR)
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
    </ErrorBoundary>
  );
}
