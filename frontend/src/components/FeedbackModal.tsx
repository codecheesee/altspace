import { cn } from "../lib/utils";
import { useState, useEffect, useRef } from "react";
import { Star, MessageSquare, Send, Heart, X, ExternalLink, ThumbsUp, Settings, History, Copy, Check } from "lucide-react";
import { tauriInvoke } from "../lib/appStorage";
import { getCurrentSession } from "../lib/authProvider";
import {
  DISCORD_WEBHOOK_URL,
  GITHUB_REPO_URL,
  GITHUB_DISCUSSIONS_URL,
  GITHUB_ISSUES_URL,
  GITHUB_CONTRIBUTING_URL,
} from "../feedbackConfig";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme?: {
    cardBg: string;
    borderColor: string;
    accentHex: string;
  };
  notify: (msg: string) => void;
}

type FeedbackType = "rating" | "feature" | "bug" | "contribute";

interface StoredFeedback {
  stars: number;
  type: FeedbackType;
  comment: string;
  contact: string;
  timestamp: string;
  platform: string;
}

const STAR_LABELS = [
  "",
  "Needs work",
  "Rough edges",
  "Good start",
  "Great launcher!",
  "Daily driver",
];

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function FeedbackModal({
  isOpen,
  onClose,
  activeTheme = {
    cardBg: "#0c0c0e",
    borderColor: "rgba(255, 255, 255, 0.08)",
    accentHex: "#ff6363",
  },
  notify,
}: FeedbackModalProps) {
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [type, setType] = useState<FeedbackType>("rating");
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState(() => {
    const s = getCurrentSession();
    return s?.login ? `@${s.login}` : "";
  });
  const [activeTab, setActiveTab] = useState<"write" | "history">("write");
  const [submitted, setSubmitted] = useState(false);
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState(() => {
    return localStorage.getItem("altspace_feedback_webhook") || DISCORD_WEBHOOK_URL;
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load past feedbacks from localStorage
  const getStoredFeedback = (): StoredFeedback[] => {
    try {
      return JSON.parse(localStorage.getItem("altspace_user_feedback") || "[]");
    } catch (_) {
      return [];
    }
  };

  const [historyList, setHistoryList] = useState<StoredFeedback[]>([]);

  // Keydown and auto-focus lifecycle
  useEffect(() => {
    if (!isOpen) return;

    if (tauriInvoke) {
      tauriInvoke("focus_window").catch(() => {});
    }

    setHistoryList(getStoredFeedback());

    // Auto-focus comment area when in write mode
    if (activeTab === "write") {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeStarCount = hoverStars || stars;

  const handleOpenUrl = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url });
    } else {
      window.open(url, "_blank");
    }
  };

  const handleSaveWebhook = () => {
    localStorage.setItem("altspace_feedback_webhook", webhookInput.trim());
    setShowWebhookConfig(false);
    notify("Discord Webhook saved!");
  };

  const buildGitHubUrl = (item: { type: FeedbackType; comment: string; stars: number; contact?: string }) => {
    const titlePrefix =
      item.type === "bug"
        ? "[Bug]: "
        : item.type === "feature"
        ? "[Feature]: "
        : item.type === "contribute"
        ? "[Contributor]: "
        : "[Feedback]: ";

    const summary = item.comment.split("\n")[0].slice(0, 50).trim() || `${item.stars}-star review`;
    const title = encodeURIComponent(`${titlePrefix}${summary}`);

    const bodyText = `### Feedback & Rating Report
- **Rating**: ${"⭐".repeat(item.stars)} (${item.stars}/5)
- **Category**: ${item.type}
- **Submitted by**: ${item.contact || "AltSpace User"}
- **OS**: Windows (AltSpace Desktop)

---
### Details
${item.comment || "No detailed notes provided."}
`;

    const labels =
      item.type === "bug"
        ? "bug,user-feedback"
        : item.type === "feature"
        ? (item.stars >= 4 ? "enhancement,community-request,bounty-candidate" : "enhancement,community-request")
        : "user-feedback";

    const body = encodeURIComponent(bodyText);
    return `${GITHUB_ISSUES_URL}/new?title=${title}&body=${body}&labels=${encodeURIComponent(labels)}`;
  };

  const handleDirectSubmit = async () => {
    if (!comment.trim() && stars === 0) {
      notify("Please pick a star rating or leave a comment.");
      return;
    }

    const payload: StoredFeedback = {
      stars,
      type,
      comment: comment.trim(),
      contact: contact.trim() || "Anonymous",
      timestamp: new Date().toISOString(),
      platform: "Windows (AltSpace Desktop)",
    };

    // 1. Store in local feedback collection
    try {
      const stored = getStoredFeedback();
      stored.unshift(payload);
      localStorage.setItem("altspace_user_feedback", JSON.stringify(stored.slice(0, 50)));
      localStorage.setItem("altspace_has_rated", "true");
      setHistoryList(stored);
    } catch (_) {}

    // 2. Dispatch to Discord Webhook if configured
    const targetWebhook = webhookInput.trim() || DISCORD_WEBHOOK_URL;
    if (targetWebhook && targetWebhook.startsWith("https://discord.com/api/webhooks/")) {
      try {
        const color = stars >= 4 ? 0x10b981 : stars === 3 ? 0xf59e0b : 0xef4444;
        await fetch(targetWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: `New User Feedback: ${type.toUpperCase()}`,
                color,
                fields: [
                  {
                    name: "Rating",
                    value: `${"⭐".repeat(stars || 1)} (${stars}/5)`,
                    inline: true,
                  },
                  {
                    name: "Category",
                    value: type,
                    inline: true,
                  },
                  {
                    name: "User / Contact",
                    value: payload.contact,
                    inline: true,
                  },
                  {
                    name: "Feedback / Notes",
                    value: comment || "*(No detailed comments provided)*",
                  },
                ],
                footer: {
                  text: "AltSpace Desktop • Windows",
                },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (err) {
        console.warn("[Feedback] Webhook delivery failed:", err);
      }
    }

    setSubmitted(true);
    notify("Feedback saved to your local history! ⭐");
  };

  const handlePostGitHubIssue = () => {
    const url = buildGitHubUrl({ type, comment, stars, contact });
    handleOpenUrl(url);
    localStorage.setItem("altspace_has_rated", "true");
    onClose();
    notify("Opened labeled GitHub Issue draft in browser!");
  };

  const handleCopyPastFeedback = (entry: StoredFeedback, idx: number) => {
    const text = `Feedback (${entry.type}) - ${entry.stars} Stars\n${entry.comment}\nDate: ${new Date(entry.timestamp).toLocaleString()}`;
    navigator.clipboard.writeText(text);
    setCopiedId(String(idx));
    setTimeout(() => setCopiedId(null), 1500);
    notify("Copied feedback to clipboard!");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[470px] rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col text-zinc-100 animate-in zoom-in-95 duration-100 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - Fixed */}
        <div className="p-4 pb-2.5 border-b border-white/[0.06] shrink-0 bg-[#0e0e11] relative">
          {/* Top Controls */}
          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
            <button
              onClick={() => setShowWebhookConfig((prev) => !prev)}
              className={cn(
                "p-1.5 rounded-lg transition cursor-pointer",
                showWebhookConfig ? "bg-white/[0.12] text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.08]"
              )}
              title="Configure Private Webhook"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="pr-16">
            <div className="flex items-center gap-2">
              <Heart
                className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0"
                style={{ color: activeTheme.accentHex, fill: activeTheme.accentHex }}
              />
              <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                Community Feedback & Issue Tracker
              </h2>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Rate AltSpace, request features, or report issues directly to maintainers.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => { setActiveTab("write"); setSubmitted(false); }}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition cursor-pointer ${
                activeTab === "write"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Write Feedback
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition cursor-pointer ${
                activeTab === "history"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Past Submissions ({historyList.length})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {showWebhookConfig && (
          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] flex flex-col gap-2 animate-in fade-in">
            <span className="text-xs font-semibold text-zinc-200">
              Private Discord / Slack Webhook URL:
            </span>
            <input
              type="text"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-zinc-900 border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowWebhookConfig(false)}
                className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWebhook}
                className="text-[11px] px-2.5 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-medium cursor-pointer"
              >
                Save Webhook
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Past Submissions */}
        {activeTab === "history" && (
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {historyList.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
                <History className="w-8 h-8 mx-auto text-zinc-600" />
                <div>No past feedback found on this device.</div>
                <div className="text-[11px] text-zinc-600">Submissions are saved locally in your app storage.</div>
              </div>
            ) : (
              historyList.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-2 hover:border-white/[0.15] transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-mono text-[11px]">
                        {"⭐".repeat(entry.stars || 1)} ({entry.stars}/5)
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {entry.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                    {entry.comment || "*(No notes provided)*"}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px]">
                    <span className="text-zinc-500 text-[10px]">
                      Saved locally • {entry.contact}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyPastFeedback(entry, idx)}
                        className="flex items-center gap-1 text-zinc-400 hover:text-white transition cursor-pointer text-[10px]"
                        title="Copy to clipboard"
                      >
                        {copiedId === String(idx) ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === String(idx) ? "Copied" : "Copy"}</span>
                      </button>

                      <button
                        onClick={() => handleOpenUrl(buildGitHubUrl(entry))}
                        className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition cursor-pointer text-[10px] font-medium"
                        title="Post as public issue on GitHub"
                      >
                        <GithubIcon className="w-3 h-3" />
                        <span>Publish to GitHub &rarr;</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Write Feedback */}
        {activeTab === "write" && (
          <>
            {submitted ? (
              <div className="py-6 text-center flex flex-col items-center justify-center gap-3 animate-in zoom-in-95">
                <ThumbsUp className="w-9 h-9 text-emerald-400 animate-bounce" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Feedback Recorded in Local History!</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Your feedback is saved in your local app storage. To have maintainers and bounty contributors track it publicly, publish it as a GitHub Issue below:
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePostGitHubIssue}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-black text-xs font-semibold transition cursor-pointer shadow-md"
                  >
                    <GithubIcon className="w-4 h-4" />
                    <span>Publish to GitHub Issues &rarr;</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSubmitted(false); onClose(); }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1-5 Star Rating */}
                <div className="flex flex-col items-center gap-1.5 py-0.5">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setStars(star)}
                        onMouseEnter={() => setHoverStars(star)}
                        onMouseLeave={() => setHoverStars(0)}
                        className="p-1 rounded-md transition hover:scale-110 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            star <= activeStarCount
                              ? "text-amber-400 fill-amber-400"
                              : "text-zinc-700 hover:text-zinc-500"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono text-zinc-400 h-4">
                    {STAR_LABELS[activeStarCount]}
                  </span>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                  {[
                    { id: "rating", label: "Review" },
                    { id: "feature", label: "Feature" },
                    { id: "bug", label: "Bug" },
                    { id: "contribute", label: "Contribute" },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setType(pill.id as FeedbackType)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg transition font-medium border cursor-pointer ${
                        type === pill.id
                          ? "bg-zinc-800 text-white border-zinc-700 shadow-sm"
                          : "bg-transparent text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Feedback Textarea with Keydown Isolation */}
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    // Prevent any keystrokes from leaking to parent search omnibar or triggering QuickLook
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onClose();
                    }
                  }}
                  placeholder={
                    type === "bug"
                      ? "Describe what happened, error message, or steps to reproduce..."
                      : type === "feature"
                      ? "Describe your feature idea or command you'd love to see..."
                      : type === "contribute"
                      ? "Tell us what you'd like to help build (Rust, React, plugins, docs)..."
                      : "What do you like? What could be faster or better?"
                  }
                  rows={3}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none select-text"
                />

                {/* Optional contact input */}
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onClose();
                    }
                  }}
                  placeholder="Your GitHub username or contact handle (optional)"
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 select-text"
                />

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDirectSubmit}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition cursor-pointer border border-zinc-700 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Save to History</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePostGitHubIssue}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-white text-black text-xs font-semibold transition cursor-pointer shadow-sm"
                    title="Publish directly as a GitHub Issue in browser"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    <span>Post on GitHub &rarr;</span>
                  </button>
                </div>

                {/* Community Links */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
                  <button
                    onClick={() => handleOpenUrl(GITHUB_REPO_URL)}
                    className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                  >
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>Star on GitHub</span>
                  </button>

                  <button
                    onClick={() => handleOpenUrl(GITHUB_DISCUSSIONS_URL)}
                    className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Discussions</span>
                  </button>

                  <button
                    onClick={() => handleOpenUrl(GITHUB_CONTRIBUTING_URL)}
                    className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Contributing Guide</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
