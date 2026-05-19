import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { processCinemaNewsWithGemini } from "../src/lib/gemini";
import { generateImages } from "../src/lib/renderer";
import fs from "fs";
import path from "path";

async function renderAllCinemaLayouts() {
  console.log("🎬 Iniciando renderizador completo de todos os 10 layouts de Cinema...");

  const testNews = {
    title: "O Diabo Veste Prada 2: Sequência com Meryl Streep é aclamada e surpreende crítica em bilheterias",
    snippet: "A tão aguardada sequência de 'O Diabo Veste Prada' surpreendeu o público e críticos mundiais. Com o retorno da icônica Miranda Priestly interpretada por Meryl Streep, e das estrelas Emily Blunt e Anne Hathaway, o filme dirigido por David Frankel e roteirizado por Aline Brosh McKenna atinge números impressionantes e traz uma crítica moderna sobre o declínio do jornalismo de moda clássico na era das redes sociais e do fast fashion. Orçamento oficial avaliado em $150 milhões com bilheteria inicial de $120 milhões no primeiro final de semana."
  };

  console.log("🧠 1. Processando conteúdo com a IA (Gemini)...");
  try {
    const result = await processCinemaNewsWithGemini(testNews.title, testNews.snippet);
    
    // Imagem clássica de sala de cinema vintage de alta qualidade (background perfeito para testar opacidade, sombras e legibilidade)
    const testBackgroundUrl = "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=1080&h=1350";

    const artifactDir = "C:\\Users\\Felipe Urbanek\\.gemini\\antigravity\\brain\\23a8f762-4cf2-4692-8cce-f4da0bf71660";
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    const localProjectDir = path.join(process.cwd(), "posts", "previews");
    if (!fs.existsSync(localProjectDir)) {
      fs.mkdirSync(localProjectDir, { recursive: true });
    }

    console.log("🎨 2. Iniciando renderização em lote dos 10 layouts...");

    for (let layoutId = 1; layoutId <= 10; layoutId++) {
      console.log(`⏳ Renderizando Layout ${layoutId}/10...`);
      try {
        const renderPaths = await generateImages(result, testBackgroundUrl, "Cinema", layoutId, true);
        
        if (renderPaths.feedPath && fs.existsSync(renderPaths.feedPath)) {
          // Copia para Artefatos (Pre-visualização no chat)
          const destArtifact = path.join(artifactDir, `feed_layout_${layoutId}.jpg`);
          fs.copyFileSync(renderPaths.feedPath, destArtifact);

          // Copia para a pasta do projeto (Acesso local rápido)
          const destProject = path.join(localProjectDir, `feed_layout_${layoutId}.jpg`);
          fs.copyFileSync(renderPaths.feedPath, destProject);
          
          console.log(`   ✅ Layout ${layoutId} salvo nos dois destinos.`);
        }
      } catch (err: any) {
        console.error(`   ❌ Erro no Layout ${layoutId}:`, err.message);
      }
    }

    console.log("\n🏁 Todos os 10 layouts de Cinema foram gerados localmente e salvos nos seus artefatos!");

  } catch (e: any) {
    console.error("❌ Falha crítica no processamento da IA:", e.message);
  }
}

renderAllCinemaLayouts();
