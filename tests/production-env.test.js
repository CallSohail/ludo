import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (url, key) =>
  spawnSync(process.execPath, ["scripts/check-production-env.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    },
  });
const token = (role) =>
  `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.test`;
test("production build rejects missing backend configuration", () =>
  assert.equal(run("", "").status, 1));
test("production build rejects non-HTTPS backend URLs", () =>
  assert.equal(run("http://example.test", "sb_publishable_test").status, 1));
test("production build rejects secret and service-role frontend keys", () => {
  assert.equal(run("https://example.test", "sb_secret_test").status, 1);
  assert.equal(run("https://example.test", token("service_role")).status, 1);
});
test("production build accepts publishable frontend configuration", () =>
  assert.equal(run("https://example.test", "sb_publishable_test").status, 0));
test("production build retains support for legacy public anon keys", () =>
  assert.equal(run("https://example.test", token("anon")).status, 0));
