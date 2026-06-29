// Temporary diagnostic for npm trusted-publishing (OIDC) failures.
// Prints the GitHub OIDC token claims (what GitHub asserts) and the npm
// token-exchange response (why the registry accepts or rejects it), mirroring
// what npm's lib/utils/oidc.js does. Never prints a real exchanged token.
const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!requestUrl || !requestToken) {
  console.log("No OIDC request env vars present (run inside GitHub Actions).");
  process.exit(0);
}

const packageName = process.argv[2] ?? "@wire-lang/core";
const audience = "npm:registry.npmjs.org";

const idRes = await fetch(`${requestUrl}&audience=${encodeURIComponent(audience)}`, {
  headers: { Authorization: `Bearer ${requestToken}`, Accept: "application/json" },
});
const idJson = await idRes.json();
const idToken = idJson.value;
console.log(`id-token request: HTTP ${idRes.status}`);

const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
console.log("=== OIDC token claims ===");
for (const key of [
  "sub",
  "repository",
  "repository_owner",
  "repository_visibility",
  "job_workflow_ref",
  "workflow_ref",
  "workflow",
  "environment",
  "ref",
  "event_name",
  "runner_environment",
]) {
  console.log(`  ${key}: ${payload[key]}`);
}

const escaped = packageName.replace("/", "%2f");
const exchangeUrl = `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${escaped}`;
console.log(`=== exchange POST ${exchangeUrl} ===`);
const exRes = await fetch(exchangeUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${idToken}` },
});
console.log(`exchange: HTTP ${exRes.status}`);
const body = await exRes.text();
if (exRes.ok) {
  console.log("exchange OK (token received; not printing it)");
} else {
  console.log(`exchange body: ${body}`);
}
