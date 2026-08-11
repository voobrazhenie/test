#!/usr/bin/env node
/**
 * Interactive helper that mints and refreshes the long-lived Instagram token
 * the MCP server reads. Run it with `npm run auth`.
 *
 * Instagram requires HTTPS redirect URIs, so a loopback listener is not an
 * option — instead we print the authorize URL and take the redirected URL back
 * by paste. It works with any redirect URI registered on the app, including one
 * that serves nothing at all.
 */
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadConfig,
  loadDotEnv,
  readStoredToken,
  tokenPath,
  writeStoredToken,
  type AuthMode,
  type Config,
  type StoredToken,
} from "./config.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(join(packageRoot, ".env"));

const SCOPES: Record<AuthMode, string[]> = {
  instagram_login: ["instagram_business_basic", "instagram_business_manage_insights"],
  facebook_login: [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
  ],
};

function die(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    die(`Unexpected non-JSON response (HTTP ${response.status}): ${raw.slice(0, 300)}`);
  }
  const error = (payload as { error?: { message?: string; error_user_msg?: string } }).error;
  const legacy = (payload as { error_message?: string }).error_message;
  if (error || legacy || !response.ok) {
    die(
      `Instagram rejected the request: ${
        error?.error_user_msg ?? error?.message ?? legacy ?? `HTTP ${response.status}`
      }`,
    );
  }
  return payload as T;
}

function authorizeUrl(config: Config): string {
  const { appId, redirectUri, authMode } = config;
  if (!appId) die("INSTAGRAM_APP_ID is not set. Copy .env.example to .env and fill it in.");
  if (!redirectUri) die("INSTAGRAM_REDIRECT_URI is not set. It must match the app exactly.");

  if (authMode === "instagram_login") {
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.instagram_login.join(","));
    return url.toString();
  }

  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.facebook_login.join(","));
  return url.toString();
}

/** Accepts a bare code or the whole redirected URL, and strips Instagram's `#_`. */
function extractCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) die("No code provided.");
  let code = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const fromUrl = new URL(trimmed).searchParams.get("code");
    if (!fromUrl) die("That URL has no `code` parameter. Copy the full redirected URL.");
    code = fromUrl;
  }
  return code.replace(/#_$/, "").trim();
}

async function exchangeCode(config: Config, code: string): Promise<StoredToken> {
  if (config.authMode === "instagram_login") {
    const body = new URLSearchParams({
      client_id: config.appId!,
      client_secret: config.appSecret!,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri!,
      code,
    });
    const short = await getJson<{ access_token: string; user_id?: number | string }>(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      },
    );
    console.log("  ✓ got a short-lived token");
    return exchangeForLongLived(config, short.access_token, String(short.user_id ?? ""));
  }

  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId!);
  url.searchParams.set("client_secret", config.appSecret!);
  url.searchParams.set("redirect_uri", config.redirectUri!);
  url.searchParams.set("code", code);
  const short = await getJson<{ access_token: string }>(url.toString());
  console.log("  ✓ got a short-lived token");
  return exchangeForLongLived(config, short.access_token, "");
}

async function exchangeForLongLived(
  config: Config,
  shortLived: string,
  userId: string,
): Promise<StoredToken> {
  if (!config.appSecret) die("INSTAGRAM_APP_SECRET is required to upgrade a token.");
  if (config.authMode === "facebook_login" && !config.appId) {
    die("INSTAGRAM_APP_ID is required to upgrade a Facebook-login token.");
  }
  if (config.authMode === "instagram_login") {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", config.appSecret!);
    url.searchParams.set("access_token", shortLived);
    const long = await getJson<{ access_token: string; expires_in?: number }>(url.toString());
    console.log("  ✓ upgraded to a long-lived token");
    return {
      access_token: long.access_token,
      auth_mode: "instagram_login",
      obtained_at: Date.now(),
      expires_at: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
      ig_user_id: userId || undefined,
    };
  }

  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", config.appId!);
  url.searchParams.set("client_secret", config.appSecret!);
  url.searchParams.set("fb_exchange_token", shortLived);
  const long = await getJson<{ access_token: string; expires_in?: number }>(url.toString());
  console.log("  ✓ upgraded to a long-lived token");
  return {
    access_token: long.access_token,
    auth_mode: "facebook_login",
    obtained_at: Date.now(),
    expires_at: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
  };
}

