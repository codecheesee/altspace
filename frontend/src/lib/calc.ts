export interface CalcResult {
  expression: string;
  result: string;
  type: "math" | "programmer" | "unit" | "system" | "date" | "currency";
  actionLabel?: string;
  systemAction?: string;
}

function safeEvalArithmetic(expr: string): number | null {
  // Replace ^ with ** and strip commas/spaces
  const src = expr.replace(/\s+/g, '').replace(/\^/g, '**').replace(/,/g, '');
  let pos = 0;

  const peek = () => src[pos] ?? '';
  const consume = () => src[pos++] ?? '';

  function parseNumber(): number | null {
    let s = '';
    if (peek() === '-' || peek() === '+') s += consume();
    while (pos < src.length && /[\d.]/.test(src[pos])) s += consume();
    if (!s || s === '-' || s === '+') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function parsePrimary(): number | null {
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      if (peek() !== ')') return null;
      consume();
      return val;
    }
    return parseNumber();
  }

  function parsePower(): number | null {
    let base = parsePrimary();
    if (base === null) return null;
    while (src.startsWith('**', pos)) {
      pos += 2;
      const exp = parsePrimary();
      if (exp === null) return null;
      base = Math.pow(base, exp);
      if (!isFinite(base)) return null;
    }
    return base;
  }

  function parseTerm(): number | null {
    let left = parsePower();
    if (left === null) return null;
    while (pos < src.length && (peek() === '*' || peek() === '/' || peek() === '%')) {
      // Check for ** (already handled by parsePower)
      if (peek() === '*' && src[pos + 1] === '*') break;
      const op = consume();
      const right = parsePower();
      if (right === null) return null;
      if (op === '*') left *= right;
      else if (op === '/') { if (right === 0) return null; left /= right; }
      else left %= right;
    }
    return left;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (pos < src.length && (peek() === '+' || peek() === '-')) {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  try {
    const result = parseExpr();
    if (pos !== src.length) return null; // unconsumed input = parse error
    if (result === null || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function getCachedCurrencyRates(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem('altspace_fx_rates_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; rates: Record<string, number> };
    // 4-hour TTL
    if (Date.now() - parsed.ts < 4 * 60 * 60 * 1000) return parsed.rates;
  } catch { /* ignore */ }
  return null;
}

export async function refreshCurrencyRates(): Promise<void> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return;
    const data = await res.json() as { rates: Record<string, number> };
    const supported = ['USD','EUR','GBP','INR','JPY','CAD','AUD','CHF'];
    const rates: Record<string, number> = { usd: 1.0 };
    for (const k of supported) {
      const v = data.rates[k];
      if (typeof v === 'number') rates[k.toLowerCase()] = v;
    }
    localStorage.setItem('altspace_fx_rates_v1', JSON.stringify({ ts: Date.now(), rates }));
  } catch { /* offline — use cached fallback */ }
}

export function evaluateSmartQuery(query: string): CalcResult | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const lower = trimmed.toLowerCase();

  // 1. System Commands
  if (lower === "lock" || lower === "lock pc" || lower === "lock screen") {
    return {
      expression: "Lock Workstation",
      result: "Lock Windows Screen immediately",
      type: "system",
      actionLabel: "Lock PC (Enter)",
      systemAction: "lock",
    };
  }

  if (lower === "empty trash" || lower === "empty recycle bin" || lower === "empty bin") {
    return {
      expression: "Empty Recycle Bin",
      result: "Permanently clean deleted files",
      type: "system",
      actionLabel: "Empty Bin (Enter)",
      systemAction: "empty_bin",
    };
  }

  if (lower === ":kill" || lower === "killall" || lower === "kill dev" || lower === "kill servers" || lower === "purge ports" || lower === ":ports") {
    return {
      expression: "Kill All Stray Dev Servers",
      result: "Terminate orphaned processes on 3000, 5173, 8080...",
      type: "system",
      actionLabel: "Purge All Servers (Enter)",
      systemAction: "kill_all_dev_servers",
    };
  }

  // 2. Natural Language Date Calculations (Raycast Soulver feature)
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  if (lower === "today" || lower === "date" || lower === "current date") {
    return {
      expression: "Today's Date",
      result: now.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  if (lower === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return {
      expression: "Tomorrow",
      result: d.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  if (lower === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return {
      expression: "Yesterday",
      result: d.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  // "in X days" or "X days from now" / "X days ago"
  const daysOffsetMatch = lower.match(/^(?:in\s+)?(\d+)\s+days?\s*(?:from\s+now|later)?$/i);
  if (daysOffsetMatch) {
    const count = parseInt(daysOffsetMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + count);
    return {
      expression: `In ${count} days`,
      result: d.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  const daysAgoMatch = lower.match(/^(\d+)\s+days?\s+ago$/i);
  if (daysAgoMatch) {
    const count = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - count);
    return {
      expression: `${count} days ago`,
      result: d.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  // "in X weeks" or "X weeks from now"
  const weeksOffsetMatch = lower.match(/^(?:in\s+)?(\d+)\s+weeks?\s*(?:from\s+now|later)?$/i);
  if (weeksOffsetMatch) {
    const count = parseInt(weeksOffsetMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + count * 7);
    return {
      expression: `In ${count} weeks`,
      result: d.toLocaleDateString("en-US", dateOptions),
      type: "date",
      actionLabel: "Copy Date (Enter)",
    };
  }

  // "days until new year" or "days until christmas"
  if (lower === "days until new year" || lower === "new year countdown") {
    const target = new Date(now.getFullYear() + 1, 0, 1);
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expression: "Days until New Year",
      result: `${diffDays} days remaining`,
      type: "date",
      actionLabel: "Copy (Enter)",
    };
  }

  if (lower === "days until christmas") {
    const currentYear = now.getFullYear();
    let target = new Date(currentYear, 11, 25);
    if (now.getTime() > target.getTime()) {
      target = new Date(currentYear + 1, 11, 25);
    }
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      expression: "Days until Christmas",
      result: `${diffDays} days remaining`,
      type: "date",
      actionLabel: "Copy (Enter)",
    };
  }

  // 3. Currency Conversion (Standard baseline rates)
  const currencyRates: Record<string, number> = getCachedCurrencyRates() || {
    usd: 1.0, eur: 0.92, gbp: 0.77, inr: 84.1,
    jpy: 152.4, cad: 1.38, aud: 1.51, chf: 0.86,
  };

  const currencySymbols: Record<string, string> = {
    usd: "$",
    eur: "€",
    gbp: "£",
    inr: "₹",
    jpy: "¥",
    cad: "CA$",
    aud: "A$",
    chf: "CHF ",
  };

  const currencyMatch = lower.match(/^([$€£₹¥]?\s*\d+(?:\.\d+)?)\s*([a-z]{3})\s*(?:to|in)\s*([a-z]{3})$/i);
  if (currencyMatch) {
    const numPart = parseFloat(currencyMatch[1].replace(/[$€£₹¥\s]/g, ""));
    const fromCur = currencyMatch[2].toLowerCase();
    const toCur = currencyMatch[3].toLowerCase();

    if (currencyRates[fromCur] && currencyRates[toCur]) {
      const inUSD = numPart / currencyRates[fromCur];
      const converted = inUSD * currencyRates[toCur];
      const symbol = currencySymbols[toCur] || "";
      return {
        expression: `${numPart} ${fromCur.toUpperCase()} to ${toCur.toUpperCase()}`,
        result: `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCur.toUpperCase()}`,
        type: "currency",
        actionLabel: "Copy Converted Currency (Enter)",
      };
    }
  }

  // 4. Digital Storage Unit Conversions (MB, GB, TB, KB)
  const dataMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)\s*(?:to|in)\s*(kb|mb|gb|tb)$/i);
  if (dataMatch) {
    const val = parseFloat(dataMatch[1]);
    const fromUnit = dataMatch[2].toLowerCase();
    const toUnit = dataMatch[3].toLowerCase();

    const unitFactors: Record<string, number> = {
      kb: 1 / 1024,
      mb: 1,
      gb: 1024,
      tb: 1024 * 1024,
    };

    if (unitFactors[fromUnit] && unitFactors[toUnit]) {
      const inMB = val * unitFactors[fromUnit];
      const result = inMB / unitFactors[toUnit];
      return {
        expression: `${val} ${fromUnit.toUpperCase()} to ${toUnit.toUpperCase()}`,
        result: `${result.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${toUnit.toUpperCase()}`,
        type: "unit",
        actionLabel: "Copy Result (Enter)",
      };
    }
  }

  // 5. Weight & Length Conversions
  const kgToLbs = lower.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\s*(?:to|in)?\s*(?:lbs?|pounds?)$/i);
  if (kgToLbs) {
    const kg = parseFloat(kgToLbs[1]);
    const lbs = kg * 2.20462;
    return {
      expression: `${kg} kg to Pounds`,
      result: `${lbs.toFixed(2)} lbs`,
      type: "unit",
      actionLabel: "Copy Pounds (Enter)",
    };
  }

  const lbsToKg = lower.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s*(?:to|in)?\s*(?:kg|kgs|kilograms?)$/i);
  if (lbsToKg) {
    const lbs = parseFloat(lbsToKg[1]);
    const kg = lbs / 2.20462;
    return {
      expression: `${lbs} lbs to Kilograms`,
      result: `${kg.toFixed(2)} kg`,
      type: "unit",
      actionLabel: "Copy Kilograms (Enter)",
    };
  }

  // 6. Percentage expressions: e.g. "15% of 200" or "20% off 500"
  const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:of|off)\s*(\d+(?:\.\d+)?)$/i);
  if (percentMatch) {
    const p = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const val = (p / 100) * total;
    return {
      expression: `${p}% of ${total}`,
      result: val.toLocaleString("en-US", { maximumFractionDigits: 4 }),
      type: "math",
      actionLabel: "Copy Answer (Enter)",
    };
  }

  // 7. Programmer Conversions: e.g. "0xff in dec", "255 in hex", "0b101 in dec"
  const hexToDec = trimmed.match(/^0x([0-9a-fA-F]+)\s*(?:in|to)?\s*(?:dec|decimal)?$/i);
  if (hexToDec) {
    const val = parseInt(hexToDec[1], 16);
    if (!isNaN(val)) {
      return {
        expression: `0x${hexToDec[1].toUpperCase()} in Decimal`,
        result: `${val} (0d${val})`,
        type: "programmer",
        actionLabel: "Copy Decimal (Enter)",
      };
    }
  }

  const decToHex = trimmed.match(/^(\d+)\s*(?:in|to)?\s*hex$/i);
  if (decToHex) {
    const val = parseInt(decToHex[1], 10);
    if (!isNaN(val)) {
      return {
        expression: `${val} in Hexadecimal`,
        result: `0x${val.toString(16).toUpperCase()}`,
        type: "programmer",
        actionLabel: "Copy Hex (Enter)",
      };
    }
  }

  const binToDec = trimmed.match(/^0b([01]+)\s*(?:in|to)?\s*(?:dec|decimal)?$/i);
  if (binToDec) {
    const val = parseInt(binToDec[1], 2);
    if (!isNaN(val)) {
      return {
        expression: `0b${binToDec[1]} in Decimal`,
        result: `${val}`,
        type: "programmer",
        actionLabel: "Copy Decimal (Enter)",
      };
    }
  }

  const decToBin = trimmed.match(/^(\d+)\s*(?:in|to)?\s*bin$/i);
  if (decToBin) {
    const val = parseInt(decToBin[1], 10);
    if (!isNaN(val)) {
      return {
        expression: `${val} in Binary`,
        result: `0b${val.toString(2)}`,
        type: "programmer",
        actionLabel: "Copy Binary (Enter)",
      };
    }
  }

  // 8. Temperature: e.g. "100 F to C", "37 C to F"
  const fToC = trimmed.match(/^([\d\.\-]+)\s*(?:f|fahrenheit)\s*(?:in|to)?\s*(?:c|celsius)$/i);
  if (fToC) {
    const f = parseFloat(fToC[1]);
    const c = ((f - 32) * 5) / 9;
    return {
      expression: `${f}°F to Celsius`,
      result: `${c.toFixed(2)} °C`,
      type: "unit",
      actionLabel: "Copy Celsius (Enter)",
    };
  }

  const cToF = trimmed.match(/^([\d\.\-]+)\s*(?:c|celsius)\s*(?:in|to)?\s*(?:f|fahrenheit)$/i);
  if (cToF) {
    const c = parseFloat(cToF[1]);
    const f = (c * 9) / 5 + 32;
    return {
      expression: `${c}°C to Fahrenheit`,
      result: `${f.toFixed(2)} °F`,
      type: "unit",
      actionLabel: "Copy Fahrenheit (Enter)",
    };
  }

  const milesToKm = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:miles|mi)\s*(?:in|to)?\s*km$/i);
  if (milesToKm) {
    const mi = parseFloat(milesToKm[1]);
    const km = mi * 1.60934;
    return {
      expression: `${mi} miles to Kilometers`,
      result: `${km.toFixed(2)} km`,
      type: "unit",
      actionLabel: "Copy Kilometers (Enter)",
    };
  }

  const kmToMiles = trimmed.match(/^(\d+(?:\.\d+)?)\s*km\s*(?:in|to)?\s*(?:miles|mi)$/i);
  if (kmToMiles) {
    const km = parseFloat(kmToMiles[1]);
    const mi = km / 1.60934;
    return {
      expression: `${km} km to Miles`,
      result: `${mi.toFixed(2)} miles`,
      type: "unit",
      actionLabel: "Copy Miles (Enter)",
    };
  }

  // 9. Mathematical Arithmetic Expression: safe recursive descent parser
  if (/^[\d\s\+\-\*\/\^\(\)\.\,\%]+$/.test(trimmed) && /[+\-*\/^%]/.test(trimmed)) {
    const val = safeEvalArithmetic(trimmed);
    if (val !== null) {
      return {
        expression: trimmed,
        result: val.toLocaleString("en-US", { maximumFractionDigits: 6 }),
        type: "math",
        actionLabel: "Copy Result (Enter)",
      };
    }
  }

  // 10. Math functions like sqrt(1024), abs(-42), round(3.14159)
  const mathFuncMatch = trimmed.match(/^(sqrt|abs|round|floor|ceil)\s*\(\s*([\d\.\-]+)\s*\)$/i);
  if (mathFuncMatch) {
    const fn = mathFuncMatch[1].toLowerCase();
    const arg = parseFloat(mathFuncMatch[2]);
    let val: number | null = null;
    if (fn === "sqrt") val = Math.sqrt(arg);
    else if (fn === "abs") val = Math.abs(arg);
    else if (fn === "round") val = Math.round(arg);
    else if (fn === "floor") val = Math.floor(arg);
    else if (fn === "ceil") val = Math.ceil(arg);

    if (val !== null && !isNaN(val) && isFinite(val)) {
      return {
        expression: `${fn}(${arg})`,
        result: val.toLocaleString("en-US", { maximumFractionDigits: 6 }),
        type: "math",
        actionLabel: "Copy Result (Enter)",
      };
    }
  }

  return null;
}
