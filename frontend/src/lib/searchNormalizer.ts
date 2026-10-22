import type { GameCardData, GameItem } from "../types";

export interface CatalogGame {
  id: string;
  title: string;
  aliases: string[];
  developer: string;
  genre: string;
  releaseYear: number;
  bannerUrl: string;
  badgeText: string;
  accentColor: string;
  steamAppId?: string;
}

/**
 * Numeral and Roman Numeral bidirectional synonym dictionary
 */
export const NUMERAL_SYNONYMS: Record<string, string[]> = {
  "1": ["1", "i", "one"],
  "2": ["2", "ii", "two"],
  "3": ["3", "iii", "three"],
  "4": ["4", "iv", "four"],
  "5": ["5", "v", "five"],
  "6": ["6", "vi", "six"],
  "7": ["7", "vii", "seven"],
  "8": ["8", "viii", "eight"],
  "9": ["9", "ix", "nine"],
  "10": ["10", "x", "ten"],
  i: ["i", "1", "one"],
  ii: ["ii", "2", "two"],
  iii: ["iii", "3", "three"],
  iv: ["iv", "4", "four"],
  v: ["v", "5", "five"],
  vi: ["vi", "6", "six"],
  vii: ["vii", "7", "seven"],
  viii: ["viii", "8", "eight"],
  ix: ["ix", "9", "nine"],
  x: ["x", "10", "ten"],
  one: ["one", "1", "i"],
  two: ["two", "2", "ii"],
  three: ["three", "3", "iii"],
  four: ["four", "4", "iv"],
  five: ["five", "5", "v"],
  six: ["six", "6", "vi"],
  seven: ["seven", "7", "vii"],
  eight: ["eight", "8", "viii"],
  nine: ["nine", "9", "ix"],
  ten: ["ten", "10", "x"],
};

/**
 * Curated Global Game Knowledge Catalog (Top 2026 & Legendary PC Games)
 */
