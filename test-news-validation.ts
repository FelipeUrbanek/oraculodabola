import { fetchFootballNews } from "./src/lib/news.js";
import { processNewsWithGemini } from "./src/lib/gemini.js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testValidation() {
  console.log("🔍 Iniciando Teste de Validação Local (5 notícias)...");

  try {
    const news = await fetchFootballNews();
    const toTest = news.slice(0, 15);

    let results = [];
    let count = 0;

    for (const item of toTest) {
      if (count >= 5) break;

      console.log(`\n--- Testando item ${count + 1} ---`);
      console.log(`Título: ${item.title}`);
      try {
        // Simulando o processamento para evitar o crash do Puppeteer/Gemini em lote se for o caso
        const processed = await processNewsWithGemini(
          item.title,
          item.contentSnippet,
        );
        results.push({
          title: item.title,
          status: "APROVADA",
          reason:
            "Passou em todas as travas de segurança e possui informações completas.",
          headline: processed.headline,
        });
        console.log(`✅ APROVADA: ${processed.headline}`);
        count++;
      } catch (error: any) {
        results.push({
          title: item.title,
          status: "REPROVADA",
          reason: error.message,
        });
        console.log(`❌ REPROVADA: ${error.message}`);
        count++;
      }
      // Pequena pausa entre itens para estabilidade
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("\n=== RELATÓRIO DE TESTE ===");
    results.forEach((res, i) => {
      console.log(`\n[${i + 1}] ${res.title}`);
      console.log(`Status: ${res.status}`);
      console.log(`Motivo: ${res.reason}`);
      if (res.headline) console.log(`Manchete: ${res.headline}`);
    });
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testValidation();
