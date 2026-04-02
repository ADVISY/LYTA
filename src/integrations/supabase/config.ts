const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL: define VITE_SUPABASE_URL.");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing Supabase publishable key: define VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY."
  );
}

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
} as const;
