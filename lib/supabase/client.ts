"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para uso no browser (Client Components). */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas."
    );
  }
  return createBrowserClient(url, anon);
}
