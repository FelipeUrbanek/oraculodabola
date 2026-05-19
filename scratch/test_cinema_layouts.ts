import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { processCinemaNewsWithGemini } from "../src/lib/gemini";
import { generateImages } from "../src/lib/renderer";
import fs from "fs";
import path from "path";

async function runLocalCinemaDesignTest() {
  console.log("🎬 Iniciando renderizador de teste local de Cinema...");

  const testNews = {
    title: "O Diabo Veste Prada 2: Sequência com Meryl Streep é aclamada e surpreende crítica em bilheterias",
    snippet: "A tão aguardada sequência de 'O Diabo Veste Prada' surpreendeu o público e críticos mundiais. Com o retorno da icônica Miranda Priestly interpretada por Meryl Streep, e das estrelas Emily Blunt e Anne Hathaway, o filme dirigido por David Frankel e roteirizado por Aline Brosh McKenna atinge números impressionantes e traz uma crítica moderna sobre o declínio do jornalismo de moda clássico na era das redes sociais e do fast fashion. Orçamento oficial avaliado em $150 milhões com bilheteria inicial de $120 milhões no primeiro final de semana."
  };

  console.log("🧠 1. Enviando notícia para a IA (Gemini) processar com os novos prompts de parágrafo...");
  try {
    const result = await processCinemaNewsWithGemini(testNews.title, testNews.snippet);
    
    console.log("\n==================================================");
    console.log("✍️ CAPTION GERADO PELA IA COM OS NOVOS PARÁGRAFOS:");
    console.log("==================================================");
    console.log(result.caption);
    console.log("==================================================\n");

    const newsImageUrl = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1080&h=1350"; // Imagem de cinema clássica no Unsplash

    console.log("🎨 2. Renderizando arte local do Feed usando o Layout 3 (Glassmorphism + Roxo Crítica)...");
    const feedPaths3 = await generateImages(result, newsImageUrl, "Cinema", 3, true);

    console.log("🎨 3. Renderizando arte local do Feed usando o Layout 6 (Glassmorphism + Roxo Crítica)...");
    const feedPaths6 = await generateImages(result, newsImageUrl, "Cinema", 6, true);

    // Destino final nos artefatos da conversa para o usuário ver
    const artifactDir = "C:\\Users\\Felipe Urbanek\\.gemini\\antigravity\\brain\\23a8f762-4cf2-4692-8cce-f4da0bf71660";
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    if (feedPaths3.feedPath && fs.existsSync(feedPaths3.feedPath)) {
      const dest3 = path.join(artifactDir, "feed_layout_glass_3.jpg");
      fs.copyFileSync(feedPaths3.feedPath, dest3);
      console.log(`✅ Arte do Layout 3 copiada para Artefatos: ${dest3}`);
    }

    if (feedPaths6.feedPath && fs.existsSync(feedPaths6.feedPath)) {
      const dest6 = path.join(artifactDir, "feed_layout_glass_6.jpg");
      fs.copyFileSync(feedPaths6.feedPath, dest6);
      console.log(`✅ Arte do Layout 6 copiada para Artefatos: ${dest6}`);
    }

    console.log("\n🏁 Renderização local bem-sucedida! Veja as imagens geradas nos artefatos.");

  } catch (e: any) {
    console.error("❌ Falha no teste:", e.message);
  }
}

runLocalCinemaDesignTest();
