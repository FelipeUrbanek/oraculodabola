import { generateImages } from './src/lib/renderer';
import { ProcessedContent } from './src/lib/gemini';

async function runMegaLab() {
  const mockNews: ProcessedContent = {
    headline: "FLAMENGO MIRA JOIA DO CRUZEIRO!",
    summary: "O Flamengo, por indicação de Carlos Eduardo Jardim, prepara uma investida para contratar o promissor lateral-esquerdo Kaiki, destaque do Cruzeiro.",
    caption: "O mercado está fervendo! 🔥",
    hashtags: ["Flamengo", "Cruzeiro", "MercadoDaBola"],
    category: "MERCADO",
    shouldCreateStory: true,
    imageKeywords: "flamengo cruzeiro football"
  };

  const imageUrl = "https://s2-ge.glbimg.com/dLF68F-zTsLg5a6a2B14Iq4giBw=/3000x0/filters:format(jpeg)/https://i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2026/z/f/BvqJQESBeJ9rOQZaIrdQ/agif26051222252823.jpg";

  console.log("🧪 Iniciando MEGA-LABORATÓRIO v4.0 (20 renders)...");

  for (let i = 1; i <= 10; i++) {
    console.log(`🎨 Renderizando Variação #${i}...`);
    try {
      await generateImages(mockNews, imageUrl, String(i));
      console.log(`✅ Variação #${i} concluída.`);
    } catch (error) {
      console.error(`❌ Erro na Variação #${i}:`, error);
    }
  }

  console.log("\n🚀 Laboratório concluído! Verifique a pasta posts/...");
}

runMegaLab();
