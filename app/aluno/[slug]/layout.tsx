export const dynamic = "force-dynamic";

export default function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink-950 bg-grid-fade">
      <div className="relative mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6">
        {children}
      </div>
    </div>
  );
}
