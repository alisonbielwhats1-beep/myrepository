// Executor multiplataforma de testes sensíveis a fuso horário.
//
// Antes, os scripts test:fuso/test:periodo usavam `TZ=UTC node …` inline — a
// sintaxe de env do shell POSIX, que NÃO funciona no cmd.exe do Windows (o
// comando de teste geral falhava por isso). Este runner roda o mesmo arquivo de
// teste uma vez por fuso, setando TZ no ambiente do processo filho via
// child_process — funciona igual em Windows, macOS e Linux, sem dependência
// nova (nada de cross-env).
//
// Uso:  node scripts/run-tz.mjs <arquivo-de-teste> [TZ ...]
// Sem TZs explícitos, roda o trio padrão de fusos usado na suíte.
import { spawnSync } from "node:child_process";

const [, , testFile, ...zonesArg] = process.argv;

if (!testFile) {
  console.error("uso: node scripts/run-tz.mjs <arquivo-de-teste> [TZ ...]");
  process.exit(2);
}

const zonas = zonesArg.length
  ? zonesArg
  : ["UTC", "Asia/Tokyo", "America/Sao_Paulo"];

for (const tz of zonas) {
  const r = spawnSync(process.execPath, [testFile], {
    stdio: "inherit",
    env: { ...process.env, TZ: tz },
  });
  if (r.status !== 0) {
    console.error(`\n[run-tz] falhou em TZ=${tz} (${testFile})`);
    process.exit(r.status ?? 1);
  }
}
