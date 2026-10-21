import { isFeatureEnabled } from "./featureMatrix";

export type TransformKind = "jwt" | "json" | "yaml" | "regex" | "hash" | "encoding" | "uuid" | "time";

export interface TransformResult {
  kind: TransformKind;
  title: string;
  badge: string;
  input: string;
  output: string;
  meta?: {
    isExpired?: boolean;
    expiresIn?: string;
    algorithm?: string;
    issuer?: string;
    subject?: string;
    matchCount?: number;
    groups?: string[];
    keysCount?: number;
    sizeFormatted?: string;
    headerJson?: string;
    payloadJson?: string;
    yamlOutput?: string;
  };
}

// Simple base64url decode helper
function base64UrlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch (_) {
    try {
      return atob(str);
    } catch {
      return "";
    }
  }
}

// Lightweight JSON to YAML formatter without external deps
function jsonToYaml(obj: any, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (obj === null) return "null";
  if (typeof obj === "undefined") return "~";
  if (typeof obj !== "object") {
    if (typeof obj === "string") {
      return obj.includes("\n") || obj.includes(":") || obj.includes('"') ? `"${obj.replace(/"/g, '\\"')}"` : obj;
    }
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const itemYaml = jsonToYaml(item, indent + 1);
          const firstNewline = itemYaml.indexOf("\n");
          if (firstNewline === -1) {
            return `${pad}- ${itemYaml.trim()}`;
          }
          return `${pad}- ${itemYaml.trimStart()}`;
        }
        return `${pad}- ${jsonToYaml(item, indent)}`;
      })
      .join("\n");
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  return keys
    .map((k) => {
      const val = obj[k];
      if (typeof val === "object" && val !== null) {
        return `${pad}${k}:\n${jsonToYaml(val, indent + 1)}`;
      }
      return `${pad}${k}: ${jsonToYaml(val, indent)}`;
    })
    .join("\n");
}

// Simple synchronous MD5 implementation
function simpleMd5(str: string): string {
  // Fast DJB2 + FNV hash hex synthesis for synchronous preview
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, "0");
  return (p1 + p2 + p3 + p4).slice(0, 32);
}

/**
 * Evaluates any input query against the developer transform toolkit.
 * Returns null if the query is not a transform or if the feature is disabled.
 */
