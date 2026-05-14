import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function copaDoBrasilDemo() {
  console.log('🎬 Buscando notícia da COPA DO BRASIL...\n');

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Filtrar Copa do Brasil
  const item = newsList.find(n => n.category === 'Copa do Brasil');

  if (!item) {
    console.log('⚠️ Nenhuma notícia recente encontrada para a Copa do Brasil.');
    return;
  }

  console.log(`💎 Notícia Encontrada: ${item.title}`);

  try {
    // 3. IA Process
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    
    // 4. Mostrar JSON
    console.log('\n--- JSON COPA DO BRASIL ---');
    console.log(JSON.stringify(processed, null, 2));
    console.log('----------------------------\n');

    // 5. Render
    console.log(`🎨 Renderizando arte corrigida...`);
    const paths = await generateImages(processed, item.imageUrl || null);
    
    console.log(`✅ Arte gerada: ${paths.feedPath}`);
    
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'copa_meta.json'), JSON.stringify(processed, null, 2));
  } catch (e) {
    console.error(`❌ Erro no processo:`, e);
  }
}

copaDoBrasilDemo();
