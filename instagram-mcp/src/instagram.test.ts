import assert from "node:assert/strict";
import { test } from "node:test";

import type { Config, StoredToken } from "./config.js";
import { InstagramApiError, InstagramClient, type FetchLike } from "./instagram.js";

function config(overrides: Partial<Config> = {}): Config {
  return { authMode: "instagram_login", graphVersion: "v23.0", ...overrides };
}

function token(overrides: Partial<StoredToken> = {}): StoredToken {
  return { access_token: "TOKEN", auth_mode: "instagram_login", obtained_at: 0, ...overrides };
}

/** Replays canned responses in order and records the URLs requested. */
function fakeFetch(responses: Array<{ status?: number; body: unknown }>): {
  fetchImpl: FetchLike;
  urls: string[];
} {
  const urls: string[] = [];
  let index = 0;
  const fetchImpl: FetchLike = async (url) => {
    urls.push(url);
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    const status = next?.status ?? 200;
    const raw = JSON.stringify(next?.body ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(raw),
      text: async () => raw,
    };
  };
  return { fetchImpl, urls };
}

function media(id: string, likes: number, timestamp: string) {
  return {
    id,
    like_count: likes,
    comments_count: 1,
    timestamp,
    media_type: "IMAGE",
    permalink: `https://instagram.com/p/${id}`,
  };
}