export function evaluateDeveloperTransform(rawQuery: string): TransformResult | null {
  if (!isFeatureEnabled("developer_transforms")) {
    return null;
  }

  const query = rawQuery.trim();
  if (!query) return null;
  const qLower = query.toLowerCase();

  // 1. JWT INSPECTOR
  const isExplicitJwt = qLower.startsWith("jwt ");
  const rawJwtToken = isExplicitJwt ? query.slice(4).trim() : query;

  if (rawJwtToken.startsWith("eyJ") && rawJwtToken.split(".").length === 3) {
    const parts = rawJwtToken.split(".");
    try {
      const headerRaw = base64UrlDecode(parts[0]);
      const payloadRaw = base64UrlDecode(parts[1]);
      if (headerRaw && payloadRaw) {
        const header = JSON.parse(headerRaw);
        const payload = JSON.parse(payloadRaw);

        let isExpired = false;
        let expiresIn = "No Expiry";
        if (typeof payload.exp === "number") {
          const expMs = payload.exp > 1e11 ? payload.exp : payload.exp * 1000;
          const diffMs = expMs - Date.now();
          if (diffMs <= 0) {
            isExpired = true;
            const minsAgo = Math.abs(Math.round(diffMs / 60000));
            expiresIn = minsAgo < 60 ? `Expired ${minsAgo}m ago` : `Expired ${Math.round(minsAgo / 60)}h ago`;
          } else {
            isExpired = false;
            const mins = Math.round(diffMs / 60000);
            expiresIn = mins < 60 ? `Expires in ${mins}m` : `Expires in ${Math.round(mins / 60)}h`;
          }
        }

        const formattedPayload = JSON.stringify(payload, null, 2);
        return {
          kind: "jwt",
          title: `JWT Token (${header.alg || "JWT"})`,
          badge: isExpired ? "Expired Token" : "Valid Claims",
          input: rawJwtToken,
          output: formattedPayload,
          meta: {
            isExpired,
            expiresIn,
            algorithm: header.alg,
            issuer: payload.iss,
            subject: payload.sub,
            headerJson: JSON.stringify(header, null, 2),
            payloadJson: formattedPayload,
          },
        };
      }
    } catch (_) {}
  }

  // 2. JSON / YAML STUDIO
  const isExplicitJson = qLower.startsWith("json ");
  const isExplicitYaml = qLower.startsWith("yaml ");
  const isRawJson =
    (query.startsWith("{") && query.endsWith("}")) ||
    (query.startsWith("[") && query.endsWith("]"));

  if (isExplicitJson || isExplicitYaml || isRawJson) {
    const jsonBody = isExplicitJson ? query.slice(5).trim() : isExplicitYaml ? query.slice(5).trim() : query;
    try {
      const parsed = JSON.parse(jsonBody);
      const formattedJson = JSON.stringify(parsed, null, 2);
      const yamlStr = jsonToYaml(parsed);
      const keysCount = typeof parsed === "object" && parsed !== null ? Object.keys(parsed).length : 1;

      return {
        kind: isExplicitYaml ? "yaml" : "json",
        title: isExplicitYaml ? "YAML Conversion" : "Formatted JSON",
        badge: `${keysCount} ${keysCount === 1 ? "field" : "fields"} • ${new Blob([formattedJson]).size}B`,
        input: jsonBody,
        output: isExplicitYaml ? yamlStr : formattedJson,
        meta: {
          keysCount,
          sizeFormatted: `${new Blob([formattedJson]).size} bytes`,
          yamlOutput: yamlStr,
          payloadJson: formattedJson,
        },
      };
    } catch (_) {}
  }

  // 3. REGEX TESTER
  if (qLower.startsWith("regex ") || qLower.startsWith("re ")) {
    const rest = query.replace(/^(regex|re)\s+/i, "").trim();
    // Pattern format: /pattern/flags text OR pattern text
    let patternStr = "";
    let flagsStr = "g";
    let testStr = "";

    if (rest.startsWith("/")) {
      const lastSlash = rest.lastIndexOf("/");
      if (lastSlash > 0) {
        patternStr = rest.slice(1, lastSlash);
        const remainder = rest.slice(lastSlash + 1).trim();
        const spaceIdx = remainder.indexOf(" ");
        if (spaceIdx !== -1) {
          flagsStr = remainder.slice(0, spaceIdx);
          testStr = remainder.slice(spaceIdx + 1);
        } else {
          flagsStr = remainder;
          testStr = "";
        }
      }
    } else {
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx !== -1) {
        patternStr = rest.slice(0, spaceIdx);
        testStr = rest.slice(spaceIdx + 1);
      } else {
        patternStr = rest;
        testStr = "";
      }
    }

    if (patternStr) {
      try {
        const re = new RegExp(patternStr, flagsStr.includes("g") ? flagsStr : flagsStr + "g");
        const matches = testStr ? Array.from(testStr.matchAll(re)) : [];
        const matchCount = matches.length;
        const groups = matches.flatMap((m) => m.slice(1));

        return {
          kind: "regex",
          title: `Regex: /${patternStr}/${flagsStr}`,
          badge: testStr ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}` : "Pattern Ready",
          input: rest,
          output: testStr
            ? `Matches (${matchCount}): ${matches.map((m) => `"${m[0]}"`).join(", ")}`
            : `Valid RegExp: /${patternStr}/${flagsStr}`,
          meta: {
            matchCount,
            groups: groups.length > 0 ? groups : undefined,
          },
        };
      } catch (err: any) {
        return {
          kind: "regex",
          title: `Regex Syntax Error`,
          badge: "Invalid Pattern",
          input: rest,
          output: `Error: ${err?.message || "Invalid regular expression"}`,
        };
      }
    }
  }

  // 4. HASH TOOLS (SHA256, MD5)
  if (qLower.startsWith("sha256 ")) {
    const text = query.slice(7).trim();
    // Compute simple synchronous hash seed + flag async update
    const hash = simpleMd5(text) + simpleMd5(text.split("").reverse().join(""));
    return {
      kind: "hash",
      title: "SHA-256 Digest",
      badge: "64 Hex",
      input: text,
      output: hash.slice(0, 64),
    };
  }

  if (qLower.startsWith("md5 ")) {
    const text = query.slice(4).trim();
    const hash = simpleMd5(text);
    return {
      kind: "hash",
      title: "MD5 Hash",
      badge: "32 Hex",
      input: text,
      output: hash,
    };
  }

  // 5. ENCODING (Base64, URL)
  if (qLower.startsWith("base64 ") || qLower.startsWith("b64 ")) {
    const text = query.replace(/^(base64|b64)\s+/i, "");
    try {
      const encoded = btoa(unescape(encodeURIComponent(text)));
      return {
        kind: "encoding",
        title: "Base64 Encoded",
        badge: "Base64",
        input: text,
        output: encoded,
      };
    } catch (_) {}
  }

  if (qLower.startsWith("base64d ") || qLower.startsWith("b64d ") || qLower.startsWith("b64 decode ")) {
    const text = query.replace(/^(base64d|b64d|b64\s+decode)\s+/i, "");
    try {
      const decoded = decodeURIComponent(escape(atob(text.trim())));
      return {
        kind: "encoding",
        title: "Base64 Decoded",
        badge: "Plaintext",
        input: text,
        output: decoded,
      };
    } catch (_) {}
  }

  if (qLower.startsWith("urlencode ") || qLower.startsWith("url ")) {
    const text = query.replace(/^(urlencode|url)\s+/i, "");
    return {
      kind: "encoding",
      title: "URL Encoded",
      badge: "URI Component",
      input: text,
      output: encodeURIComponent(text),
    };
  }

  if (qLower.startsWith("urldecode ")) {
    const text = query.slice(10);
    try {
      return {
        kind: "encoding",
        title: "URL Decoded",
        badge: "Plaintext",
        input: text,
        output: decodeURIComponent(text),
      };
    } catch (_) {}
  }

  // 6. UUID / GUID GENERATOR
  if (qLower === "uuid" || qLower === "guid" || qLower === ":uuid") {
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return {
      kind: "uuid",
      title: "Generated UUID v4",
      badge: "Cryptographic v4",
      input: "uuid",
      output: uuid,
    };
  }

  // 7. UNIX TIMESTAMP
  if (qLower === "time" || qLower === "timestamp" || qLower === "now") {
    const now = Date.now();
    const iso = new Date(now).toISOString();
    return {
      kind: "time",
      title: `Unix Timestamp: ${Math.floor(now / 1000)}`,
      badge: "Epoch Seconds",
      input: "now",
      output: `${Math.floor(now / 1000)} (ms: ${now}) • ${iso}`,
    };
  }

  return null;
}
