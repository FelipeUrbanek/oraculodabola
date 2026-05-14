import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function googleNewsTest() {
  console.log('🎬 Testando BRASILEIRÃO via GOOGLE NEWS (RSS)...\n');

  // O motor fetchFootballNews já tenta o Google News se o Terra falhar
  const newsList = await fetchFootballNews();
  
  // Vamos ver se ele encontrou o Brasileirão via Google
  const item = newsList.find(n => n.category === 'Brasileirão');

  if (!item) {
    console.log('❌ Nem o Google News encontrou notícias nas últimas 24h para o Brasileirão.');
    return;
  }

  console.log(`✅ Sucesso! Google News encontrou: ${item.title}`);
  
  const processed = await processNewsWithGemini(item.title, item.contentSnippet);
  console.log('\n--- JSON BRASILEIRÃO ---');
  console.log(JSON.stringify(processed, null, 2));

  console.log('\n🎨 Gerando arte...');
  const paths = await generateImages(processed, item.imageUrl || null);
  console.log(`✨ Arte concluída: ${paths.feedPath}`);
}

googleNewsTest();
