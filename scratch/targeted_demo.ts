import { fetchFootballNews, NewsItem } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function targetedDemo() {
  const targets = ['Fortaleza', 'Mercado da Bola'];
  console.log(`🎬 Iniciando BUSCA POR KAYKE/FORTALEZA...\n`);

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Procurar especificamente por Kayke ou Fortaleza
  const kaykeNews = newsList.find(n => 
    n.title.toLowerCase().includes('kayke') || 
    (n.category === 'Fortaleza' && n.title.toLowerCase().includes('saída'))
  );

  if (!kaykeNews) {
    console.log('⚠️ Nenhuma notícia do Kayke encontrada no agregador automático.');
    // Tentar imprimir as de Fortaleza para ver o que tem
    const fortalezaNews = newsList.filter(n => n.category === 'Fortaleza');
    console.log('Notícias de Fortaleza encontradas:', fortalezaNews.map(n => n.title));
    return;
  }

  const item = kaykeNews;
  console.log(`\n💎 Encontrado: [${item.category}]: ${item.title}`);

  const results = [];

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

  console.log('\n✨ ARTES ALVO GERADAS! ✨');
  console.log(JSON.stringify(results, null, 2));
}

targetedDemo();
