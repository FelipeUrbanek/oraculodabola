import 'dotenv/config';
import { fetchFootballNews } from './src/lib/news';
import { processNewsWithGemini } from './src/lib/gemini';
import { generateImages } from './src/lib/renderer';
import { postToInstagram } from './src/lib/instagram';

async function testRealPost() {
  console.log("🚀 Iniciando Teste de Postagem Real...");
  
  try {
    // 1. Pegar uma notícia (Aleatória entre as top 5 para variar o teste)
    const news = await fetchFootballNews();
    const randomIndex = Math.floor(Math.random() * Math.min(news.length, 5));
    const item = news[randomIndex];
    console.log(`🗞 Notícia selecionada (#${randomIndex + 1}): ${item.title}`);

    // 2. Processar com IA
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    console.log(`🔮 Manchete do Oráculo: ${processed.headline}`);
    console.log(`📝 Legenda Gerada:\n${processed.caption}\n`);

    // 3. Gerar Imagem
    const paths = await generateImages(processed, item.imageUrl || null, item.category);
    console.log(`🎨 Imagem gerada: ${paths.feedPath}`);

    // 4. POSTAR!
    console.log("📤 Tentando postar no Instagram...");
    await postToInstagram(paths.feedPath, `${processed.caption}\n\n${processed.hashtags.join(' ')}`);

    console.log("🏁 Teste finalizado. Confira seu Instagram!");
  } catch (error: any) {
    console.error("❌ O teste falhou:", error.message);
  }
}

testRealPost();
