# instagram-mcp

An MCP server that reports how many likes your Instagram posts are getting.

Ask your assistant *"how many likes am I getting lately?"* and it answers from
the real Instagram API: totals, averages, your best and worst post, whether
you're trending up or down, and which formats perform.

```
**Likes summary for @you** — 6 posts from 2026-06-01 to 2026-08-02

- **Total likes: 3,686**
- Average per post: 737.2
- Median per post: 642
- Total comments: 167 (avg 27.8)
- Engagement rate: 5.18% of 12,400 followers per post
- Trend: up 128.5% — newer half averages 963 likes vs 421.5 for the older half

**Most liked** — 1,284 likes, 2026-08-02
[Late night studio session — new track coming #music #synth](https://instagram.com/reel/aaa)
```

## Read this first: the account requirement

**Instagram only exposes `like_count` for Business and Creator accounts.** There
is no API — official or otherwise — that returns like counts for a personal
account. The old Basic Display API was shut down in December 2024, and it never
returned likes anyway.

Switching is free and takes about thirty seconds in the Instagram app:
**Settings → Account type and tools → Switch to professional account**. Creator
is the lighter of the two options. You can switch back at any time.

You also only ever see **your own** posts. That is the API's boundary, not this
server's.

## Tools

| Tool | What it answers |
| --- | --- |
| `instagram_likes_summary` | "How many likes am I getting?" Totals, average, median, best/worst, trend, format breakdown. **Start here.** |
| `instagram_recent_posts` | "What did my last N posts get?" A table, newest first. |
| `instagram_top_posts` | "What are my best posts?" Ranked by likes, comments or engagement. |
| `instagram_post` | "How did this one do?" One post in detail, optionally with reach/views/saves. |
| `instagram_find_posts` | "How did my post about X do?" Caption search with like counts. |
| `instagram_account` | Username, account type, followers, total posts. |
| `instagram_check_setup` | Diagnoses the connection. Run this when something breaks. |

Posts where you've hidden like counts are reported as `hidden` and left out of
the like averages, so one hidden post doesn't drag your average down.

## Setup

### 1. Create a Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   **Create app**.
2. For use case, pick **Other** → app type **Business**.
3. In the left sidebar, add the **Instagram** product.
4. Open **Instagram → API setup with Instagram login**, and in step 3
   ("Set up Instagram business login") open **Business login settings**.
5. Add an **OAuth redirect URI**. It must be HTTPS. It does not have to serve
   anything — `https://localhost/auth/callback` is fine, and the browser showing
   an error page after you approve is expected. Save.
6. From the same screen, note the **Instagram app ID** and **Instagram app
   secret**.

Under **App roles → Roles**, make sure the Instagram account you want to read is
listed. While the app is in development mode, only accounts with a role on it
can authorize. You do **not** need App Review — that's only for accessing other
people's accounts.

### 2. Configure and authorize

```bash
cd instagram-mcp
npm install
cp .env.example .env      # then fill in app id, secret and redirect URI
npm run auth
```

`npm run auth` prints an authorization URL. Open it in a browser signed in to
the Instagram account, approve, then paste the URL you land on back into the
terminal. It exchanges the code, upgrades to a 60-day long-lived token,
verifies it against the API, and caches it at
`~/.config/instagram-mcp/token.json` with mode `0600`.

Other modes:

```bash
npm run auth -- --status     # what's cached, and when it expires
npm run auth -- --refresh    # extend for another 60 days
npm run auth -- --token XYZ  # adopt a token you already have
```

The server also refreshes the token on its own once fewer than seven days
remain, so in practice you run this once.

### 3. Build and register

```bash
npm run build
```

Claude Code:

```bash
claude mcp add instagram -- node /absolute/path/to/instagram-mcp/dist/index.js
```

Claude Desktop — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "command": "node",
      "args": ["/absolute/path/to/instagram-mcp/dist/index.js"]
    }
  }
}
```

The cached token is picked up automatically. To pass a token explicitly instead
— useful in CI or a container — set it in the server's environment, where it
takes precedence over the cache:

```json
{
  "mcpServers": {
    "instagram": {
      "command": "node",
      "args": ["/absolute/path/to/instagram-mcp/dist/index.js"],
      "env": { "INSTAGRAM_ACCESS_TOKEN": "IGAA..." }
    }
  }
}
```

Then ask: **"How many likes did my last 10 Instagram posts get?"**

## Configuration

| Variable | Purpose |
| --- | --- |
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived token. Overrides the cached file. |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Needed by `npm run auth`. |
| `INSTAGRAM_REDIRECT_URI` | Must match the app's registered URI exactly. |
| `INSTAGRAM_AUTH_MODE` | `instagram_login` (default) or `facebook_login`. |
| `INSTAGRAM_USER_ID` | Only for `facebook_login`, if discovery picks the wrong account. |
| `INSTAGRAM_GRAPH_VERSION` | Graph API version, default `v23.0`. |
| `INSTAGRAM_TOKEN_FILE` | Override the token cache location. |

### The two auth modes

**`instagram_login`** (default) uses `graph.instagram.com`. The token identifies
the account directly and no Facebook Page is involved. This is what you want.

**`facebook_login`** uses `graph.facebook.com` and requires your Instagram
account to be linked to a Facebook Page. Use it if you already manage the
account through a Page and have a working Facebook token. The server discovers
the Instagram account id through the linked Page automatically.

## Troubleshooting

Run `instagram_check_setup` first — it reports the active mode, whether a token
is present and when it expires, and whether the API answers.

| Symptom | Cause |
| --- | --- |
| Likes come back as `hidden` | Like counts are hidden on those posts, in the app under the post's ⋯ menu. |
| Every post shows `hidden` | The account is personal, not Business/Creator. See the top of this README. |
| "Session has expired" (code 190) | Token past its 60 days. `npm run auth -- --refresh`, or re-run `npm run auth`. |
| "Invalid platform app" during auth | The app id and the auth mode disagree — Instagram app id goes with `instagram_login`, Facebook app id with `facebook_login`. |
| Redirect URI mismatch | The value in `.env` must match the app's registered URI character for character, trailing slash included. |
| Insights are empty | Add the `instagram_business_manage_insights` scope and re-authorize. Insights are also unavailable for older media. |
| Rate limited (code 4 / 17 / 32) | Instagram throttles per app per hour. Wait, then use a smaller `scan`. |

## Development

```bash
npm test         # unit tests: aggregation, pagination, error mapping
npm run typecheck
npm run smoke    # builds, boots the server, speaks real MCP to it
npm run dev      # run from source
```

`src/stats.ts` (aggregation) and `src/format.ts` (rendering) are pure and carry
the unit tests. `src/instagram.ts` is the API client, tested against a fake
`fetch`. `src/index.ts` is only tool wiring.

## Privacy

The token is a bearer credential for your account. It lives in
`~/.config/instagram-mcp/token.json` at mode `0600` and is sent only to
`graph.instagram.com` / `graph.facebook.com`. Nothing is logged to stdout —
that channel carries the MCP protocol — and diagnostics on stderr never include
the token.
