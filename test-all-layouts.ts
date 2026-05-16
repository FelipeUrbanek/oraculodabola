import { generateImages } from './src/lib/renderer';

async function testAll() {
  const content = {
    headline: "ATOR DE TED LASSO VIRA JOGADOR PROFISSIONAL",
    summary: "Desta vez é verdade! Phil Dunster assina seu primeiro contrato oficial e choca o mundo do futebol.",
    caption: "A ficção virou realidade...",
    hashtags: ["#TedLasso", "#Futebol", "#PremierLeague"],
    category: "URGENTE" as const,
    shouldCreateStory: false,
    imageKeywords: "football match action"
  };

  const bgImage = "https://noticiasdatv.uol.com.br/media/_versions/noticias/ted-lasso-phil-dunster-jamie-tartt-apple-tv-reproducao_fixed_large.jpg";

  console.log("🧪 Gerando vitrine de layouts com a notícia do Ted Lasso...");

  for (let i = 1; i <= 5; i++) {
    console.log(`🖼️ Gerando Layout #${i}...`);
    await generateImages(content, bgImage, String(i));
  }

  console.log("\n✅ Todas as versões foram geradas na pasta 'posts'!");
}

testAll();