export const POPULAR_GAMES_CATALOG: CatalogGame[] = [
  {
    id: "gta-5",
    title: "Grand Theft Auto V",
    aliases: [
      "gta 5",
      "gta v",
      "gta five",
      "gta5",
      "gtav",
      "grand theft auto 5",
      "grand theft auto v",
      "grand theft auto five",
      "gta",
    ],
    developer: "Rockstar Games",
    genre: "Action-Adventure • Open World",
    releaseYear: 2013,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
    badgeText: "V",
    accentColor: "#22c55e",
    steamAppId: "271590",
  },
  {
    id: "gta-6",
    title: "Grand Theft Auto VI",
    aliases: [
      "gta 6",
      "gta vi",
      "gta six",
      "gta6",
      "gtavi",
      "grand theft auto 6",
      "grand theft auto vi",
      "grand theft auto six",
    ],
    developer: "Rockstar Games",
    genre: "Action-Adventure • Open World",
    releaseYear: 2025,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
    badgeText: "VI",
    accentColor: "#ec4899",
  },
  {
    id: "gta-4",
    title: "Grand Theft Auto IV",
    aliases: [
      "gta 4",
      "gta iv",
      "gta four",
      "gta4",
      "gtaiv",
      "grand theft auto 4",
      "grand theft auto iv",
      "grand theft auto four",
    ],
    developer: "Rockstar Games",
    genre: "Action-Adventure • Open World",
    releaseYear: 2008,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/12210/header.jpg",
    badgeText: "IV",
    accentColor: "#eab308",
    steamAppId: "12210",
  },
  {
    id: "cyberpunk-2077",
    title: "Cyberpunk 2077",
    aliases: ["cyberpunk", "cp2077", "cyberpunk 2077", "cp 2077", "phantom liberty"],
    developer: "CD PROJEKT RED",
    genre: "Open World RPG • Sci-Fi",
    releaseYear: 2020,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg",
    badgeText: "2077",
    accentColor: "#facc15",
    steamAppId: "1091500",
  },
  {
    id: "rdr-2",
    title: "Red Dead Redemption 2",
    aliases: [
      "red dead redemption 2",
      "rdr2",
      "rdr 2",
      "red dead 2",
      "red dead redemption ii",
      "rdr ii",
      "red dead",
    ],
    developer: "Rockstar Games",
    genre: "Open World Western • Action",
    releaseYear: 2018,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/header.jpg",
    badgeText: "RDR2",
    accentColor: "#ef4444",
    steamAppId: "1174180",
  },
  {
    id: "counter-strike-2",
    title: "Counter-Strike 2",
    aliases: ["cs2", "cs 2", "counter strike", "counter strike 2", "csgo", "cs:go", "counter-strike"],
    developer: "Valve",
    genre: "Tactical FPS • Competitive",
    releaseYear: 2023,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
    badgeText: "CS2",
    accentColor: "#f97316",
    steamAppId: "730",
  },
  {
    id: "valorant",
    title: "Valorant",
    aliases: ["valorant", "valo"],
    developer: "Riot Games",
    genre: "Character-Based Tactical Shooter",
    releaseYear: 2020,
    bannerUrl: "https://images.contentstack.io/v3/assets/blt3706121367b58ab8/blt4f25b29b686e06a7/649be5e523f982112be7c87c/VALORANT_Jett_KeyArt.jpg",
    badgeText: "VAL",
    accentColor: "#fb7185",
  },
  {
    id: "minecraft",
    title: "Minecraft",
    aliases: ["minecraft", "mc", "minecraft java", "minecraft bedrock"],
    developer: "Mojang Studios",
    genre: "Sandbox • Survival • Creative",
    releaseYear: 2011,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
    badgeText: "MC",
    accentColor: "#10b981",
  },
  {
    id: "elden-ring",
    title: "Elden Ring",
    aliases: ["elden ring", "shadow of the erdtree", "er"],
    developer: "FromSoftware",
    genre: "Action RPG • Soulslike",
    releaseYear: 2022,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
    badgeText: "ELDEN",
    accentColor: "#d97706",
    steamAppId: "1245620",
  },
  {
    id: "witcher-3",
    title: "The Witcher 3: Wild Hunt",
    aliases: [
      "witcher 3",
      "witcher three",
      "witcher iii",
      "the witcher 3",
      "tw3",
      "witcher",
    ],
    developer: "CD PROJEKT RED",
    genre: "Story-Rich RPG • Fantasy",
    releaseYear: 2015,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg",
    badgeText: "W3",
    accentColor: "#0284c7",
    steamAppId: "292030",
  },
  {
    id: "baldurs-gate-3",
    title: "Baldur's Gate 3",
    aliases: ["baldurs gate 3", "bg3", "bg 3", "baldur's gate 3", "baldurs gate iii"],
    developer: "Larian Studios",
    genre: "Turn-Based Party RPG",
    releaseYear: 2023,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg",
    badgeText: "BG3",
    accentColor: "#a855f7",
    steamAppId: "1086940",
  },
  {
    id: "helldivers-2",
    title: "Helldivers 2",
    aliases: ["helldivers 2", "helldivers ii", "hd2", "hd 2", "helldivers"],
    developer: "Arrowhead Game Studios",
    genre: "Third-Person Co-Op Shooter",
    releaseYear: 2024,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg",
    badgeText: "HD2",
    accentColor: "#eab308",
    steamAppId: "553850",
  },
  {
    id: "cod-4",
    title: "Call of Duty 4: Modern Warfare",
    aliases: [
      "call of duty 4 modern warfare",
      "call of duty 4",
      "cod 4",
      "cod4",
      "call of duty",
      "modern warfare",
      "cod",
    ],
    developer: "Infinity Ward",
    genre: "First-Person Shooter",
    releaseYear: 2007,
    bannerUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/7940/header.jpg",
    badgeText: "COD4",
    accentColor: "#38bdf8",
    steamAppId: "7940",
  },
];

/**
 * Normalize search queries according to 2026 industry standards:
 * 1. Lowercase and trim
 * 2. Convert literal word "space" to standard whitespace (e.g. "GTA space 5" -> "gta 5")
 * 3. Normalize punctuation & delimiters (dots, dashes, underscores) to spaces
 * 4. Separate fused alphanumeric tokens (e.g. "gta5" -> "gta 5", "rdr2" -> "rdr 2")
 * 5. Handle compound acronyms like "gtav" -> "gta v"
 * 6. Collapse consecutive whitespace
 */
