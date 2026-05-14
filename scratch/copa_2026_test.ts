import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function copa2026Demo() {
  console.log('🎬 Buscando notícia fresca da COPA 2026 (Ano 2026)...\n');

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Filtrar Copa 2026
  const item = newsList.find(n => n.category === 'Copa 2026');

  if (!item) {
    console.log('⚠️ Nenhuma notícia recente (das últimas 2h) encontrada para a Copa 2026.');
    // Fallback para mostrar que o sistema está filtrando certo
    return;
  }

  console.log(`💎 Notícia Encontrada: ${item.title}`);

  try {
    // 3. IA Process
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    
    // 4. Mostrar JSON
    console.log('\n--- JSON COPA 2026 ---');
    console.log(JSON.stringify(processed, null, 2));
    console.log('----------------------------\n');

    // 5. Render
    console.log(`🎨 Renderizando arte premium...`);
    const paths = await generateImages(processed, item.imageUrl || null);
    
    console.log(`✅ Arte gerada: ${paths.feedPath}`);
  } catch (e) {
    console.error(`❌ Erro no processo:`, e);
  }
}

copa2026Demo();
