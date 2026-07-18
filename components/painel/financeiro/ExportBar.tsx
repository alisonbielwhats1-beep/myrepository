"use client";

import { Download, Printer } from "lucide-react";

/** Botões de exportação: CSV (abre no Excel) e impressão (Salvar como PDF). */
export default function ExportBar({ onExportarCSV }: { onExportarCSV: () => void }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button onClick={onExportarCSV} className="btn-ghost">
        <Download className="h-4 w-4" /> Exportar CSV
      </button>
      <button onClick={() => window.print()} className="btn-ghost">
        <Printer className="h-4 w-4" /> Imprimir / PDF
      </button>
    </div>
  );
}
