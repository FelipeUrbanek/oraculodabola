import { generateImages } from "../src/lib/renderer";
import { processNewsWithGemini } from "../src/lib/gemini";
import fs from "fs";
import path from "path";

async function renderLocalFeed() {
  const feedPath = "local_feed.json";
  if (!fs.existsSync(feedPath)) {
    console.error("❌ local_feed.json não encontrado. Rode o script de geração primeiro.");
    return;
  }

  const feed = JSON.parse(fs.readFileSync(feedPath, "utf-8"));
  const outputDir = "rendered_feed";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  console.log(`🎨 Iniciando renderização local para ${Math.min(feed.length, 3)} notícias...`);

  for (let i = 0; i < Math.min(feed.length, 3); i++) {
    const item = feed[i];
    console.log(`\n⏳ Renderizando [${i+1}/3]: ${item.title}`);

    try {
      const processed = await processNewsWithGemini(
        item.title,
        "", // Usando apenas o título para o teste rápido ou snippet se houver
        item.category
      );

      // Se foi rejeitado, pula
      if (processed.headline === "REJEITADO") {
        console.warn(`⚠️ Notícia rejeitada: ${processed.caption}`);
        continue;
      }

      const paths = await generateImages(processed, item.imageUrl || null, processed.mainTeam || item.category);
      
      // Mover para pasta local
      const fileName = `post_${i+1}_${item.category}.png`;
      const finalPath = path.join(outputDir, fileName);
      fs.copyFileSync(paths.feedPath, finalPath);
      
      console.log(`✅ Imagem gerada: ${finalPath}`);
    } catch (e: any) {
      console.error(`❌ Erro ao renderizar item ${i+1}:`, e.message);
    }
  }

  console.log("\n🚀 Renderização concluída! Verifique a pasta 'rendered_feed'.");
}

renderLocalFeed();
