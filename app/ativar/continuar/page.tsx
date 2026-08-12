import { redirect } from "next/navigation";

/**
 * Destino interno do callback (OAuth e confirmação de e-mail) durante a
 * ativação. Quando chega aqui a sessão já está estabelecida; delega para
 * /ativar, que — com o usuário autenticado — finaliza o vínculo de forma
 * idempotente e mostra sucesso/conflito. Mantido como rota separada apenas
 * para ser um `next` fixo e previsível na allow-list do Supabase.
 */
export default function AtivarContinuarPage() {
  redirect("/ativar");
}
