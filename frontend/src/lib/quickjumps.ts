export interface CustomQuicklink {
  id: string;
  prefix: string;
  name: string;
  urlTemplate: string;
  description: string;
  iconType: "github" | "npm" | "so" | "youtube" | "google" | "wiki" | "web";
}

const STORAGE_KEY = "altspace_custom_quicklinks_v1";

export const DEFAULT_QUICKLINKS: CustomQuicklink[] = [
  {
    id: "ql-gh",
    prefix: "gh",
    name: "GitHub Search & Repo Jump",
    urlTemplate: "https://github.com/{query}",
    description: "Search repositories or jump directly if contains '/'",
    iconType: "github",
  },
  {
    id: "ql-npm",
    prefix: "npm",
    name: "NPM Package Registry",
    urlTemplate: "https://www.npmjs.com/package/{query}",
    description: "Instant lookup for Node / npm modules",
    iconType: "npm",
  },
  {
    id: "ql-so",
    prefix: "so",
    name: "StackOverflow Q&A",
    urlTemplate: "https://stackoverflow.com/search?q={query}",
    description: "Find error codes, answers, and code snippets",
    iconType: "so",
  },
  {
    id: "ql-yt",
    prefix: "yt",
    name: "YouTube Video Search",
    urlTemplate: "https://www.youtube.com/results?search_query={query}",
    description: "Search videos, talks, and tutorials",
    iconType: "youtube",
  },
  {
    id: "ql-g",
    prefix: "g",
    name: "Google Web Search",
    urlTemplate: "https://www.google.com/search?q={query}",
    description: "Instant Google search query",
    iconType: "google",
  },
  {
    id: "ql-w",
    prefix: "w",
    name: "Wikipedia Article",
    urlTemplate: "https://en.wikipedia.org/wiki/Special:Search?search={query}",
    description: "Wikipedia encyclopedia lookup",
    iconType: "wiki",
  },
  {
    id: "ql-crates",
    prefix: "crates",
    name: "Rust Crates.io",
    urlTemplate: "https://crates.io/search?q={query}",
    description: "Rust package repository search",
    iconType: "web",
  },
  {
    id: "ql-claude",
    prefix: "ai",
    name: "ChatGPT / AI Search",
    urlTemplate: "https://chatgpt.com/?q={query}",
    description: "Ask AI directly with prompt parameter",
    iconType: "web",
  },
];

export function getCustomQuicklinks(): CustomQuicklink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return DEFAULT_QUICKLINKS;
}

export function saveCustomQuicklinks(quicklinks: CustomQuicklink[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quicklinks));
  } catch (_) {}
}

export interface QuickJumpResult {
  prefix: string;
  query: string;
  title: string;
  subtitle: string;
  url: string;
  badge: string;
  iconType: "github" | "npm" | "so" | "youtube" | "google" | "wiki" | "web";
}

export function evaluateQuickJump(input: string): QuickJumpResult | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // 1. Direct URL detection (e.g. "https://...", "linear.app", "github.com/facebook")
  const urlRegex = /^(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:com|org|dev|io|net|app|ai|co|xyz|me|info)(?:\/[^\s]*)?)$/i;
  const directUrlMatch = trimmed.match(urlRegex);
  if (directUrlMatch && !trimmed.includes(" ")) {
    const fullUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    return {
      prefix: "url",
      query: trimmed,
      title: `Open ${directUrlMatch[1]}`,
      subtitle: fullUrl,
      url: fullUrl,
      badge: "URL",
      iconType: "web",
    };
  }

  // 2. Shortcut Prefixes with space or colon, e.g. "gh react", "gh:react"
  const prefixMatch = trimmed.match(/^([a-zA-Z0-9_-]+)[:\s]+(.+)$/);
  if (!prefixMatch) return null;

  const tag = prefixMatch[1].toLowerCase();
  const rawTarget = prefixMatch[2].trim();
  if (!rawTarget) return null;

  // Check custom & default quicklinks
  const allQuicklinks = getCustomQuicklinks();
  const matched = allQuicklinks.find((ql) => ql.prefix.toLowerCase() === tag);

  if (matched) {
    // Special handling for GitHub if owner/repo without space
    if ((matched.prefix === "gh" || matched.prefix === "github") && rawTarget.includes("/") && !rawTarget.includes(" ")) {
      const url = `https://github.com/${rawTarget}`;
      return {
        prefix: matched.prefix,
        query: rawTarget,
        title: `GitHub Repository: ${rawTarget}`,
        subtitle: url,
        url,
        badge: "GITHUB",
        iconType: "github",
      };
    }

    const resolvedUrl = matched.urlTemplate.includes("{query}")
      ? matched.urlTemplate.replace("{query}", encodeURIComponent(rawTarget))
      : `${matched.urlTemplate}${encodeURIComponent(rawTarget)}`;

    return {
      prefix: matched.prefix,
      query: rawTarget,
      title: `${matched.name}: "${rawTarget}"`,
      subtitle: resolvedUrl,
      url: resolvedUrl,
      badge: matched.prefix.toUpperCase(),
      iconType: matched.iconType,
    };
  }

  return null;
}
