// =====================================================================
// Arcane HQ — admin-site config (admin.arcaneleadsolutions.com)
// Standalone platform/business console. Same Supabase project as the agent
// app (cdctxwbkpjdkytwstvoq) — it reads across ALL tenants. Access is gated
// to agents.is_platform_admin (RLS on the platform_* RPCs + a client check).
// Supabase Auth, own login. Anon key is public by design; RLS protects data.
// NEVER put the service_role key here.
// =====================================================================
window.APP_CONFIG = {
  MODE: "admin",
  SUPABASE_URL: "https://cdctxwbkpjdkytwstvoq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY3R4d2JrcGpka3l0d3N0dm9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDExMjgsImV4cCI6MjA5ODQxNzEyOH0.va493TeFtkQzBddGH4l1rJDMrmSrTO0g4Vpxd6L8XsM"
};
