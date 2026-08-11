import type { Account, InsightValue, MediaPost } from "./instagram.js";
import type { LikesSummary } from "./stats.js";
import { commentsOf, engagementOf, likesOf } from "./stats.js";

const HIDDEN = "hidden";

export function num(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US");
}

export function likeCell(post: MediaPost): string {
  const likes = likesOf(post);
  return likes === undefined ? HIDDEN : num(likes);
}

export function formatDate(timestamp: string | undefined): string {
  if (!timestamp) return "—";
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return timestamp;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function captionSnippet(caption: string | undefined, max = 58): string {
  if (!caption) return "(no caption)";
  const flat = caption.replace(/\s+/g, " ").trim();
  if (!flat) return "(no caption)";
  const escaped = flat.replace(/\|/g, "\\|").replace(/\]/g, "\\]");
  return escaped.length > max ? `${escaped.slice(0, max - 1)}…` : escaped;
}

function postLabel(post: MediaPost): string {
  const snippet = captionSnippet(post.caption);
  return post.permalink ? `[${snippet}](${post.permalink})` : snippet;
}

/** Maps the raw Graph API enum onto the words Instagram shows its users. */
export function prettyType(raw: string | undefined): string {
  switch (raw) {
    case "REELS":
      return "Reel";
    case "CAROUSEL_ALBUM":
      return "Carousel";
    case "VIDEO":
      return "Video";
    case "IMAGE":
      return "Image";
    case "UNKNOWN":
    case undefined:
      return "—";
    default:
      return raw;
  }
}

function typeLabel(post: MediaPost): string {
  if (post.media_product_type === "REELS") return "Reel";
  return prettyType(post.media_type);
}

export function formatPostTable(posts: readonly MediaPost[]): string {
  if (posts.length === 0) return "_No posts matched._";
  const rows = posts.map((post) => {
    const cells = [
      likeCell(post),
      num(commentsOf(post)),
      formatDate(post.timestamp),
      typeLabel(post),
      postLabel(post),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  return [
    "| Likes | Comments | Date | Type | Post |",
    "| ---: | ---: | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function formatAccount(account: Account): string {
  const lines = [
    `**@${account.username ?? "unknown"}**${account.name ? ` — ${account.name}` : ""}`,
    "",
    `- Instagram id: \`${account.user_id ?? account.id}\``,
  ];
  if (account.account_type) lines.push(`- Account type: ${account.account_type}`);
  if (account.media_count !== undefined) lines.push(`- Posts: ${num(account.media_count)}`);
  if (account.followers_count !== undefined) {
    lines.push(`- Followers: ${num(account.followers_count)}`);
  }
  if (account.follows_count !== undefined) {
    lines.push(`- Following: ${num(account.follows_count)}`);
  }
  return lines.join("\n");
}

export function formatInsights(
  values: readonly InsightValue[],
  unavailable?: string,
): string {
  const lines: string[] = [];
  if (values.length > 0) {
    lines.push("**Insights**", "");
    for (const value of values) {
      lines.push(`- ${value.title ?? value.name}: ${num(value.value)}`);
    }
  }
  if (unavailable) {
    lines.push(
      "",
      `_Some insight metrics were unavailable: ${unavailable}_`,
    );
  }
  return lines.join("\n");
}

export function formatPostDetail(
  post: MediaPost,
  insights?: { values: InsightValue[]; unavailable?: string },
): string {
  const likes = likesOf(post);
  const lines = [
    `**${captionSnippet(post.caption, 90)}**`,
    "",
    `- Likes: ${likes === undefined ? `${HIDDEN} (the account hides like counts on this post)` : num(likes)}`,
    `- Comments: ${num(commentsOf(post))}`,
    `- Total engagement: ${num(engagementOf(post))}`,
    `- Posted: ${formatDate(post.timestamp)}`,
    `- Type: ${typeLabel(post)}`,
    `- Media id: \`${post.id}\``,
  ];
  if (post.permalink) lines.push(`- Link: ${post.permalink}`);
  if (insights && (insights.values.length > 0 || insights.unavailable)) {
    lines.push("", formatInsights(insights.values, insights.unavailable));
  }
  return lines.join("\n");
}

export function formatSummary(summary: LikesSummary, account?: Account): string {
  if (summary.analyzed === 0) {
    return "_No posts found in that window._";
  }

  const who = account?.username ? `@${account.username}` : "your account";
  const lines = [
    `**Likes summary for ${who}** — ${summary.analyzed} post${summary.analyzed === 1 ? "" : "s"}` +
      (summary.oldest && summary.newest
        ? ` from ${formatDate(summary.oldest)} to ${formatDate(summary.newest)}`
        : ""),
    "",
    `- **Total likes: ${num(summary.totalLikes)}**`,
    `- Average per post: ${num(summary.averageLikes)}`,
    `- Median per post: ${num(summary.medianLikes)}`,
    `- Total comments: ${num(summary.totalComments)} (avg ${num(summary.averageComments)})`,
  ];

  if (summary.engagementRatePercent !== undefined) {
    lines.push(
      `- Engagement rate: ${summary.engagementRatePercent}% of ${num(account?.followers_count)} followers per post`,
    );
  }

  if (summary.trend) {
    const { changePercent, recentAverage, priorAverage } = summary.trend;
    const direction = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
    lines.push(
      `- Trend: ${direction} ${Math.abs(changePercent)}% — newer half averages ${num(recentAverage)} likes vs ${num(priorAverage)} for the older half`,
    );
  }

  if (summary.hiddenLikeCounts > 0) {
    lines.push(
      `- ${summary.hiddenLikeCounts} post${summary.hiddenLikeCounts === 1 ? "" : "s"} hid like counts and ${summary.hiddenLikeCounts === 1 ? "was" : "were"} left out of the like averages`,
    );
  }

  if (summary.best) {
    lines.push(
      "",
      `**Most liked** — ${num(likesOf(summary.best))} likes, ${formatDate(summary.best.timestamp)}`,
      `${postLabel(summary.best)}`,
    );
  }
  if (summary.worst && summary.worst.id !== summary.best?.id) {
    lines.push(
      "",
      `**Least liked** — ${num(likesOf(summary.worst))} likes, ${formatDate(summary.worst.timestamp)}`,
      `${postLabel(summary.worst)}`,
    );
  }

  if (summary.byType.length > 1) {
    lines.push("", "**By format**", "");
    lines.push("| Format | Posts | Total likes | Avg likes |", "| --- | ---: | ---: | ---: |");
    for (const bucket of summary.byType) {
      lines.push(
        `| ${prettyType(bucket.type)} | ${num(bucket.count)} | ${num(bucket.totalLikes)} | ${num(bucket.averageLikes)} |`,
      );
    }
  }

  return lines.join("\n");
}
