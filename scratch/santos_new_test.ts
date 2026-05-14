import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini, rankBestNews } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function santosTest() {
  console.log('🎬 Iniciando teste do SANTOS com Gemini 3.1 + Fallback 2.5...\n');

  const newsList = await fetchFootballNews();
  // Filtra apenas notícias que contenham "Santos"
  const santosNews = newsList.filter(n => n.title.toLowerCase().includes('santos') || n.category === 'Santos');

  if (santosNews.length === 0) {
    console.log('❌ Nenhuma notícia do Santos encontrada agora.');
    return;
  }

  console.log(`🔎 Encontradas ${santosNews.length} notícias do Santos. Escolhendo a melhor...`);
  const best = await rankBestNews(santosNews);
  
  console.log(`🏆 Notícia escolhida: ${best.title}`);
  
  const processed = await processNewsWithGemini(best.title, best.contentSnippet);
  console.log('\n--- JSON GERADO ---');
  console.log(JSON.stringify(processed, null, 2));

  console.log('\n🎨 Gerando arte final...');
  const paths = await generateImages(processed, best.imageUrl || null);
  console.log(`✨ Arte concluída: ${paths.feedPath}`);
}

santosTest();
