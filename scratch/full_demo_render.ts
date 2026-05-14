import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fullDemoRender() {
  console.log('🎬 Iniciando MEGA DEMO: Gerando artes para times e termos...\n');

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  console.log(`✅ Recebidas ${newsList.length} notícias variadas.`);

  // 2. Agrupar por Categoria para garantir que temos uma de cada
  const categoryMap = new Map();
  for (const item of newsList) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, item);
    }
  }

  const itemsToRender = Array.from(categoryMap.values()).slice(0, 10); // Limitamos a 10 para o teste ser ágil
  console.log(`🖼️  Selecionamos ${itemsToRender.length} categorias diferentes para renderizar.`);

  const results = [];

  for (const item of itemsToRender) {
    console.log(`\n💎 Processando [${item.category}]: ${item.title}`);
    try {
      // 3. IA Process
      const processed = await processNewsWithGemini(item.title, item.contentSnippet);
      
      // 4. Render
      console.log(`🎨 Renderizando arte para ${item.category}...`);
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

  console.log('\n✨ TODAS AS ARTES FORAM GERADAS! ✨');
  console.log(JSON.stringify(results, null, 2));
}

fullDemoRender();