export function normalizeSearchQuery(raw: string): string {
  if (!raw) return "";

  let cleaned = raw.toLowerCase().trim();

  // Handle literal "space" or " space " typed or spoken by user
  cleaned = cleaned.replace(/\bspace\b/g, " ");

  // Normalize delimiters to spaces
  cleaned = cleaned.replace(/[-_.:/]/g, " ");

  // Separate fused letters and numbers (e.g. "gta5" -> "gta 5", "cs2" -> "cs 2", "v2" -> "v 2")
  cleaned = cleaned.replace(/([a-zA-Z])(\d+)/g, "$1 $2");
  cleaned = cleaned.replace(/(\d+)([a-zA-Z])/g, "$1 $2");

  // Decompose well-known Roman numeral game fusions (e.g. "gtav" -> "gta v", "gtaiv" -> "gta iv")
  cleaned = cleaned.replace(/\bgta\s*v\b/g, "gta v");
  cleaned = cleaned.replace(/\bgtav\b/g, "gta v");
  cleaned = cleaned.replace(/\bgtaiv\b/g, "gta iv");
  cleaned = cleaned.replace(/\brdrii\b/g, "rdr ii");

  // Collapse multiple whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Expand a list of query tokens with Roman numeral & numeric synonyms.
 * Example: ["gta", "5"] -> [["gta"], ["5", "v", "five"]]
 */
export function expandTokensWithSynonyms(tokens: string[]): string[][] {
  return tokens.map((tok) => {
    const synonyms = NUMERAL_SYNONYMS[tok];
    if (synonyms) {
      return Array.from(new Set([tok, ...synonyms]));
    }
    return [tok];
  });
}

/**
 * Tokenize a string into alphanumeric word tokens
 */
export function tokenize(str: string): string[] {
  return normalizeSearchQuery(str)
    .split(" ")
    .filter((s) => s.length > 0);
}

/**
 * Test whether a query matches a game title or alias considering token order and numeral synonyms.
 */
export function isQueryMatchForGame(query: string, candidateName: string, aliases: string[] = []): { isMatch: boolean; score: number } {
  const normQuery = normalizeSearchQuery(query);
  if (!normQuery) return { isMatch: false, score: 0 };

  const queryTokens = tokenize(normQuery);
  if (queryTokens.length === 0) return { isMatch: false, score: 0 };

  const allCandidates = [candidateName, ...aliases];

  for (const candidate of allCandidates) {
    const normCandidate = normalizeSearchQuery(candidate);
    if (!normCandidate) continue;

    // Exact match after normalization
    if (normQuery === normCandidate) {
      return { isMatch: true, score: 1000 };
    }

    const candidateTokens = tokenize(normCandidate);

    // Check if all query tokens (or their numeric synonyms) exist in candidate tokens
    const tokenExpansions = expandTokensWithSynonyms(queryTokens);
    const allQueryTokensMatched = tokenExpansions.every((synonymList) => {
      return synonymList.some((syn) => candidateTokens.includes(syn));
    });

    if (allQueryTokensMatched) {
      // Score based on token coverage
      const coverage = (queryTokens.length / candidateTokens.length) * 500;
      return { isMatch: true, score: 500 + Math.round(coverage) };
    }

    // Acronym check: e.g. "gta" matching "Grand Theft Auto V"
    const acronym = candidateTokens.map((t) => t[0]).join("");
    if (normQuery === acronym || acronym.startsWith(normQuery)) {
      return { isMatch: true, score: 700 };
    }

    // Acronym + Numeral check: e.g. "gta 5" matching "Grand Theft Auto V"
    if (candidateTokens.length >= 2) {
      const words = candidateTokens.slice(0, -1);
      const lastToken = candidateTokens[candidateTokens.length - 1];
      const baseAcronym = words.map((w) => w[0]).join(""); // "gta"

      if (queryTokens.length === 2 && queryTokens[0] === baseAcronym) {
        const queryNum = queryTokens[1];
        const numSynonyms = NUMERAL_SYNONYMS[queryNum] || [queryNum];
        if (numSynonyms.includes(lastToken)) {
          return { isMatch: true, score: 950 };
        }
      }
    }
  }

  return { isMatch: false, score: 0 };
}

/**
 * Resolve a search query against installed games and the game knowledge catalog.
 * Returns rich GameCardData if the user's intent is a game launcher search.
 */
export function resolveGameHeroCard(query: string, installedGames: GameItem[]): GameCardData | null {
  const normQuery = normalizeSearchQuery(query);
  if (!normQuery || normQuery.length < 2) return null;

  // Step 1: Check if query matches a known game in the global catalog
  let bestCatalog: { catalog: CatalogGame; score: number } | null = null;
  for (const cat of POPULAR_GAMES_CATALOG) {
    const res = isQueryMatchForGame(normQuery, cat.title, cat.aliases);
    if (res.isMatch) {
      if (!bestCatalog || res.score > bestCatalog.score) {
        bestCatalog = { catalog: cat, score: res.score };
      }
    }
  }

  if (bestCatalog) {
    const cat = bestCatalog.catalog;

    // Check if this matched catalog game is installed locally on this machine
    const matchedInstalled = installedGames.find((g) => {
      const normInstalled = normalizeSearchQuery(g.title);
      if (normInstalled === normalizeSearchQuery(cat.title)) return true;
      if (cat.aliases.some((a) => normalizeSearchQuery(a) === normInstalled)) return true;
      const pathLower = g.install_path.toLowerCase();
      const catLower = cat.title.toLowerCase();
      if (
        pathLower.includes(catLower) ||
        (cat.id === "gta-5" && (pathLower.includes("grand theft auto v") || pathLower.includes("gta v") || pathLower.includes("gta5")))
      ) {
        return true;
      }
      return false;
    });

    if (matchedInstalled) {
      return {
        id: matchedInstalled.id,
        title: cat.title,
        subtitle: `${matchedInstalled.platform} • ${cat.genre} • ${
          matchedInstalled.size_gb ? `${matchedInstalled.size_gb} GB` : "Installed"
        }`,
        platform: matchedInstalled.platform,
        install_path: matchedInstalled.install_path,
        executable_path: matchedInstalled.executable_path || undefined,
        launch_uri: matchedInstalled.launch_uri,
        banner_url: matchedInstalled.banner_url || cat.bannerUrl,
        badge_text: cat.badgeText,
        accent_color: cat.accentColor,
        genre: cat.genre,
        developer: cat.developer,
        release_year: cat.releaseYear,
        size_gb: matchedInstalled.size_gb || undefined,
        is_installed: true,
      };
    }

    // Catalog match exists but game is not installed locally
    const launchUri = cat.steamAppId
      ? `steam://rungameid/${cat.steamAppId}`
      : `https://store.steampowered.com/search/?term=${encodeURIComponent(cat.title)}`;

    return {
      id: `catalog-${cat.id}`,
      title: cat.title,
      subtitle: `${cat.developer} • ${cat.genre} (${cat.releaseYear}) • Available on Steam`,
      platform: "Steam / PC",
      install_path: "",
      launch_uri: launchUri,
      banner_url: cat.bannerUrl,
      badge_text: cat.badgeText,
      accent_color: cat.accentColor,
      genre: cat.genre,
      developer: cat.developer,
      release_year: cat.releaseYear,
      is_installed: false,
    };
  }

  // Step 2: Query did not match catalog; check directly against installed games
  let bestDirectInstalled: { game: GameItem; score: number } | null = null;
  for (const g of installedGames) {
    const res = isQueryMatchForGame(normQuery, g.title, []);
    if (res.isMatch) {
      if (!bestDirectInstalled || res.score > bestDirectInstalled.score) {
        bestDirectInstalled = { game: g, score: res.score };
      }
    }
  }

  if (bestDirectInstalled) {
    const { game } = bestDirectInstalled;
    return {
      id: game.id,
      title: game.title,
      subtitle: `${game.platform} • ${game.size_gb ? `${game.size_gb} GB` : "Installed"}`,
      platform: game.platform,
      install_path: game.install_path,
      executable_path: game.executable_path || undefined,
      launch_uri: game.launch_uri,
      banner_url: game.banner_url || undefined,
      badge_text: game.title.slice(0, 3).toUpperCase(),
      accent_color: "#10b981",
      genre: "PC Game",
      developer: "Installed Application",
      size_gb: game.size_gb || undefined,
      is_installed: true,
    };
  }

  return null;
}
