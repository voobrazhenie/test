import { createHmac } from "node:crypto";
import type { AuthMode, Config, StoredToken } from "./config.js";

export interface MediaPost {
  id: string;
  caption?: string;
  /** IMAGE | VIDEO | CAROUSEL_ALBUM */
  media_type?: string;
  /** FEED | REELS | AD | STORY */
  media_product_type?: string;
  permalink?: string;
  /** ISO 8601 with UTC offset, e.g. 2026-03-04T18:22:11+0000 */
  timestamp?: string;
  /** Omitted by the API when the account hides like counts on that post. */
  like_count?: number;
  comments_count?: number;
  media_url?: string;
  thumbnail_url?: string;
}

export interface Account {
  id: string;
  user_id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
  profile_picture_url?: string;
}

export interface InsightValue {
  name: string;
  title?: string;
  value: number;
}

interface GraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface Paging {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
}

/** A Graph API failure, carrying enough detail to explain the fix. */
export class InstagramApiError extends Error {
  readonly code?: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly status: number;
  readonly fbtraceId?: string;

  constructor(
    message: string,
    opts: {
      code?: number;
      subcode?: number;
      type?: string;
      status: number;
      fbtraceId?: string;
    },
  ) {
    super(message);
    this.name = "InstagramApiError";
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.type = opts.type;
    this.status = opts.status;
    this.fbtraceId = opts.fbtraceId;
  }

  get isAuthError(): boolean {
    return this.code === 190 || this.type === "OAuthException" || this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613;
  }

  /** Code 100 covers "you asked for a field/metric this node does not have". */
  get isBadField(): boolean {
    return this.code === 100;
  }

  get isPermissionError(): boolean {
    return this.code === 10 || (this.code !== undefined && this.code >= 200 && this.code < 300);
  }

  /** A next step the user can actually take, appended to tool error output. */
  hint(): string | undefined {
    if (this.isAuthError) {
      return [
        "The access token was rejected. Long-lived Instagram tokens last 60 days",
        "and must be refreshed at least once in that window.",
        "Run `npm run auth -- --refresh` (or `npm run auth` to mint a fresh one).",
      ].join(" ");
    }
    if (this.isRateLimited) {
      return "Instagram is rate limiting this app. Wait a few minutes and retry with a smaller limit.";
    }
    if (this.isPermissionError) {
      return [
        "The token is missing a required permission. Re-authorize with the",
        "instagram_business_basic scope (add instagram_business_manage_insights",
        "for the insights tool).",
      ].join(" ");
    }
    return undefined;
  }
}

/** Everything useful; dropped to CORE_* if the API rejects an optional field. */
const FULL_MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
  "media_url",
  "thumbnail_url",
] as const;

const CORE_MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
] as const;

const FULL_ACCOUNT_FIELDS: Record<AuthMode, readonly string[]> = {
  instagram_login: [
    "id",
    "user_id",
    "username",
    "name",
    "account_type",
    "media_count",
    "followers_count",
    "follows_count",
    "profile_picture_url",
  ],
  facebook_login: [
    "id",
    "username",
    "name",
    "media_count",
    "followers_count",
    "follows_count",
    "profile_picture_url",
  ],
};

const CORE_ACCOUNT_FIELDS: Record<AuthMode, readonly string[]> = {
  instagram_login: ["id", "username", "media_count"],
  facebook_login: ["id", "username", "media_count"],
};

export const DEFAULT_INSIGHT_METRICS = [
  "reach",
  "views",
  "saved",
  "shares",
  "total_interactions",
] as const;

/** Page size per request. The Graph API caps media pages around 100. */
const PAGE_SIZE = 50;
/** Refuse to walk more than this many pages in one call. */
const MAX_PAGES = 20;

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface ListMediaOptions {
  /** Maximum posts to return. */
  max?: number;
  /** Stop paginating once posts are older than this. */
  since?: Date;
  /** Skip posts newer than this. */
  until?: Date;
}

export interface ListMediaResult {
  posts: MediaPost[];
  /** True when the account has older posts we did not fetch. */
  hasMore: boolean;
  /** Set when optional fields had to be dropped for the API to answer. */
  degradedFields?: boolean;
}

export class InstagramClient {
  private readonly config: Config;
  private readonly fetchImpl: FetchLike;
  private token: StoredToken;
  private cachedUserId?: string;
  private mediaFields: readonly string[] = FULL_MEDIA_FIELDS;
  private accountFields: readonly string[];

