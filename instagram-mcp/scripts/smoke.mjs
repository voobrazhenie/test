/**
 * End-to-end check: boots the built server over stdio, speaks real MCP to it,
 * and exercises a tool. Run with `npm run smoke` after `npm run build`.
 *
 * Deliberately runs with no credentials, so it also proves the server starts
 * and answers cleanly when Instagram is not configured yet.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_TOOLS = [
  "instagram_likes_summary",
  "instagram_recent_posts",
  "instagram_top_posts",
  "instagram_post",
  "instagram_find_posts",
  "instagram_account",
  "instagram_check_setup",
];

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`✓ ${message}`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(root, "dist", "index.js")],
  // Force the unconfigured path regardless of the developer's own setup.
  env: {
    PATH: process.env.PATH ?? "",
    INSTAGRAM_ACCESS_TOKEN: "",
    INSTAGRAM_TOKEN_FILE: join(root, "node_modules", ".cache", "smoke-token-does-not-exist.json"),
  },
  stderr: "pipe",
});

const client = new Client({ name: "instagram-mcp-smoke", version: "0.1.0" });

try {
  await client.connect(transport);
  assert(true, "server started and completed the MCP handshake");

  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  assert(
    EXPECTED_TOOLS.every((name) => names.includes(name)),
    `all ${EXPECTED_TOOLS.length} tools are advertised: ${names.join(", ")}`,
  );

  const described = tools.every((tool) => tool.description && tool.description.length > 30);
  assert(described, "every tool carries a usable description");

  const summaryTool = tools.find((tool) => tool.name === "instagram_likes_summary");
  assert(
    summaryTool?.inputSchema?.properties?.scan !== undefined,
    "instagram_likes_summary exposes its `scan` parameter in the schema",
  );

  const setup = await client.callTool({ name: "instagram_check_setup", arguments: {} });
  const setupText = setup.content.map((part) => part.text ?? "").join("\n");
  assert(
    setupText.includes("Token present: **no**"),
    "instagram_check_setup reports the missing token instead of crashing",
  );
  assert(
    setupText.includes("npm run auth"),
    "instagram_check_setup points at the setup path",
  );

  const summary = await client.callTool({
    name: "instagram_likes_summary",
    arguments: { scan: 5 },
  });
  const summaryText = summary.content.map((part) => part.text ?? "").join("\n");
  assert(
    summary.isError === true && summaryText.startsWith("No Instagram access token found."),
    "a data tool fails gracefully with a setup hint when unconfigured",
  );
  assert(
    !summaryText.includes("Instagram API error"),
    "a missing token reads as a setup gap, not as an API failure",
  );

  console.log("\nSmoke test passed.\n");
} finally {
  await client.close().catch(() => {});
}
