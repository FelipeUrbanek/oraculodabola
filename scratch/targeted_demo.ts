import { fetchFootballNews, NewsItem } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function targetedDemo() {
  const targets = ['Corinthians', 'São Paulo', 'Santos'];
  console.log(`🎬 Iniciando DEMO ALVO: ${targets.join(', ')}...\n`);

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Filtrar apenas os alvos
  const targetNews = targets.map(t => newsList.find(n => n.category === t)).filter((n): n is NewsItem => !!n);

  if (targetNews.length === 0) {
    console.log('⚠️ Nenhuma notícia recente encontrada para esses times nos filtros atuais.');
    return;
  }

  const results = [];

  for (const item of targetNews) {
    console.log(`\n💎 Processando [${item.category}]: ${item.title}`);
    try {
      // 3. IA Process
      const processed = await processNewsWithGemini(item.title, item.contentSnippet);
      
      // 4. Render
      console.log(`🎨 Renderizando arte corrigida para ${item.category}...`);
      const paths = await generateImages(processed, item.imageUrl || null);
      
      results.push({
        category: item.category,
        headline: processed.headline,
        image: paths.feedPath
      });
      
      console.log(`✅ Concluído: ${path.basename(paths.feedPath)}`);
    } catch (e) {
      console.error(`❌ Erro ao renderizar ${item.category}:`, e);
    }
  }

  console.log('\n✨ ARTES ALVO GERADAS! ✨');
  console.log(JSON.stringify(results, null, 2));
}

targetedDemo();