  constructor(opts: { token: StoredToken; config: Config; fetchImpl?: FetchLike }) {
    this.token = opts.token;
    this.config = opts.config;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.accountFields = FULL_ACCOUNT_FIELDS[this.authMode];
  }

  get authMode(): AuthMode {
    return this.token.auth_mode ?? this.config.authMode;
  }

  get host(): string {
    return this.authMode === "instagram_login"
      ? "https://graph.instagram.com"
      : "https://graph.facebook.com";
  }

  private get baseUrl(): string {
    return `${this.host}/${this.config.graphVersion}`;
  }

  /**
   * Meta can require a proof-of-secret alongside the token on the Facebook
   * host. It is never expected on graph.instagram.com.
   */
  private appSecretProof(): string | undefined {
    if (this.authMode !== "facebook_login") return undefined;
    if (!this.config.appSecret) return undefined;
    return createHmac("sha256", this.config.appSecret)
      .update(this.token.access_token)
      .digest("hex");
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    url.searchParams.set("access_token", this.token.access_token);
    const proof = this.appSecretProof();
    if (proof) url.searchParams.set("appsecret_proof", proof);
    return this.requestUrl<T>(url.toString());
  }

  private async requestUrl<T>(url: string): Promise<T> {
    let response;
    try {
      response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    } catch (cause) {
      throw new InstagramApiError(
        `Could not reach ${this.host}: ${(cause as Error).message}`,
        { status: 0 },
      );
    }

    let payload: unknown;
    const raw = await response.text();
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new InstagramApiError(
        `Instagram returned a non-JSON response (HTTP ${response.status}): ${raw.slice(0, 200)}`,
        { status: response.status },
      );
    }

