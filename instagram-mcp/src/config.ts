import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0";

/**
 * Two different Meta products can read your Instagram media, and they use
 * different hosts, different id semantics and different field sets.
 *
 *  - instagram_login: "Instagram API with Instagram login". graph.instagram.com,
 *    the token itself identifies the account, no Facebook Page required.
 *  - facebook_login: "Instagram API with Facebook login". graph.facebook.com,
 *    the token is a Facebook user/page token and the IG account id has to be
 *    discovered through the Page it is linked to.
 */
export type AuthMode = "instagram_login" | "facebook_login";

export interface StoredToken {
  access_token: string;
  auth_mode: AuthMode;
  /** Epoch millis. Absent when the API did not tell us (assume long-lived). */
  expires_at?: number;
  obtained_at: number;
  ig_user_id?: string;
  username?: string;
}

export interface Config {
  authMode: AuthMode;
  appId?: string;
  appSecret?: string;
  redirectUri?: string;
  /** Explicit IG business account id, only meaningful for facebook_login. */
  igUserId?: string;
  graphVersion: string;
}

function parseAuthMode(raw: string | undefined): AuthMode {
  if (!raw) return "instagram_login";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "instagram_login" || normalized === "instagram") {
    return "instagram_login";
  }
  if (normalized === "facebook_login" || normalized === "facebook") {
    return "facebook_login";
  }
  throw new Error(
    `INSTAGRAM_AUTH_MODE must be "instagram_login" or "facebook_login", got "${raw}"`,
  );
}

/**
 * Minimal .env loader. Deliberately does not overwrite variables that are
 * already set, so an MCP client's `env` block always beats a local file.
 */
export function loadDotEnv(path: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (!key || key in env) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    env[key] = value;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    authMode: parseAuthMode(env.INSTAGRAM_AUTH_MODE),
    appId: env.INSTAGRAM_APP_ID?.trim() || undefined,
    appSecret: env.INSTAGRAM_APP_SECRET?.trim() || undefined,
    redirectUri: env.INSTAGRAM_REDIRECT_URI?.trim() || undefined,
    igUserId: env.INSTAGRAM_USER_ID?.trim() || undefined,
    graphVersion: env.INSTAGRAM_GRAPH_VERSION?.trim() || GRAPH_VERSION,
  };
}

export function tokenPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.INSTAGRAM_TOKEN_FILE?.trim();
  if (override) return override;
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "instagram-mcp", "token.json");
}

export function readStoredToken(
  env: NodeJS.ProcessEnv = process.env,
): StoredToken | undefined {
  const path = tokenPath(env);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as StoredToken;
    if (typeof parsed?.access_token !== "string" || !parsed.access_token) {
      return undefined;
    }
    return parsed;
  } catch {
    // A corrupt cache should not take the server down — fall back to env.
    return undefined;
  }
}

export function writeStoredToken(
  token: StoredToken,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const path = tokenPath(env);
  mkdirSync(dirname(path), { recursive: true });
  // 0600: this file is a bearer credential for the account.
  writeFileSync(path, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
  return path;
}

/**
 * Env var wins over the cached file, so a token pasted into an MCP config is
 * always authoritative and `npm run auth` stays an optional convenience.
 */
export function resolveToken(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
): StoredToken | undefined {
  const fromEnv = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (fromEnv) {
    return {
      access_token: fromEnv,
      auth_mode: config.authMode,
      obtained_at: 0,
      ig_user_id: config.igUserId,
    };
  }
  const stored = readStoredToken(env);
  if (stored && config.igUserId && !stored.ig_user_id) {
    return { ...stored, ig_user_id: config.igUserId };
  }
  return stored;
}

/** Thrown when the server is not configured yet — not an API failure. */
export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupError";
  }
}

export const SETUP_HINT = [
  "No Instagram access token found.",
  "",
  "Set INSTAGRAM_ACCESS_TOKEN in the MCP server environment, or run",
  "`npm run auth` inside instagram-mcp/ to mint and cache one.",
  "See instagram-mcp/README.md for the full setup walkthrough.",
].join("\n");
