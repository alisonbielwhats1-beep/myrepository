import AlunoTabBar from "@/components/aluno/AlunoTabBar";

export default function AlunoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <div className="min-h-dvh bg-ink-950 bg-grid-fade">
      <div className="relative mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6">
        {children}
      </div>
      <AlunoTabBar slug={params.slug} />
    </div>
  );
}