    const error = (payload as { error?: GraphError } | null)?.error;
    if (error || !response.ok) {
      throw new InstagramApiError(error?.message ?? `HTTP ${response.status}`, {
        code: error?.code,
        subcode: error?.error_subcode,
        type: error?.type,
        status: response.status,
        fbtraceId: error?.fbtrace_id,
      });
    }
    return payload as T;
  }

  /**
   * instagram_login: the token *is* the account, so "me" always works.
   * facebook_login: the IG account hangs off a Facebook Page, so it has to be
   * configured or discovered.
   */
  async resolveUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    if (this.authMode === "instagram_login") {
      this.cachedUserId = "me";
      return this.cachedUserId;
    }
    const configured = this.config.igUserId ?? this.token.ig_user_id;
    if (configured) {
      this.cachedUserId = configured;
      return configured;
    }

    const pages = await this.request<{
      data?: Array<{
        id: string;
        name?: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
    }>("me/accounts", { fields: "name,instagram_business_account{id,username}", limit: 50 });

    const linked = (pages.data ?? []).find((page) => page.instagram_business_account?.id);
    if (!linked?.instagram_business_account) {
      throw new InstagramApiError(
        [
          "No Instagram Business account is linked to any Facebook Page this token can see.",
          "Link the account under Page Settings > Linked accounts, or set INSTAGRAM_USER_ID,",
          "or switch to INSTAGRAM_AUTH_MODE=instagram_login which needs no Page.",
        ].join(" "),
        { status: 200 },
      );
    }
    this.cachedUserId = linked.instagram_business_account.id;
    return this.cachedUserId;
  }

  async getAccount(): Promise<Account> {
    const userId = await this.resolveUserId();
    try {
      return await this.request<Account>(userId, { fields: this.accountFields.join(",") });
    } catch (error) {
      if (error instanceof InstagramApiError && error.isBadField) {
        // Some field sets vary by account type and API version; retry lean.
        this.accountFields = CORE_ACCOUNT_FIELDS[this.authMode];
        return this.request<Account>(userId, { fields: this.accountFields.join(",") });
      }
      throw error;
    }
  }

  async getMedia(mediaId: string): Promise<MediaPost> {
    try {
      return await this.request<MediaPost>(mediaId, { fields: this.mediaFields.join(",") });
    } catch (error) {
      if (error instanceof InstagramApiError && error.isBadField) {
        this.mediaFields = CORE_MEDIA_FIELDS;
        return this.request<MediaPost>(mediaId, { fields: this.mediaFields.join(",") });
      }
      throw error;
    }
  }

  /**
   * Walks the media edge newest-first, stopping at `max`, at `since`, or when
   * Instagram runs out of pages — whichever comes first.
   */
  async listMedia(options: ListMediaOptions = {}): Promise<ListMediaResult> {
    const max = Math.max(1, Math.min(options.max ?? 25, MAX_PAGES * PAGE_SIZE));
    const userId = await this.resolveUserId();
    const sinceMs = options.since?.getTime();
    const untilMs = options.until?.getTime();

    const posts: MediaPost[] = [];
    let degradedFields = false;
    let nextUrl: string | undefined;
    let reachedCutoff = false;
    let exhausted = false;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      let body: { data?: MediaPost[]; paging?: Paging };
      try {
        body = nextUrl
          ? await this.requestUrl<{ data?: MediaPost[]; paging?: Paging }>(nextUrl)
          : await this.request<{ data?: MediaPost[]; paging?: Paging }>(`${userId}/media`, {
              fields: this.mediaFields.join(","),
              limit: Math.min(PAGE_SIZE, max),
            });
      } catch (error) {
        // Only the very first page can fail on fields — retry it lean once.
        if (error instanceof InstagramApiError && error.isBadField && !nextUrl) {
          this.mediaFields = CORE_MEDIA_FIELDS;
          degradedFields = true;
          body = await this.request<{ data?: MediaPost[]; paging?: Paging }>(
            `${userId}/media`,
            { fields: this.mediaFields.join(","), limit: Math.min(PAGE_SIZE, max) },
          );
        } else {
          throw error;
        }
      }

      const batch = body.data ?? [];
      if (batch.length === 0) {
        exhausted = true;
        break;
      }

      for (const post of batch) {
        const at = post.timestamp ? Date.parse(post.timestamp) : Number.NaN;
        if (untilMs !== undefined && Number.isFinite(at) && at > untilMs) continue;
        if (sinceMs !== undefined && Number.isFinite(at) && at < sinceMs) {
          reachedCutoff = true;
          break;
        }
        posts.push(post);
        if (posts.length >= max) break;
      }

      if (reachedCutoff || posts.length >= max) break;
      nextUrl = body.paging?.next;
      if (!nextUrl) {
        exhausted = true;
        break;
      }
    }

    return {
      posts,
      hasMore: !reachedCutoff && !exhausted,
      degradedFields: degradedFields || undefined,
    };
  }

  /**
   * Insights are best-effort: metric availability depends on media type, age
   * and API version, so an unsupported metric degrades instead of failing.
   */
  async getMediaInsights(
    mediaId: string,
    metrics: readonly string[] = DEFAULT_INSIGHT_METRICS,
  ): Promise<{ values: InsightValue[]; unavailable?: string }> {
    const parse = (body: {
      data?: Array<{ name: string; title?: string; values?: Array<{ value?: number }> }>;
    }): InsightValue[] =>
      (body.data ?? []).map((entry) => ({
        name: entry.name,
        title: entry.title,
        value: entry.values?.[0]?.value ?? 0,
      }));

    try {
      const body = await this.request<Parameters<typeof parse>[0]>(`${mediaId}/insights`, {
        metric: metrics.join(","),
      });
      return { values: parse(body) };
    } catch (error) {
      if (error instanceof InstagramApiError && (error.isBadField || error.isPermissionError)) {
        try {
          const body = await this.request<Parameters<typeof parse>[0]>(`${mediaId}/insights`, {
            metric: "reach",
          });
          return { values: parse(body), unavailable: error.message };
        } catch {
          return { values: [], unavailable: error.message };
        }
      }
      throw error;
    }
  }

  /** Extends a long-lived token for another 60 days. */
  async refreshToken(): Promise<StoredToken> {
    if (this.authMode === "instagram_login") {
      const body = await this.requestUrl<{ access_token: string; expires_in?: number }>(
        `${this.host}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
          this.token.access_token,
        )}`,
      );
      this.token = {
        ...this.token,
        access_token: body.access_token,
        obtained_at: Date.now(),
        expires_at: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined,
      };
      return this.token;
    }

    if (!this.config.appId || !this.config.appSecret) {
      throw new InstagramApiError(
        "Refreshing a Facebook-login token needs INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
        { status: 400 },
      );
    }
    const url = new URL(`${this.host}/${this.config.graphVersion}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", this.config.appId);
    url.searchParams.set("client_secret", this.config.appSecret);
    url.searchParams.set("fb_exchange_token", this.token.access_token);
    const body = await this.requestUrl<{ access_token: string; expires_in?: number }>(
      url.toString(),
    );
    this.token = {
      ...this.token,
      access_token: body.access_token,
      obtained_at: Date.now(),
      expires_at: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined,
    };
    return this.token;
  }

  currentToken(): StoredToken {
    return this.token;
  }
}
