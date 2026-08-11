#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  loadConfig,
  loadDotEnv,
  resolveToken,
  writeStoredToken,
  SetupError,
  SETUP_HINT,
  type Config,
  type StoredToken,
} from "./config.js";
import { InstagramApiError, InstagramClient, type MediaPost } from "./instagram.js";
import {
  formatAccount,
  formatPostDetail,
  formatPostTable,
  formatSummary,
  num,
} from "./format.js";
import { rankPosts, summarize, type RankMetric } from "./stats.js";

const VERSION = "0.1.0";
/** Refresh a long-lived token when it has less than this left on the clock. */
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Convenience for local runs; never overrides env supplied by the MCP client.
loadDotEnv(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));

const config: Config = loadConfig();
let client: InstagramClient | undefined;

function log(message: string): void {
  // stdout carries the MCP protocol; diagnostics must go to stderr.
  process.stderr.write(`[instagram-mcp] ${message}\n`);
}

/** Built lazily so a missing token surfaces as a tool error, not a crash. */
async function getClient(): Promise<InstagramClient> {
  if (client) return client;
  const token = resolveToken(config);
  if (!token) throw new SetupError(SETUP_HINT);

  const created = new InstagramClient({ token, config });

  const expiresIn = token.expires_at ? token.expires_at - Date.now() : undefined;
  if (expiresIn !== undefined && expiresIn < REFRESH_THRESHOLD_MS && expiresIn > 0) {
    try {
      const refreshed = await created.refreshToken();
      writeStoredToken(refreshed);
      log("refreshed the long-lived access token");
    } catch (error) {
      log(`token refresh failed, continuing with the existing token: ${(error as Error).message}`);
    }
  }

  client = created;
  return client;
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function text(body: string): ToolResult {
  return { content: [{ type: "text", text: body }] };
}

/** Turns thrown errors into readable, actionable tool output. */
async function run(handler: () => Promise<string>): Promise<ToolResult> {
  try {
    return text(await handler());
  } catch (error) {
    if (error instanceof SetupError) {
      // A configuration gap, not an API failure — show it without a prefix.
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (error instanceof InstagramApiError) {
      const hint = error.hint();
      const detail = [
        `Instagram API error: ${error.message}`,
        error.code !== undefined ? `(code ${error.code}${error.subcode ? `/${error.subcode}` : ""})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return {
        content: [{ type: "text", text: hint ? `${detail}\n\n${hint}` : detail }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Unexpected error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

function sinceFrom(days: number | undefined): Date | undefined {
  if (days === undefined) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function windowNote(days: number | undefined, hasMore: boolean, scanned: number): string {
  const parts: string[] = [];
  if (days !== undefined) parts.push(`window: last ${days} days`);
  parts.push(`${scanned} post${scanned === 1 ? "" : "s"} scanned`);
  if (hasMore) parts.push("older posts exist beyond this window — raise `scan` to include them");
  return `\n\n_${parts.join(" · ")}_`;
}

const server = new McpServer({ name: "instagram-mcp", version: VERSION });

server.registerTool(
  "instagram_likes_summary",
  {
    title: "Instagram likes summary",
    description:
      "Aggregate like counts across your recent Instagram posts: total likes, average and " +
      "median per post, most- and least-liked post, a trend against the earlier half of the " +
      "window, and a breakdown by format. Start here for 'how many likes am I getting?'.",
    inputSchema: {
      scan: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(30)
        .describe("How many recent posts to include (newest first)."),
      since_days: z
        .number()
        .int()
        .min(1)
        .max(3650)
        .optional()
        .describe("Only include posts from the last N days."),
    },
  },
  async ({ scan, since_days }) =>
    run(async () => {
      const api = await getClient();
      const [account, media] = await Promise.all([
        api.getAccount().catch(() => undefined),
        api.listMedia({ max: scan, since: sinceFrom(since_days) }),
      ]);
      const summary = summarize(media.posts, {
        followersCount: account?.followers_count,
      });
      return (
        formatSummary(summary, account) +
        windowNote(since_days, media.hasMore, media.posts.length)
      );
    }),
);

server.registerTool(
  "instagram_recent_posts",
  {
    title: "Recent Instagram posts",
    description:
      "List your most recent Instagram posts newest-first with like and comment counts, " +
      "date, format and permalink.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(12).describe("How many posts to list."),
      since_days: z
        .number()
        .int()
        .min(1)
        .max(3650)
        .optional()
        .describe("Only include posts from the last N days."),
    },
  },
  async ({ limit, since_days }) =>
    run(async () => {
      const api = await getClient();
      const media = await api.listMedia({ max: limit, since: sinceFrom(since_days) });
      const totalLikes = media.posts.reduce((sum, post) => sum + (post.like_count ?? 0), 0);
      return (
        `${formatPostTable(media.posts)}\n\n**${num(totalLikes)} likes** across these ${media.posts.length} posts.` +
        windowNote(since_days, media.hasMore, media.posts.length)
      );
    }),
);

server.registerTool(
  "instagram_top_posts",
  {
    title: "Top Instagram posts",
    description:
      "Rank your posts by likes, comments or total engagement to find the best performers.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).default(10).describe("How many posts to return."),
      scan: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(60)
        .describe("How many recent posts to rank across."),
      metric: z
        .enum(["likes", "comments", "engagement"])
        .default("likes")
        .describe("Ranking metric. 'engagement' is likes + comments."),
      since_days: z
        .number()
        .int()
        .min(1)
        .max(3650)
        .optional()
        .describe("Only consider posts from the last N days."),
    },
  },
  async ({ limit, scan, metric, since_days }) =>
    run(async () => {
      const api = await getClient();
      const media = await api.listMedia({ max: scan, since: sinceFrom(since_days) });
      const ranked = rankPosts(media.posts, metric as RankMetric, limit);
      return (
        `**Top ${ranked.length} posts by ${metric}**\n\n${formatPostTable(ranked)}` +
        windowNote(since_days, media.hasMore, media.posts.length)
      );
    }),
);

server.registerTool(
  "instagram_post",
  {
    title: "Instagram post detail",
    description:
      "Full detail for one post by media id, including like and comment counts and " +
      "optionally reach/views/saves insights.",
    inputSchema: {
      media_id: z.string().min(1).describe("The media id, as returned by the other tools."),
      include_insights: z
        .boolean()
        .default(false)
        .describe("Also fetch reach, views, saves and shares (needs the insights permission)."),
    },
  },
  async ({ media_id, include_insights }) =>
    run(async () => {
      const api = await getClient();
      const post = await api.getMedia(media_id);
      const insights = include_insights ? await api.getMediaInsights(media_id) : undefined;
      return formatPostDetail(post, insights);
    }),
);

server.registerTool(
  "instagram_find_posts",
  {
    title: "Find Instagram posts by caption",
    description:
      "Search your recent posts by caption text (case-insensitive substring) and report " +
      "their like counts. Useful for 'how did my post about X do?'.",
    inputSchema: {
      query: z.string().min(1).describe("Text to look for in captions, e.g. a hashtag or word."),
      scan: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(100)
        .describe("How many recent posts to search through."),
    },
  },
  async ({ query, scan }) =>
    run(async () => {
      const api = await getClient();
      const media = await api.listMedia({ max: scan });
      const needle = query.toLowerCase();
      const matches: MediaPost[] = media.posts.filter((post) =>
        (post.caption ?? "").toLowerCase().includes(needle),
      );
      if (matches.length === 0) {
        return `No caption among the last ${media.posts.length} posts contains "${query}".`;
      }
      const totalLikes = matches.reduce((sum, post) => sum + (post.like_count ?? 0), 0);
      return (
        `**${matches.length} post${matches.length === 1 ? "" : "s"} matching "${query}"** — ${num(totalLikes)} likes total\n\n` +
        formatPostTable(matches) +
        windowNote(undefined, media.hasMore, media.posts.length)
      );
    }),
);

server.registerTool(
  "instagram_account",
  {
    title: "Instagram account overview",
    description:
      "Your Instagram account profile: username, account type, follower count and total posts.",
    inputSchema: {},
  },
  async () =>
    run(async () => {
      const api = await getClient();
      return formatAccount(await api.getAccount());
    }),
);

server.registerTool(
  "instagram_check_setup",
  {
    title: "Check Instagram MCP setup",
    description:
      "Diagnose the connection: which auth mode is active, whether a token is present, when " +
      "it expires, and whether the API answers. Run this first when something fails.",
    inputSchema: {},
  },
  async () =>
    run(async () => {
      const token: StoredToken | undefined = resolveToken(config);
      const lines = [
        "**Instagram MCP setup**",
        "",
        `- Auth mode: \`${config.authMode}\``,
        `- Graph version: \`${config.graphVersion}\``,
        `- Token present: ${token ? "yes" : "**no**"}`,
      ];
      if (token?.expires_at) {
        const days = Math.round((token.expires_at - Date.now()) / (24 * 60 * 60 * 1000));
        lines.push(
          `- Token expires: ${new Date(token.expires_at).toISOString().slice(0, 10)} (${days} day${days === 1 ? "" : "s"} left)`,
        );
      }
      if (!token) {
        lines.push("", SETUP_HINT);
        return lines.join("\n");
      }

      try {
        const api = await getClient();
        const account = await api.getAccount();
        lines.push(
          `- API reachable: yes (${api.host})`,
          "",
          formatAccount(account),
        );
        if (account.account_type && !/business|creator|media_creator/i.test(account.account_type)) {
          lines.push(
            "",
            "⚠️ This looks like a personal account. Instagram only exposes `like_count` for",
            "Business and Creator accounts — switch the account type in the Instagram app",
            "(Settings > Account type and tools) and re-authorize.",
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lines.push(`- API reachable: **no** — ${message}`);
        if (error instanceof InstagramApiError) {
          const hint = error.hint();
          if (hint) lines.push("", hint);
        }
      }
      return lines.join("\n");
    }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`ready (v${VERSION}, mode=${config.authMode})`);
}

main().catch((error: unknown) => {
  log(`fatal: ${(error as Error).message}`);
  process.exit(1);
});
