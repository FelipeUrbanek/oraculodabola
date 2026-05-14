import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function brasileiraoTest() {
  console.log('🎬 Testando BRASILEIRÃO via RSSHub...\n');

  const newsList = await fetchFootballNews();
  const item = newsList.find(n => n.category === 'Brasileirão');

  if (!item) {
    console.log('❌ O RSSHub não conseguiu ler o Brasileirão agora (ou não há notícias novas).');
    return;
  }

  console.log(`✅ Sucesso! Notícia encontrada: ${item.title}`);
  
  const processed = await processNewsWithGemini(item.title, item.contentSnippet);
  console.log('\n--- JSON BRASILEIRÃO ---');
  console.log(JSON.stringify(processed, null, 2));

  console.log('\n🎨 Gerando arte...');
  const paths = await generateImages(processed, item.imageUrl || null);
  console.log(`✨ Arte concluída: ${paths.feedPath}`);
}

brasileiraoTest();
