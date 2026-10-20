import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Code2,
  Download,
  ExternalLink,
  GitBranch,
  Globe2,
  Heart,
  Info,
  Loader2,
  Network,
  PackageOpen,
  ShieldAlert,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  Wifi,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
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

const categories = ["All", "Dev Tools", "System", "Network", "Media"];

function ExtensionIcon({ name }: { name: string }) {
  const icons: Record<string, ReactNode> = {
    globe: <Globe2 className="h-5 w-5 text-sky-300" />,
    git: <GitBranch className="h-5 w-5 text-orange-300" />,
    code: <Code2 className="h-5 w-5 text-violet-300" />,
    network: <Network className="h-5 w-5 text-emerald-300" />,
    terminal: <Terminal className="h-5 w-5 text-amber-300" />,
    volume: <Wifi className="h-5 w-5 text-pink-300" />,
  };
  return icons[name] ?? <Sparkles className="h-5 w-5 text-cyan-300" />;
}

export function StoreTab({
  query,
  selectedIndex,
  setSelectedIndex,
  onCopiedNotification,
  onRefreshInstalledPlugins,
}: StoreTabProps) {
  const [plugins, setPlugins] = useState<ExtensionRegistryItem[]>([]);
  const [installedPluginIds, setInstalledPluginIds] = useState<Set<string>>(new Set());
  const [loadingPluginId, setLoadingPluginId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    getExtensionRegistry().then(setPlugins);
  }, []);

  const refreshInstalled = async () => {
    try {
      const installed = await tauriInvoke<{ id: string }[]>("list_plugins");
      if (Array.isArray(installed)) {
        setInstalledPluginIds(new Set(installed.map((plugin) => plugin.id)));
      }
    } catch {
      // The marketplace remains usable when the plugin directory is unavailable.
    }
  };

  useEffect(() => {
    refreshInstalled();
  }, []);

  const filteredPlugins = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const matchesCategory =
        selectedCategory === "All" || plugin.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [plugin.name, plugin.description, plugin.keyword, plugin.author]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [plugins, query, selectedCategory]);

  const handleInstall = async (plugin: ExtensionRegistryItem) => {
    setLoadingPluginId(plugin.id);
    try {
      await installRegistryExtension(plugin);
      await refreshInstalled();
      onRefreshInstalledPlugins?.();
      onCopiedNotification(`Installed ${plugin.name}! Type "${plugin.keyword}" to run`);
    } catch (error: any) {
      onCopiedNotification(`Install blocked: ${error?.message || error}`);
    } finally {
      setLoadingPluginId(null);
    }
  };

  const handleUninstall = async (plugin: ExtensionRegistryItem) => {
    setLoadingPluginId(plugin.id);
    try {
      await uninstallRegistryExtension(plugin.id);
      await refreshInstalled();
      onRefreshInstalledPlugins?.();
      onCopiedNotification(`Uninstalled ${plugin.name}`);
    } catch (error: any) {
      onCopiedNotification(`Failed to uninstall: ${error?.message || error}`);
    } finally {
      setLoadingPluginId(null);
    }
  };

  const openSponsor = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0d0d11]">
      <div className="shrink-0 border-b border-white/[0.07] bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,0.22),transparent_34%),linear-gradient(120deg,rgba(255,255,255,0.04),transparent_55%)] px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200 shadow-[0_0_30px_rgba(139,92,246,0.18)]">
              <PackageOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
                  Community extensions
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  <ShieldAlert className="h-3 w-3" />
                  Review before install
                </span>
              </div>
              <p className="mt-1 max-w-[520px] text-xs leading-5 text-zinc-400">
                Small tools made by the community. Extensions run with your Windows user permissions.
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
              {filteredPlugins.length} available
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
              {installedPluginIds.size} installed
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-0.5">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                selectedCategory === category
                  ? "border-white/20 bg-white/12 text-white shadow-sm"
                  : "border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-200"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {filteredPlugins.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
            <Info className="mb-2 h-5 w-5 text-zinc-600" />
            <p className="text-sm text-zinc-400">No extensions match this view.</p>
            <p className="mt-1 text-xs text-zinc-600">Try another category or clear the search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredPlugins.map((plugin, index) => {
              const installed = installedPluginIds.has(plugin.id);
              const isBuiltin = BUILTIN_EXTENSIONS.some((item) => item.id === plugin.id);
              const selected = selectedIndex === index;
              const loading = loadingPluginId === plugin.id;

              return (
                <article
                  key={plugin.id}
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-4 transition duration-200",
                    selected
                      ? "border-violet-300/30 bg-violet-300/[0.08] shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                      : "border-white/[0.07] bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                      <ExtensionIcon name={plugin.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h2 className="truncate text-sm font-semibold text-white">{plugin.name}</h2>
                            <span className="rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                              {plugin.keyword}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                            {plugin.description}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-600">v{plugin.version}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <GithubIcon className="h-3 w-3" /> @{plugin.authorGithub}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-300/80">
                          <Star className="h-3 w-3 fill-current" /> {plugin.rating}
                        </span>
                        <span>{plugin.downloads.toLocaleString()} installs</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {installed ? "Installed locally" : "Community package"}
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.sponsorUrl && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openSponsor(plugin.sponsorUrl!);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300/15 bg-rose-300/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-rose-200 transition hover:bg-rose-300/[0.14]"
                        >
                          <Heart className="h-3 w-3" />
                          Sponsor
                        </button>
                      )}
                      {installed ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-emerald-200">
                            <Check className="h-3 w-3" /> Installed
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleUninstall(plugin);
                            }}
                            disabled={loading || !isBuiltin}
                            aria-label={`Uninstall ${plugin.name}`}
                            className="rounded-lg border border-white/10 p-1.5 text-zinc-500 transition hover:border-rose-300/20 hover:bg-rose-300/[0.08] hover:text-rose-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleInstall(plugin);
                          }}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {loading ? "Checking…" : isBuiltin ? "Install" : "Awaiting signing"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.07] bg-white/[0.02] px-5 py-2.5 text-[11px] text-zinc-500">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          Build an extension and receive direct creator sponsorships.
        </span>
        <a
          href="https://github.com/codecheesee/altspace#contributing"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-violet-200 transition hover:text-white"
        >
          Submit <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
