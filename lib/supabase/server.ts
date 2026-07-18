import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Copie .env.local.example ` +
        `para .env.local e preencha com as chaves do seu projeto Supabase.`
    );
  }
  return value;
}

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Roda com a sessão do cookie do usuário atual — políticas de RLS
 * multi-tenant se aplicam automaticamente a toda consulta feita com ele.
 */
export function createClient() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const anon = envOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component sem permissão de escrita de cookie — ignorável
          // porque o middleware já cuida do refresh de sessão.
        }
      },
    },
  });
}

/**
 * Cliente com a service role key — ignora RLS e pode usar a Admin API do
 * Supabase Auth (criar usuários, etc). NUNCA importe isto em um Client
 * Component; use apenas dentro de Server Actions que já validaram permissão
 * (ex: só o "dono" pode chamar quem cria isto).
 */
export function createServiceRoleClient() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = envOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  return createSupabaseClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
