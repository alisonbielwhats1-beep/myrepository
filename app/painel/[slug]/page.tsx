import { redirect } from "next/navigation";

// A raiz do painel redireciona para a Aba 1 (Recepção / Catraca).
export default function PainelIndex({ params }: { params: { slug: string } }) {
  redirect(`/painel/${params.slug}/recepcao`);
}