test("instagram_login talks to graph.instagram.com as /me", async () => {
  const { fetchImpl, urls } = fakeFetch([
    { body: { data: [media("a", 10, "2026-05-01T00:00:00+0000")] } },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const result = await client.listMedia({ max: 5 });

  assert.equal(result.posts.length, 1);
  assert.match(urls[0] ?? "", /^https:\/\/graph\.instagram\.com\/v23\.0\/me\/media\?/);
  assert.match(urls[0] ?? "", /access_token=TOKEN/);
  // No app secret configured, and Instagram-login never wants a proof anyway.
  assert.doesNotMatch(urls[0] ?? "", /appsecret_proof/);
});

test("listMedia follows paging.next until it hits max", async () => {
  const { fetchImpl, urls } = fakeFetch([
    {
      body: {
        data: [media("a", 10, "2026-05-03T00:00:00+0000"), media("b", 20, "2026-05-02T00:00:00+0000")],
        paging: { next: "https://graph.instagram.com/next-page-1" },
      },
    },
    {
      body: {
        data: [media("c", 30, "2026-05-01T00:00:00+0000"), media("d", 40, "2026-04-30T00:00:00+0000")],
        paging: { next: "https://graph.instagram.com/next-page-2" },
      },
    },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const result = await client.listMedia({ max: 3 });

  assert.deepEqual(result.posts.map((p) => p.id), ["a", "b", "c"]);
  assert.equal(urls.length, 2);
  assert.equal(urls[1], "https://graph.instagram.com/next-page-1");
  assert.equal(result.hasMore, true);
});

test("listMedia stops at the since cutoff and reports no more", async () => {
  const { fetchImpl } = fakeFetch([
    {
      body: {
        data: [
          media("a", 10, "2026-05-10T00:00:00+0000"),
          media("b", 20, "2026-05-09T00:00:00+0000"),
          media("old", 30, "2020-01-01T00:00:00+0000"),
        ],
        paging: { next: "https://graph.instagram.com/next-page" },
      },
    },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const result = await client.listMedia({ max: 50, since: new Date("2026-05-01T00:00:00Z") });

  assert.deepEqual(result.posts.map((p) => p.id), ["a", "b"]);
  assert.equal(result.hasMore, false, "hitting the cutoff means the window is complete");
});

test("listMedia reports exhaustion when Instagram stops paging", async () => {
  const { fetchImpl } = fakeFetch([{ body: { data: [media("a", 1, "2026-05-01T00:00:00+0000")] } }]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  assert.equal((await client.listMedia({ max: 50 })).hasMore, false);
});

test("an unsupported field is retried with the core field set", async () => {
  const { fetchImpl, urls } = fakeFetch([
    {
      status: 400,
      body: {
        error: {
          message: "(#100) Tried accessing nonexisting field (media_product_type)",
          type: "OAuthException",
          code: 100,
        },
      },
    },
    { body: { data: [media("a", 10, "2026-05-01T00:00:00+0000")] } },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const result = await client.listMedia({ max: 5 });

  assert.equal(result.posts.length, 1);
  assert.equal(result.degradedFields, true);
  assert.match(urls[0] ?? "", /media_product_type/);
  assert.doesNotMatch(urls[1] ?? "", /media_product_type/);
});

test("an expired token surfaces as an auth error with a refresh hint", async () => {
  const { fetchImpl } = fakeFetch([
    {
      status: 400,
      body: {
        error: {
          message: "Error validating access token: Session has expired",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
        },
      },
    },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const error = await client.listMedia({ max: 5 }).then(
    () => undefined,
    (caught: unknown) => caught,
  );

  assert.ok(error instanceof InstagramApiError);
  assert.equal(error.code, 190);
  assert.equal(error.subcode, 463);
  assert.equal(error.isAuthError, true);
  assert.match(error.hint() ?? "", /--refresh/);
});

test("a permission error explains which scope is missing", async () => {
  const { fetchImpl } = fakeFetch([
    { status: 403, body: { error: { message: "Requires instagram_business_basic", code: 200 } } },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const error = await client.getAccount().then(
    () => undefined,
    (caught: unknown) => caught,
  );

  assert.ok(error instanceof InstagramApiError);
  assert.equal(error.isPermissionError, true);
  assert.match(error.hint() ?? "", /instagram_business_basic/);
});

test("facebook_login discovers the IG account through the linked Page", async () => {
  const { fetchImpl, urls } = fakeFetch([
    {
      body: {
        data: [
          { id: "page-no-ig", name: "Unlinked Page" },
          {
            id: "page-1",
            name: "My Page",
            instagram_business_account: { id: "17841400000000000", username: "me" },
          },
        ],
      },
    },
    { body: { data: [media("a", 10, "2026-05-01T00:00:00+0000")] } },
  ]);
  const client = new InstagramClient({
    token: token({ auth_mode: "facebook_login" }),
    config: config({ authMode: "facebook_login", appSecret: "SECRET" }),
    fetchImpl,
  });
  await client.listMedia({ max: 5 });

  assert.match(urls[0] ?? "", /^https:\/\/graph\.facebook\.com\/v23\.0\/me\/accounts\?/);
  assert.match(urls[1] ?? "", /\/17841400000000000\/media\?/);
  // The Facebook host is the one that can require a proof-of-secret.
  assert.match(urls[1] ?? "", /appsecret_proof=[a-f0-9]{64}/);
});

test("an explicit INSTAGRAM_USER_ID skips Page discovery", async () => {
  const { fetchImpl, urls } = fakeFetch([{ body: { data: [] } }]);
  const client = new InstagramClient({
    token: token({ auth_mode: "facebook_login" }),
    config: config({ authMode: "facebook_login", igUserId: "999" }),
    fetchImpl,
  });
  await client.listMedia({ max: 5 });

  assert.equal(urls.length, 1);
  assert.match(urls[0] ?? "", /\/999\/media\?/);
});

test("facebook_login with no linked Page explains the fix", async () => {
  const { fetchImpl } = fakeFetch([{ body: { data: [{ id: "page-1", name: "Bare Page" }] } }]);
  const client = new InstagramClient({
    token: token({ auth_mode: "facebook_login" }),
    config: config({ authMode: "facebook_login" }),
    fetchImpl,
  });
  const error = await client.getAccount().then(
    () => undefined,
    (caught: unknown) => caught,
  );

  assert.ok(error instanceof InstagramApiError);
  assert.match(error.message, /No Instagram Business account is linked/);
});

test("insights fall back to reach when a metric is unsupported", async () => {
  const { fetchImpl, urls } = fakeFetch([
    { status: 400, body: { error: { message: "(#100) metric[0] must be a valid insight", code: 100 } } },
    { body: { data: [{ name: "reach", title: "Reach", values: [{ value: 1234 }] }] } },
  ]);
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const insights = await client.getMediaInsights("media-1");

  assert.deepEqual(insights.values, [{ name: "reach", title: "Reach", value: 1234 }]);
  assert.match(insights.unavailable ?? "", /valid insight/);
  assert.match(urls[1] ?? "", /metric=reach/);
});

test("a non-JSON response is reported instead of throwing a parse error", async () => {
  const fetchImpl: FetchLike = async () => ({
    ok: false,
    status: 502,
    json: async () => ({}),
    text: async () => "<html>Bad Gateway</html>",
  });
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const error = await client.getAccount().then(
    () => undefined,
    (caught: unknown) => caught,
  );

  assert.ok(error instanceof InstagramApiError);
  assert.match(error.message, /non-JSON response \(HTTP 502\)/);
});

test("a network failure names the host that was unreachable", async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error("ECONNREFUSED");
  };
  const client = new InstagramClient({ token: token(), config: config(), fetchImpl });
  const error = await client.getAccount().then(
    () => undefined,
    (caught: unknown) => caught,
  );

  assert.ok(error instanceof InstagramApiError);
  assert.match(error.message, /Could not reach https:\/\/graph\.instagram\.com/);
});