/** Confirms the token works and records who it belongs to. */
async function verify(config: Config, token: StoredToken): Promise<StoredToken> {
  const { InstagramClient } = await import("./instagram.js");
  const client = new InstagramClient({ token, config });
  const account = await client.getAccount();
  console.log(
    `  ✓ verified as @${account.username ?? account.id}` +
      (account.media_count !== undefined ? ` (${account.media_count} posts)` : ""),
  );
  if (
    account.account_type &&
    !/business|creator|media_creator/i.test(account.account_type)
  ) {
    console.warn(
      `\n  ⚠ Account type is "${account.account_type}". Instagram only returns like counts\n` +
        "    for Business and Creator accounts. Switch it in the Instagram app under\n" +
        "    Settings > Account type and tools, then run this again.",
    );
  }
  return {
    ...token,
    ig_user_id: account.user_id ?? account.id ?? token.ig_user_id,
    username: account.username,
  };
}

function save(token: StoredToken): void {
  const path = writeStoredToken(token);
  console.log(`\n✓ Saved to ${path} (mode 0600)`);
  if (token.expires_at) {
    console.log(`  Expires ${new Date(token.expires_at).toISOString().slice(0, 10)}.`);
    console.log("  Re-run `npm run auth -- --refresh` before then, or just use the server —");
    console.log("  it refreshes automatically when fewer than 7 days remain.");
  }
  console.log("\nThe MCP server will pick this up on its next start.\n");
}

async function doRefresh(config: Config): Promise<void> {
  const stored = readStoredToken();
  if (!stored) die(`No cached token at ${tokenPath()}. Run \`npm run auth\` first.`);
  const { InstagramClient } = await import("./instagram.js");
  const client = new InstagramClient({ token: stored, config });
  console.log("Refreshing…");
  const refreshed = await client.refreshToken();
  save(await verify(config, refreshed));
}

function showStatus(): void {
  const stored = readStoredToken();
  console.log(`\nToken file: ${tokenPath()}`);
  if (!stored) {
    console.log("Status:     none cached\n");
    return;
  }
  const masked = `${stored.access_token.slice(0, 6)}…${stored.access_token.slice(-4)}`;
  console.log(`Status:     cached (${masked})`);
  console.log(`Mode:       ${stored.auth_mode}`);
  if (stored.username) console.log(`Account:    @${stored.username}`);
  if (stored.expires_at) {
    const days = Math.round((stored.expires_at - Date.now()) / 86_400_000);
    console.log(`Expires:    ${new Date(stored.expires_at).toISOString().slice(0, 10)} (${days}d)`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const config = loadConfig();

  if (args.includes("--status")) return showStatus();
  if (args.includes("--refresh")) return doRefresh(config);

  const tokenFlag = args.indexOf("--token");
  if (tokenFlag !== -1) {
    const raw = args[tokenFlag + 1];
    if (!raw) die("--token needs a value.");
    if (!config.appSecret) {
      // Without the secret we cannot upgrade it; assume it is already long-lived.
      console.log("No INSTAGRAM_APP_SECRET set — treating the token as already long-lived.");
      save(
        await verify(config, {
          access_token: raw,
          auth_mode: config.authMode,
          obtained_at: Date.now(),
        }),
      );
      return;
    }
    console.log("Exchanging the token for a long-lived one…");
    save(await verify(config, await exchangeForLongLived(config, raw, "")));
    return;
  }

  if (!config.appSecret) {
    die("INSTAGRAM_APP_SECRET is not set. Copy .env.example to .env and fill it in.");
  }

  const url = authorizeUrl(config);
  console.log("\n─── Instagram MCP authorization ───────────────────────────────\n");
  console.log(`Mode:   ${config.authMode}`);
  console.log(`Scopes: ${SCOPES[config.authMode].join(", ")}\n`);
  console.log("1. Open this URL in a browser signed in to the Instagram account:\n");
  console.log(`   ${url}\n`);
  console.log("2. Approve the permissions. The browser lands on your redirect URI,");
  console.log("   which may show an error page — that is fine, the code is in the URL.\n");
  console.log("3. Copy the entire address bar contents and paste it below.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("Redirected URL (or just the code): ");
    const code = extractCode(answer);
    console.log("\nExchanging…");
    const token = await exchangeCode(config, code);
    save(await verify(config, token));
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  die(error instanceof Error ? error.message : String(error));
});
