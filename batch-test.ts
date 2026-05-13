import { fetchFootballNews } from './src/lib/news.js';
import { processNewsWithGemini } from './src/lib/gemini.js';
import { generateImages } from './src/lib/renderer.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function batchTest() {
  console.log('🏁 Iniciando BATCH TEST (4 notícias)...');

  try {
    const news = await fetchFootballNews();
    console.log(`Encontradas ${news.length} notícias para processar.`);

    for (let i = 0; i < news.length; i++) {
      try {
        const item = news[i];
        console.log(`\n--- [POST ${i + 1}/4] ---`);
        console.log(`📰 Notícia: ${item.title}`);
        console.log(`🔗 Fonte: ${item.link}`);
        console.log(`🖼️ Imagem: ${item.imageUrl || 'Nenhuma encontrada (usando fallback)'}`);

        console.log('🧠 Gemini processando...');
        const content = await processNewsWithGemini(item.title, item.contentSnippet);

        console.log('🎨 Renderizando com o novo motor v4.1...');
        const { feedPath } = await generateImages(content, item.imageUrl || null);

        console.log(`✅ Gerado: ${feedPath}`);
      } catch (postError) {
        console.error(`❌ Falha no POST ${i + 1}:`, postError);
      }
    }

    console.log('\n✨ Batch Test concluído!');
    
  } catch (error) {
    console.error('❌ Erro no batch test:', error);
  }
}

batchTest();
