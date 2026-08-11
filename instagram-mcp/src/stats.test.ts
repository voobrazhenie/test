import assert from "node:assert/strict";
import { test } from "node:test";

import type { MediaPost } from "./instagram.js";
import { median, rankPosts, round, summarize } from "./stats.js";

function post(overrides: Partial<MediaPost> & { id: string }): MediaPost {
  return {
    media_type: "IMAGE",
    timestamp: "2026-01-01T12:00:00+0000",
    like_count: 0,
    comments_count: 0,
    ...overrides,
  };
}

/** Newest first, matching the order Instagram's media edge returns. */
const feed: MediaPost[] = [
  post({ id: "5", like_count: 300, comments_count: 10, timestamp: "2026-05-01T12:00:00+0000" }),
  post({ id: "4", like_count: 200, comments_count: 40, timestamp: "2026-04-01T12:00:00+0000", media_type: "VIDEO", media_product_type: "REELS" }),
  post({ id: "3", like_count: 100, comments_count: 5, timestamp: "2026-03-01T12:00:00+0000" }),
  post({ id: "2", like_count: 50, comments_count: 1, timestamp: "2026-02-01T12:00:00+0000", media_type: "CAROUSEL_ALBUM" }),
];

test("median handles odd and even counts", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), 0);
});

test("round trims to the requested precision", () => {
  assert.equal(round(1.2345), 1.2);
  assert.equal(round(1.2345, 2), 1.23);
});

test("summarize totals likes and comments across the window", () => {
  const summary = summarize(feed);
  assert.equal(summary.analyzed, 4);
  assert.equal(summary.totalLikes, 650);
  assert.equal(summary.totalComments, 56);
  assert.equal(summary.averageLikes, 162.5);
  assert.equal(summary.medianLikes, 150);
  assert.equal(summary.averageComments, 14);
});

test("summarize picks the most and least liked posts", () => {
  const summary = summarize(feed);
  assert.equal(summary.best?.id, "5");
  assert.equal(summary.worst?.id, "2");
});

test("posts with hidden like counts are excluded from like averages but still counted", () => {
  const withHidden = [...feed, post({ id: "1", like_count: undefined, comments_count: 3 })];
  const summary = summarize(withHidden);
  assert.equal(summary.analyzed, 5);
  assert.equal(summary.hiddenLikeCounts, 1);
  assert.equal(summary.countedForLikes, 4);
  // Average is over the 4 posts that reported likes, not all 5.
  assert.equal(summary.averageLikes, 162.5);
  // Comments still count for every post.
  assert.equal(summary.totalComments, 59);
});

test("summarize reports the newer half against the older half", () => {
  const summary = summarize(feed);
  // Newer half: 300, 200 (avg 250). Older half: 100, 50 (avg 75).
  assert.equal(summary.trend?.recentAverage, 250);
  assert.equal(summary.trend?.priorAverage, 75);
  assert.equal(summary.trend?.changePercent, 233.3);
});

test("trend is omitted when there are too few posts to compare", () => {
  assert.equal(summarize(feed.slice(0, 3)).trend, undefined);
});

test("engagement rate is per post against followers", () => {
  const summary = summarize(feed, { followersCount: 1000 });
  // (650 + 56) / 4 posts = 176.5 per post, /1000 followers = 17.65%.
  assert.equal(summary.engagementRatePercent, 17.65);
});

test("engagement rate is omitted without a follower count", () => {
  assert.equal(summarize(feed).engagementRatePercent, undefined);
});

test("reels are bucketed apart from plain videos", () => {
  const summary = summarize(feed);
  const types = Object.fromEntries(summary.byType.map((bucket) => [bucket.type, bucket]));
  assert.equal(types.REELS?.count, 1);
  assert.equal(types.REELS?.averageLikes, 200);
  assert.equal(types.IMAGE?.count, 2);
  assert.equal(types.CAROUSEL_ALBUM?.count, 1);
  assert.equal(types.VIDEO, undefined);
});

test("rankPosts orders by the chosen metric", () => {
  assert.deepEqual(
    rankPosts(feed, "likes", 2).map((p) => p.id),
    ["5", "4"],
  );
  assert.deepEqual(
    rankPosts(feed, "comments", 2).map((p) => p.id),
    ["4", "5"],
  );
  // Engagement: 4 -> 240, 5 -> 310, 3 -> 105, 2 -> 51.
  assert.deepEqual(
    rankPosts(feed, "engagement", 2).map((p) => p.id),
    ["5", "4"],
  );
});

test("rankPosts does not mutate its input", () => {
  const original = feed.map((p) => p.id);
  rankPosts(feed, "comments");
  assert.deepEqual(
    feed.map((p) => p.id),
    original,
  );
});

test("summarize copes with an empty feed", () => {
  const summary = summarize([]);
  assert.equal(summary.analyzed, 0);
  assert.equal(summary.totalLikes, 0);
  assert.equal(summary.averageLikes, 0);
  assert.equal(summary.best, undefined);
});
