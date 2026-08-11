import type { MediaPost } from "./instagram.js";

export type RankMetric = "likes" | "comments" | "engagement";

export interface TypeBreakdown {
  type: string;
  count: number;
  totalLikes: number;
  averageLikes: number;
}

export interface Trend {
  recentAverage: number;
  priorAverage: number;
  /** Percent change of the newer half against the older half. */
  changePercent: number;
}

export interface LikesSummary {
  analyzed: number;
  /** Posts whose like_count the API withheld (owner hides like counts). */
  hiddenLikeCounts: number;
  countedForLikes: number;
  oldest?: string;
  newest?: string;
  totalLikes: number;
  totalComments: number;
  averageLikes: number;
  medianLikes: number;
  averageComments: number;
  best?: MediaPost;
  worst?: MediaPost;
  byType: TypeBreakdown[];
  trend?: Trend;
  /** (likes + comments) / followers, averaged per post. Needs follower count. */
  engagementRatePercent?: number;
}

export function likesOf(post: MediaPost): number | undefined {
  return typeof post.like_count === "number" ? post.like_count : undefined;
}

export function commentsOf(post: MediaPost): number {
  return typeof post.comments_count === "number" ? post.comments_count : 0;
}

export function engagementOf(post: MediaPost): number {
  return (likesOf(post) ?? 0) + commentsOf(post);
}

export function metricOf(post: MediaPost, metric: RankMetric): number {
  if (metric === "likes") return likesOf(post) ?? 0;
  if (metric === "comments") return commentsOf(post);
  return engagementOf(post);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Newest first, matching the order the media edge returns. */
export function rankPosts(
  posts: readonly MediaPost[],
  metric: RankMetric,
  limit?: number,
): MediaPost[] {
  const sorted = [...posts].sort((a, b) => {
    const diff = metricOf(b, metric) - metricOf(a, metric);
    if (diff !== 0) return diff;
    // Stable tiebreak: newer first.
    return Date.parse(b.timestamp ?? "") - Date.parse(a.timestamp ?? "");
  });
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

function breakdownByType(posts: readonly MediaPost[]): TypeBreakdown[] {
  const buckets = new Map<string, { count: number; totalLikes: number; counted: number }>();
  for (const post of posts) {
    // REELS is a product type, not a media type, but it is what people mean.
    const key =
      post.media_product_type === "REELS" ? "REELS" : (post.media_type ?? "UNKNOWN");
    const bucket = buckets.get(key) ?? { count: 0, totalLikes: 0, counted: 0 };
    bucket.count += 1;
    const likes = likesOf(post);
    if (likes !== undefined) {
      bucket.totalLikes += likes;
      bucket.counted += 1;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([type, bucket]) => ({
      type,
      count: bucket.count,
      totalLikes: bucket.totalLikes,
      averageLikes: bucket.counted > 0 ? round(bucket.totalLikes / bucket.counted) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Compares the newer half of the window against the older half. */
function computeTrend(posts: readonly MediaPost[]): Trend | undefined {
  const withLikes = posts.filter((post) => likesOf(post) !== undefined);
  if (withLikes.length < 4) return undefined;
  const half = Math.floor(withLikes.length / 2);
  const recent = withLikes.slice(0, half);
  const prior = withLikes.slice(withLikes.length - half);
  const average = (group: readonly MediaPost[]): number =>
    group.reduce((sum, post) => sum + (likesOf(post) ?? 0), 0) / group.length;
  const recentAverage = average(recent);
  const priorAverage = average(prior);
  const changePercent =
    priorAverage === 0
      ? recentAverage === 0
        ? 0
        : 100
      : ((recentAverage - priorAverage) / priorAverage) * 100;
  return {
    recentAverage: round(recentAverage),
    priorAverage: round(priorAverage),
    changePercent: round(changePercent),
  };
}

export function summarize(
  posts: readonly MediaPost[],
  options: { followersCount?: number } = {},
): LikesSummary {
  const withLikes = posts.filter((post) => likesOf(post) !== undefined);
  const likeValues = withLikes.map((post) => likesOf(post) ?? 0);
  const totalLikes = likeValues.reduce((sum, value) => sum + value, 0);
  const totalComments = posts.reduce((sum, post) => sum + commentsOf(post), 0);

  const timestamps = posts
    .map((post) => post.timestamp)
    .filter((value): value is string => Boolean(value))
    .sort();

  const ranked = rankPosts(withLikes, "likes");

  const summary: LikesSummary = {
    analyzed: posts.length,
    hiddenLikeCounts: posts.length - withLikes.length,
    countedForLikes: withLikes.length,
    oldest: timestamps[0],
    newest: timestamps[timestamps.length - 1],
    totalLikes,
    totalComments,
    averageLikes: withLikes.length > 0 ? round(totalLikes / withLikes.length) : 0,
    medianLikes: median(likeValues),
    averageComments: posts.length > 0 ? round(totalComments / posts.length) : 0,
    best: ranked[0],
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : undefined,
    byType: breakdownByType(posts),
    trend: computeTrend(posts),
  };

  if (options.followersCount && options.followersCount > 0 && posts.length > 0) {
    const totalEngagement = totalLikes + totalComments;
    const perPost = totalEngagement / posts.length;
    summary.engagementRatePercent = round((perPost / options.followersCount) * 100, 2);
  }

  return summary;
}
