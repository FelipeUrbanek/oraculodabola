import { fetchFootballNews } from './src/lib/news.js';
import { processNewsWithGemini } from './src/lib/gemini.js';
import { generateImages } from './src/lib/renderer.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🚀 Iniciando teste de geração visual...');

  try {
    const news = await fetchFootballNews();
    if (news.length === 0) {
      console.log('Nenhuma notícia encontrada no momento.');
      return;
    }

    const item = news[0];
    console.log(`📝 Notícia selecionada: ${item.title}`);

    console.log('🧠 Gemini está pensando no design...');
    const content = await processNewsWithGemini(item.title, item.contentSnippet);

    console.log('🎨 Renderizando imagens premium...');
    const { feedPath, storyPath } = await generateImages(content, item.imageUrl);

    console.log('\n✅ SUCESSO!');
    console.log(`📸 Imagem do Feed gerada: ${feedPath}`);
    console.log(`📱 Imagem do Story gerada: ${storyPath}`);
    console.log('\nAbra esses arquivos na sua pasta para ver o resultado!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

test();
