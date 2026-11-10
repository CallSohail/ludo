const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function fail(message) {
  console.error(`Production build blocked: ${message}`);
  process.exit(1);
}
if (!url || !key)
  fail(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Demo data must not be deployed as the live league.",
  );
try {
  if (new URL(url).protocol !== "https:")
    fail("The production Supabase URL must use HTTPS.");
} catch {
  fail("The production Supabase URL is invalid.");
}
if (key.startsWith("sb_secret_"))
  fail(
    "A secret key cannot be included in frontend assets. Use a publishable key.",
  );
if (!key.startsWith("sb_publishable_")) {
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    );
    if (payload.role !== "anon")
      fail(
        "Use a public anon or publishable key, never a privileged role key.",
      );
  } catch {
    fail("Use a Supabase publishable key or legacy public anon key.");
  }
}
console.log("Production frontend configuration validated.");
