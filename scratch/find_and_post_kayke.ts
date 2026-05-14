import { fetchFootballNews, NewsItem } from '../src/lib/news';
import { processNewsWithGemini } from '../src/lib/gemini';
import { generateImages } from '../src/lib/renderer';
import { postToInstagram } from '../src/lib/instagram';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function findAndPostKayke() {
  console.log(`🎬 Iniciando BUSCA AUTOMÁTICA POR KAYKE/FORTALEZA...\n`);

  // 1. Fetch News (General)
  let newsList = await fetchFootballNews();
  
  // 2. Procurar especificamente por Kayke ou Fortaleza
  let kaykeNews = newsList.find(n => 
    n.title.toLowerCase().includes('kayke') || 
    (n.category === 'Fortaleza' && n.title.toLowerCase().includes('saída'))
  );

  // Fallback: Busca direta se não achou no agregador geral
  if (!kaykeNews) {
    console.log('🔍 Kayke não encontrado no fluxo geral. Tentando busca direta...');
    const { fetchGoogleNews } = await import('../src/lib/news');
    const directNews = await fetchGoogleNews('Fortaleza atacante saída Carpini', 'Fortaleza');
    kaykeNews = directNews.find(n => n.title.includes('Sem espaço com Carpini'));
  }

  if (!kaykeNews) {
    console.log('⚠️ Nenhuma notícia do Kayke encontrada mesmo na busca direta.');
    return;
  }

  const item = kaykeNews;
  console.log(`\n💎 Encontrado no Sistema: [${item.category}]: ${item.title}`);
  
  try {
    // 3. IA Process (Usando a nova lógica protegida)
    const processed = await processNewsWithGemini(item.title, item.contentSnippet);
    console.log(`🔮 Manchete Gerada: ${processed.headline}`);
    
    // 4. Render
    console.log(`🎨 Renderizando arte...`);
    const paths = await generateImages(processed, item.imageUrl || null);
    
    // 5. Post (Se for o que o usuário quer)
    console.log(`📤 Publicando post oficial...`);
    const caption = `${processed.caption}\n\n${processed.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`;
    await postToInstagram(paths.feedPath, caption);
    
    console.log(`✅ Concluído com sucesso!`);
  } catch (e: any) {
    console.error(`❌ Erro no processo:`, e.message);
  }
}

findAndPostKayke();
