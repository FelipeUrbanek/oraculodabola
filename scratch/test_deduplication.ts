import { filterDuplicateThemes } from "../src/lib/gemini";

async function runTest() {
  console.log("🧪 Testando Novo Mecanismo de De-duplicação Local de Títulos...");

  // Lista de títulos que foram postados anteriormente ou que são muito semelhantes
  const historyTitles = [
    "Brasil tem o maior número de convocados \"caseiros\" desde 2002",
    "Convocado, Neymar não deve mais jogar pelo Santos até a Copa",
    "Pai de Neymar celebra: \"Trabalhou por este momento\""
  ];

  // Novas candidatas que surgem do scraper e devem ser de-duplicadas (rejeitadas)
  const candidates = [
    { title: "Neymar supera dificuldades e é convocado para Copa do Mundo 2026" },
    { title: "Com Neymar na lista, Carlo Ancelotti fecha convocados para a Copa" },
    { title: "Santos tem atacante convocado por Ancelotti para a Copa de 2026" },
    { title: "Carille prepara treino tático visando o próximo clássico do Santos" } // Este deve ser APROVADO pois é de outro tema (Santos / Carille)
  ];

  console.log("\n📚 Histórico Recente:");
  historyTitles.forEach(t => console.log(`   - ${t}`));

  console.log("\n📡 Novas Candidatas a serem analisadas:");
  candidates.forEach((c, idx) => console.log(`   [${idx}] ${c.title}`));

  console.log("\n🧠 Executando filterDuplicateThemes...");
  const approvedIndices = await filterDuplicateThemes(candidates, historyTitles);

  console.log("\n📋 Resultado:");
  candidates.forEach((c, idx) => {
    const isApproved = approvedIndices.includes(idx);
    console.log(`   [${idx}] ${c.title} -> ${isApproved ? "✅ APROVADA" : "❌ REPROVADA (Duplicada)"}`);
  });

  const hasOnlyCarilleApproved = approvedIndices.length === 1 && approvedIndices[0] === 3;
  if (hasOnlyCarilleApproved) {
    console.log("\n✨ SUCESSO ABSOLUTO! Apenas a notícia do Carille foi aprovada, todas as notícias de Neymar duplicadas foram de-duplicadas com perfeição!");
  } else {
    console.log("\n⚠️ ALERTA: A de-duplicação local ou semântica permitiu notícias redundantes.");
  }
}

runTest();
