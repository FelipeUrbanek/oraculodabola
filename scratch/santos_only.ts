import { fetchFootballNews } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function santosOnly() {
  console.log('🎬 Buscando notícia exclusiva do SANTOS...\n');

  // 1. Fetch News
  const newsList = await fetchFootballNews();
  
  // 2. Filtrar Santos
  const item = newsList.find(n => n.category === 'Santos');

  if (!item) {
    console.log('⚠️ Nenhuma notícia recente encontrada para o Santos nos filtros atuais.');
    return;
  }

  console.log(`💎 Notícia Encontrada: ${item.title}`);
  console.log(`📅 Data: ${item.pubDate}`);

  try {
    // 3. IA Process
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    
    // 4. Mostrar JSON
    console.log('\n--- JSON DE PROCESSAMENTO ---');
    console.log(JSON.stringify(processed, null, 2));
    console.log('----------------------------\n');

    // 5. Render
    console.log(`🎨 Renderizando arte para Santos...`);
    const paths = await generateImages(processed, item.imageUrl || null);
    
    console.log(`✅ Arte gerada: ${paths.feedPath}`);
    
    // Salvar JSON para fácil visualização no log
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'santos_meta.json'), JSON.stringify(processed, null, 2));
  } catch (e) {
    console.error(`❌ Erro no processo:`, e);
  }
}

santosOnly();
