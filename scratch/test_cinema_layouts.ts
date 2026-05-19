import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fetchCinemaNews } from "../src/lib/news";
import { processCinemaNewsWithGemini } from "../src/lib/gemini";
import { generateImages } from "../src/lib/renderer";
import fs from "fs";
import path from "path";

async function testCinemaLayouts() {
  console.log("🎬 [TEST SUITE] Iniciando Teste de Layouts de Cinema...");

  // 1. Tentar coletar notícias reais de cinema
  let newsItem = {
    title: "Vingadores: Apocalipse ganha primeiro trailer espetacular com Robert Downey Jr",
    contentSnippet: "A Marvel Studios surpreendeu o mundo hoje ao lançar o primeiro trailer oficial de Vingadores: Apocalipse. Robert Downey Jr retorna triunfante como Doutor Destino, liderando um elenco estelar. O filme estreia oficialmente em maio de 2026 nos cinemas de todo o mundo, com orçamento estimado em $250 milhões.",
    imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1080&h=1350",
    category: "Filmes"
  };

  try {
    const news = await fetchCinemaNews();
    if (news && news.length > 0) {
      const bestReal = news.find(n => n.imageUrl);
      if (bestReal) {
        newsItem = {
          title: bestReal.title,
          contentSnippet: bestReal.contentSnippet,
          imageUrl: bestReal.imageUrl || newsItem.imageUrl,
          category: bestReal.category
        };
        console.log(`✅ Usando notícia real encontrada: "${newsItem.title}"`);
      }
    }
  } catch (e) {
    console.log("⚠️ Falha ao raspar notícias reais. Usando mock altamente realista do Vingadores...");
  }

  // 2. Processar com a persona do Gemini
  console.log("🧠 Processando conteúdo com a Persona de Cinema do Gemini...");
  let processed;
  try {
    processed = await processCinemaNewsWithGemini(newsItem.title, newsItem.contentSnippet);
    // Garantir que a categoria seja uma das válidas de cinema
    processed.category = newsItem.category as any;
    processed.shouldCreateStory = true;
    console.log("✅ Conteúdo gerado com sucesso!");
    console.log(`   - Headline: "${processed.headline}"`);
    console.log(`   - Summary: "${processed.summary}"`);
    console.log(`   - Categoria: "${processed.category}"`);
  } catch (e: any) {
    console.error("❌ Falha no Gemini:", e.message);
    return;
  }

  // 3. Renderizar todos os 10 layouts
  const testOutputDir = path.join(process.cwd(), "posts", "test_cinema");
  if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });

  console.log("\n🎨 Renderizando as artes para os 10 Estilos Cinematográficos...");
  
  for (let layout = 1; layout <= 10; layout++) {
    console.log(`📸 [Layout ${layout}/10] Renderizando...`);
    try {
      const { feedPath, storyPath } = await generateImages(
        processed,
        newsItem.imageUrl,
        "",
        layout
      );

      // Copiar para a pasta de testes com o número do layout
      const finalFeedDest = path.join(testOutputDir, `feed_layout_${layout}.jpg`);
      fs.copyFileSync(feedPath, finalFeedDest);
      console.log(`   ✅ Feed Salvo em: ${finalFeedDest}`);

      if (storyPath && layout === 1) {
        const finalStoryDest = path.join(testOutputDir, `story_layout_1.jpg`);
        fs.copyFileSync(storyPath, finalStoryDest);
        console.log(`   ✅ Story Salvo em: ${finalStoryDest}`);
      }
    } catch (e: any) {
      console.error(`   ❌ Falha ao renderizar Layout ${layout}:`, e.message);
    }
  }

  console.log(`\n🏁 [SUCESSO] Teste de layouts concluído! Todas as 10 artes de feed estão disponíveis em: ${testOutputDir}`);
}

testCinemaLayouts();
