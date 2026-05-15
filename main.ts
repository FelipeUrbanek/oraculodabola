import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchFootballNews } from './src/lib/news';
import { processNewsWithGemini, rankBestNews } from './src/lib/gemini';
import { generateImages } from './src/lib/renderer';
import { archiveOldPosts } from './src/lib/archiver';
import { getFollowersCount, postToInstagram } from './src/lib/instagram';
import { milestones, generateCelebrationImage } from './src/lib/celebration';
import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'src', 'history.json');

async function runOráculo() {
  console.log("🔮 O Oráculo está despertando...");
  
  let history: string[] = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch (e) { history = []; }
  }

  const newsList = await fetchFootballNews();
  const LAST_CATEGORY_FILE = path.join(process.cwd(), 'src', 'last_category.txt');
  let lastCategory = fs.existsSync(LAST_CATEGORY_FILE) ? fs.readFileSync(LAST_CATEGORY_FILE, 'utf-8').trim() : '';

  // Filtrar e ORDENAR POR FRESCOR (Mais novas primeiro)
  const processedTitlesInCurrentRun = new Set();
  const newItems = newsList.filter((item: any) => {
    const isNewLink = !history.includes(item.link);
    const cleanTitle = item.title.split(' - ')[0].toLowerCase().trim();
    const isNewContent = !history.some(h => h === cleanTitle) && !processedTitlesInCurrentRun.has(cleanTitle);
    const hasImage = !!item.imageUrl;
    const isDifferentCategory = item.category !== lastCategory;
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some(word => cleanTitle.includes(word));

    if (isNewLink && isNewContent && hasImage && !isServiceNews && isDifferentCategory) {
      processedTitlesInCurrentRun.add(cleanTitle);
      return true;
    }
    return false;
  }).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 15);

  if (newItems.length === 0) {
    console.log(`💤 Nenhuma novidade fresquinha (Categoria: ${lastCategory}).`);
    return;
  }

  // LÓGICA DE COMPENSAÇÃO: Se ficou muito tempo sem postar, postar até 3
  const LAST_POST_FILE = path.join(process.cwd(), 'src', 'last_post.json');
  let lastPostTime = Date.now() - (60 * 60 * 1000); 
  if (fs.existsSync(LAST_POST_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LAST_POST_FILE, 'utf-8'));
      lastPostTime = new Date(data.timestamp).getTime();
    } catch (e) { /* ignore */ }
  }

  const hoursSinceLastPost = (Date.now() - lastPostTime) / (1000 * 60 * 60);
  let postsToMake = 1;
  if (hoursSinceLastPost > 4) postsToMake = 3;
  else if (hoursSinceLastPost > 2) postsToMake = 2;

  console.log(`⏱️ Último post há ${hoursSinceLastPost.toFixed(1)}h. Planejando ${postsToMake} post(s).`);

  const finalItems: any[] = [];
  let candidatesPool = [...newItems];

  for (let p = 0; p < postsToMake; p++) {
    if (candidatesPool.length === 0) break;
    const bestItem = await rankBestNews(candidatesPool);
    if (bestItem) {
      finalItems.push(bestItem);
      candidatesPool = candidatesPool.filter(c => c.link !== bestItem.link);
    }
  }

  for (let i = 0; i < finalItems.length; i++) {
    const item = finalItems[i];
    console.log(`🧐 [${i+1}/${finalItems.length}] Processando [${item.category}]: ${item.title}`);
    
    // Pool de fallback: itens não selecionados como principais
    const fallbackPool = candidatesPool.filter(c => !finalItems.some(f => f.link === c.link));
    
    let processed = null;
    let usedItem = item;
    
    // Tenta o item principal, depois fallbacks
    const attempts = [item, ...fallbackPool.slice(0, 3)];
    for (const attempt of attempts) {
      try {
        processed = await processNewsWithGemini(attempt.title, attempt.contentSnippet);
        usedItem = attempt;
        break;
      } catch (err: any) {
        console.warn(`⚠️ Falhou [${attempt.title.substring(0, 50)}...]: ${err.message}`);
      }
    }
    
    if (!processed) {
      console.error(`❌ Sem conteúdo válido para o slot ${i+1}. Pulando.`);
      continue;
    }
    
    try {
      const paths = await generateImages(processed, usedItem.imageUrl || null);
      const scheduledTime = undefined;
      
      const formattedHashtags = processed.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
      
      await postToInstagram(
        paths.feedPath, 
        `${processed.caption}\n\n${formattedHashtags}`
      );
      
      if (i < finalItems.length - 1) {
        console.log("⏳ Aguardando 30 segundos para a próxima postagem...");
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
      
      history.push(usedItem.link);
      history.push(usedItem.title.split(' - ')[0].toLowerCase().trim());
      if (history.length > 1000) history = history.slice(-1000);
      
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
      fs.writeFileSync(LAST_CATEGORY_FILE, usedItem.category);
      fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ timestamp: new Date().toISOString() }));
      
      console.log(`✅ Postagem confirmada [${usedItem.category}]: ${processed.headline}`);
    } catch (error) { console.error(`❌ Erro fatal no slot ${i+1}:`, error); }
  }

  await archiveOldPosts();

  try {
    const followers = await getFollowersCount();
    const MILESTONES_FILE = path.join(process.cwd(), 'src', 'milestones.json');
    let milestoneHistory: string[] = fs.existsSync(MILESTONES_FILE) ? JSON.parse(fs.readFileSync(MILESTONES_FILE, 'utf-8')) : [];
    const currentMilestone = milestones.find(m => parseInt(m.value.replace('.', '')) <= followers && !milestoneHistory.includes(m.value));
    if (currentMilestone) {
      const celebrationPath = await generateCelebrationImage(currentMilestone);
      await postToInstagram(celebrationPath, `SOMOS ${currentMilestone.value}! ${currentMilestone.sub} #OraculoDaBola`);
      milestoneHistory.push(currentMilestone.value);
      fs.writeFileSync(MILESTONES_FILE, JSON.stringify(milestoneHistory, null, 2));
    }
  } catch (mError) { console.error("Erro marcos:", mError); }
  
  process.exit(0);
}

runOráculo();
