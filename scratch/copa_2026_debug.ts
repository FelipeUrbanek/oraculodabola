import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function copa2026Debug() {
  console.log('🎬 DEBUG COPA 2026: Investigando as fontes...\n');

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Mostrar todas as categorias encontradas para ver se o nome está certo
  const categories = Array.from(new Set(newsList.map(n => n.category)));
  console.log(`📊 Categorias encontradas nesta rodada: ${categories.join(', ')}`);

  // 3. Filtrar Copa 2026
  const item = newsList.find(n => n.category === 'Copa 2026');

  if (!item) {
    console.log('❌ Nenhuma notícia de Copa 2026 passou pelos filtros (Frescor, Futebol, IA).');
    return;
  }

  console.log(`✅ Notícia Encontrada: ${item.title}`);
  console.log(`🔗 Fonte: ${item.link}`);

  try {
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    console.log('\n--- JSON COPA 2026 ---');
    console.log(JSON.stringify(processed, null, 2));
    
    console.log(`🎨 Renderizando arte...`);
    const paths = await generateImages(processed, item.imageUrl || null);
    console.log(`✅ Concluído: ${paths.feedPath}`);
  } catch (e) {
    console.error(`❌ Erro no processo:`, e);
  }
}

copa2026Debug();
