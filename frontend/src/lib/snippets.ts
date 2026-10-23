export interface Snippet {
  id: string;
  keyword: string; // e.g. "!email", "!shrug", "!date", "!guid"
  name: string;
  content: string; // May contain dynamic tokens like {date}, {time}, {uuid}, {clipboard}
  category: string;
  description: string;
}

const STORAGE_KEY = "altspace_user_snippets_v1";

export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: "snip-shrug",
    keyword: "!shrug",
    name: "Shrug Emoji",
    content: "¯\\_(ツ)_/¯",
    category: "Symbols",
    description: "Classic ASCII shrug emoji",
  },
  {
    id: "snip-tableflip",
    keyword: "!tableflip",
    name: "Table Flip",
    content: "(╯°□°)╯︵ ┻━┻",
    category: "Symbols",
    description: "Rage ASCII table flip",
  },
  {
    id: "snip-date",
    keyword: "!date",
    name: "Current Date",
    content: "{date}",
    category: "Productivity",
    description: "Inserts today's ISO date (YYYY-MM-DD)",
  },
  {
    id: "snip-time",
    keyword: "!time",
    name: "Current Time",
    content: "{time}",
    category: "Productivity",
    description: "Inserts local 24-hour time (HH:MM:SS)",
  },
  {
    id: "snip-uuid",
    keyword: "!uuid",
    name: "Generate UUID / GUID",
    content: "{uuid}",
    category: "Developer",
    description: "Cryptographically generated v4 UUID",
  },
  {
    id: "snip-lorem",
    keyword: "!lorem",
    name: "Lorem Ipsum Placeholder",
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    category: "Developer",
    description: "Standard dummy typography text",
  },
  {
    id: "snip-email",
    keyword: "!email",
    name: "Personal Email Placeholder",
    content: "developer@domain.com",
    category: "Contact",
    description: "Quick personal email template",
  },
  {
    id: "snip-meeting",
    keyword: "!meeting",
    name: "Meeting Notes Skeleton",
    content: "## Meeting Notes - {date}\n\n### Attendees:\n- \n\n### Agenda:\n1. \n\n### Action Items:\n- [ ] ",
    category: "Productivity",
    description: "Markdown meeting agenda and checklist template",
  },
  {
    id: "snip-pr",
    keyword: "!pr",
    name: "Pull Request Template",
    content: "## Summary of Changes\n\n### Motivation & Context\n\n### Testing Done\n- [ ] Unit tests pass\n- [ ] Manual verification\n\n### Checklist\n- [x] Self-reviewed code",
    category: "Developer",
    description: "Standard GitHub / GitLab PR markdown skeleton",
  },
];

export function getUserSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return DEFAULT_SNIPPETS;
}

export function saveUserSnippets(snippets: Snippet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch (_) {}
}

export function resolveSnippetContent(rawContent: string, clipboardFallback?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0];

  // Pseudo-v4 UUID generator
  const uuidStr = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  return rawContent
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr)
    .replace(/{uuid}/g, uuidStr)
    .replace(/{guid}/g, uuidStr)
    .replace(/{clipboard}/g, clipboardFallback || "");
}

export interface SnippetMatch {
  snippet: Snippet;
  resolvedContent: string;
}

export function searchSnippets(query: string, clipboardFallback?: string): SnippetMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const snippets = getUserSnippets();

  return snippets
    .filter((s) => {
      // If user typed "!keyword"
      if (q.startsWith("!") && s.keyword.toLowerCase().startsWith(q)) return true;
      // Also match regular name, keyword without !, or description
      return (
        s.keyword.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    })
    .map((s) => ({
      snippet: s,
      resolvedContent: resolveSnippetContent(s.content, clipboardFallback),
    }));
}
