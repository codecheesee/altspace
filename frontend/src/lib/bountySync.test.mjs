import { test } from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of parseBountyFromIssue and calculateTreasuryStats
function parseBountyFromIssue(issue) {
  if (!issue || !issue.title) return null;

  let amount = 2500;
  const textToScan = `${issue.title} ${issue.body || ""}`;

  const inrMatch = textToScan.match(/(?:₹|inr\s*)\s*([\d,]+)/i);
  const usdMatch = textToScan.match(/(?:\$|usd\s*)\s*([\d,]+)/i);

  if (inrMatch) {
    const parsed = parseInt(inrMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  } else if (usdMatch) {
    const parsed = parseInt(usdMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) amount = parsed * 83;
  }

  const cleanTitle = issue.title.replace(/\[bounty[^\]]*\]\s*:?\s*/i, "").trim();

  let status = "Open";
  if (issue.state === "closed") {
    status = "Completed";
  } else if (issue.assignee || (issue.assignees && issue.assignees.length > 0)) {
    status = "Claimed";
  }

  const assignee = issue.assignee?.login || (issue.assignees && issue.assignees[0]?.login);
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

function calculateTreasuryStats(bounties) {
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

test('parseBountyFromIssue correctly extracts INR bounty and clean title', () => {
  const mockIssue = {
    id: 101,
    number: 42,
    title: '[Bounty ₹3,500]: Bluetooth Device Switcher',
    body: 'Allow switching audio output to paired Bluetooth devices in 1 click.',
    state: 'open',
    assignee: null,
    html_url: 'https://github.com/codecheesee/altspace/issues/42',
  };

  const parsed = parseBountyFromIssue(mockIssue);
  assert.notEqual(parsed, null);
  assert.equal(parsed.title, 'Bluetooth Device Switcher');
  assert.equal(parsed.bountyAmountINR, 3500);
  assert.equal(parsed.status, 'Open');
  assert.equal(parsed.assignee, undefined);
  assert.equal(parsed.githubIssueUrl, 'https://github.com/codecheesee/altspace/issues/42');
});

test('parseBountyFromIssue handles USD bounties and converts to INR', () => {
  const mockIssue = {
    id: 102,
    number: 56,
    title: '[Bounty: $30] Spotify Mini-Player',
    body: 'Bounty: $30. Adds playback control and lyrics search in spotlight.',
    state: 'open',
    assignee: { login: 'sarahchen' },
    html_url: 'https://github.com/codecheesee/altspace/issues/56',
  };

  const parsed = parseBountyFromIssue(mockIssue);
  assert.notEqual(parsed, null);
  assert.equal(parsed.title, 'Spotify Mini-Player');
  assert.equal(parsed.bountyAmountINR, 30 * 83); // 2490
  assert.equal(parsed.status, 'Claimed');
  assert.equal(parsed.assignee, 'sarahchen');
});

test('parseBountyFromIssue recognizes closed state as Completed', () => {
  const mockIssue = {
    id: 103,
    number: 73,
    title: 'Docker Live Metrics [Bounty ₹2,500]',
    body: 'Live container CPU/RAM stats.',
    state: 'closed',
    assignee: { login: 'elenarostova' },
    html_url: 'https://github.com/codecheesee/altspace/issues/73',
  };

  const parsed = parseBountyFromIssue(mockIssue);
  assert.notEqual(parsed, null);
  assert.equal(parsed.status, 'Completed');
  assert.equal(parsed.assignee, 'elenarostova');
  assert.equal(parsed.bountyAmountINR, 2500);
});

test('calculateTreasuryStats calculates aggregate metrics correctly', () => {
  const mockBounties = [
    {
      id: '1',
      title: 'Task A',
      description: 'Desc',
      bountyAmountINR: 3000,
      status: 'Completed',
      githubIssueUrl: '',
    },
    {
      id: '2',
      title: 'Task B',
      description: 'Desc',
      bountyAmountINR: 2500,
      status: 'Claimed',
      githubIssueUrl: '',
    },
    {
      id: '3',
      title: 'Task C',
      description: 'Desc',
      bountyAmountINR: 2000,
      status: 'Open',
      githubIssueUrl: '',
    },
  ];

  const stats = calculateTreasuryStats(mockBounties);
  assert.equal(stats.totalBountiesCount, 3);
  assert.equal(stats.openBountiesCount, 1);
  assert.equal(stats.completedBountiesCount, 1);
  assert.equal(stats.totalFundedINR, 7500);
  assert.equal(stats.totalPaidOutINR, 3000);
});
