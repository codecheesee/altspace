/**
 * AltSpace Dynamic GitHub Bounty Syncing Engine
 * Connects directly to GitHub REST API with Stale-While-Revalidate (SWR) caching,
 * automated bounty extraction from issue titles/bodies, and live Treasury analytics.
 */

import { ACTIVE_BOUNTIES, type FeatureBounty } from "./license";

export const GITHUB_BOUNTIES_API =
  "https://api.github.com/repos/codecheesee/altspace/issues?labels=bounty&state=all&per_page=30";
const BOUNTIES_CACHE_KEY = "altspace_live_bounties_cache_v1";

export interface TreasuryStats {
  totalBountiesCount: number;
  openBountiesCount: number;
  completedBountiesCount: number;
  totalFundedINR: number;
  totalPaidOutINR: number;
}

/**
 * Parses a GitHub Issue object and extracts the bounty metadata
 */
export function parseBountyFromIssue(issue: any): FeatureBounty | null {
  if (!issue || !issue.title) return null;

  // Extract bounty amount in INR or USD
  let amount = 2500; // default standard tier
  const textToScan = `${issue.title} ${issue.body || ""}`;

  const inrMatch = textToScan.match(/(?:₹|inr\s*)\s*([\d,]+)/i);
  const usdMatch = textToScan.match(/(?:\$|usd\s*)\s*([\d,]+)/i);

  if (inrMatch) {
    const parsed = parseInt(inrMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  } else if (usdMatch) {
    const parsed = parseInt(usdMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) amount = parsed * 83; // approx USD to INR rate
  }

  // Clean title (strip "[Bounty: ...]" prefix for clean display)
  const cleanTitle = issue.title.replace(/\[bounty[^\]]*\]\s*:?\s*/i, "").trim();

  let status: "Open" | "Claimed" | "Completed" = "Open";
  if (issue.state === "closed") {
    status = "Completed";
  } else if (issue.assignee || (issue.assignees && issue.assignees.length > 0)) {
    status = "Claimed";
  }

  const assignee = issue.assignee?.login || (issue.assignees && issue.assignees[0]?.login);

  // Clean description snippet
  const rawBody = (issue.body || "Community proposed feature bounty.").replace(/\r?\n/g, " ");
  const description = rawBody.slice(0, 160).trim();

  return {
    id: `gh-${issue.id || issue.number}`,
    title: cleanTitle || issue.title,
    description: description.length >= 160 ? `${description}...` : description,
    bountyAmountINR: amount,
    status,
    assignee,
    githubIssueUrl:
      issue.html_url || `https://github.com/codecheesee/altspace/issues/${issue.number}`,
  };
}

/**
 * Fetches bounties with Stale-While-Revalidate (SWR):
 * Returns cached/embedded immediately, then updates in the background.
 */
export async function fetchLiveBounties(): Promise<FeatureBounty[]> {
  let cached: FeatureBounty[] = ACTIVE_BOUNTIES;

  try {
    const raw = localStorage.getItem(BOUNTIES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cached = parsed;
      }
    }
  } catch (_) {}

  // Background fetch fresh bounties from GitHub
  fetchGitHubBounties()
    .then((fresh) => {
      if (fresh && fresh.length > 0) {
        try {
          localStorage.setItem(BOUNTIES_CACHE_KEY, JSON.stringify(fresh));
        } catch (_) {}
      }
    })
    .catch(() => {});

  return cached;
}

/**
 * Queries the public GitHub REST API with a 3.5s timeout
 */
export async function fetchGitHubBounties(): Promise<FeatureBounty[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(GITHUB_BOUNTIES_API, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const issues = await res.json();
      if (Array.isArray(issues) && issues.length > 0) {
        const parsedList: FeatureBounty[] = [];
        for (const issue of issues) {
          const parsed = parseBountyFromIssue(issue);
          if (parsed) parsedList.push(parsed);
        }
        if (parsedList.length > 0) return parsedList;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Computes live treasury metrics across all feature bounties
 */
export function calculateTreasuryStats(bounties: FeatureBounty[]): TreasuryStats {
  const totalBountiesCount = bounties.length;
  const openBountiesCount = bounties.filter((b) => b.status === "Open").length;
  const completedBountiesCount = bounties.filter((b) => b.status === "Completed").length;

  const totalFundedINR = bounties.reduce((sum, b) => sum + b.bountyAmountINR, 0);
  const totalPaidOutINR = bounties
    .filter((b) => b.status === "Completed")
    .reduce((sum, b) => sum + b.bountyAmountINR, 0);

  return {
    totalBountiesCount,
    openBountiesCount,
    completedBountiesCount,
    totalFundedINR,
    totalPaidOutINR,
  };
}
