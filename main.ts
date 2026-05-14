import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchFootballNews } from './src/lib/news';
import { processNewsWithGemini } from './src/lib/gemini';
import { generateImages } from './src/lib/renderer';
import { archiveOldPosts } from './src/lib/archiver';
import { getFollowersCount, postToInstagram } from './src/lib/instagram';
import { milestones, generateCelebrationImage } from './src/lib/celebration';
import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'src', 'history.json');

async function runOráculo() {
  console.log("🔮 O Oráculo está despertando...");
  
  // 1. Carregar Histórico com Tipagem
  let history: string[] = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch (e) {
      history = [];
    }
  }

  // 2. Scrape News
  const newsList = await fetchFootballNews();
  
  // 2.0 Lógica de Rodízio: Ler última categoria postada
  const LAST_CATEGORY_FILE = path.join(process.cwd(), 'src', 'last_category.txt');
  let lastCategory = '';
  if (fs.existsSync(LAST_CATEGORY_FILE)) {
    lastCategory = fs.readFileSync(LAST_CATEGORY_FILE, 'utf-8').trim();
  }

  // 2.1 Filtrar por link, similaridade e RODÍZIO
  const processedTitlesInCurrentRun = new Set();
  const newItems = newsList.filter((item: any) => {
    const isNewLink = !history.includes(item.link);
    
    const cleanTitle = item.title.split(' - ')[0].toLowerCase().trim();
    const isNewContent = !history.some(h => h === cleanTitle) && !processedTitlesInCurrentRun.has(cleanTitle);
    const hasImage = !!item.imageUrl;

    // RODÍZIO: Ignorar se for a mesma categoria do último post
    const isDifferentCategory = item.category !== lastCategory;

    // Filtro de utilidade (Ignorar onde assistir, ao vivo, etc)
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some(word => cleanTitle.includes(word));

    if (isNewLink && isNewContent && hasImage && !isServiceNews && isDifferentCategory) {
      processedTitlesInCurrentRun.add(cleanTitle);
      return true;
    }
    return false;
  }).slice(0, 1); // Apenas 1 post por hora para manter o limite de 25/dia do Instagram

  if (newItems.length === 0) {
    console.log(`💤 Nenhuma novidade fresquinha (Pulando categoria repetida: ${lastCategory}).`);
    return;
  }

  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    console.log(`🧐 [${i+1}/${newItems.length}] Processando [${item.category}]: ${item.title}`);
    
    try {
      // 3. IA Process
      const processed = await processNewsWithGemini(item.title, item.contentSnippet);
      
      // 4. Render
      console.log(`🎨 Gerando artes: ${processed.headline}`);
      const paths = await generateImages(processed, item.imageUrl || null);
      
      // 5. Postar no Instagram
      const scheduledTime = i === 0 ? undefined : Math.floor(Date.now() / 1000) + (i * 10 * 60);
      
      console.log(`🚀 Iniciando postagem automática...`);
      await postToInstagram(
        paths.feedPath, 
        `${processed.caption}\n\n${processed.hashtags.join(' ')}`,
        scheduledTime
      );
      
      // 6. Salvar Legenda e Metadados
      const metadataPath = paths.feedPath.replace('_feed.jpg', '_meta.json');
      fs.writeFileSync(metadataPath, JSON.stringify({
        ...processed,
        category: item.category,
        originalLink: item.link,
        timestamp: new Date().toISOString()
      }, null, 2));

      // 7. Atualizar Histórico e RODÍZIO
      const cleanTitle = item.title.split(' - ')[0].toLowerCase().trim();
      history.push(item.link);
      history.push(cleanTitle);
      
      if (history.length > 1000) history = history.slice(-1000);
      
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
      fs.writeFileSync(LAST_CATEGORY_FILE, item.category); // Salva para o próximo rodízio
      
      console.log(`✅ Postagem confirmada [${item.category}]: ${processed.headline}`);
      
    } catch (error) {
      console.error(`❌ Falha ao processar ${item.title}:`, error);
    }
  }

  // 8. Arquivar pastas com mais de 20 dias
  console.log("📂 Verificando pastas antigas para arquivamento...");
  await archiveOldPosts();

  // 9. Verificar Marcos de Seguidores
  try {
    console.log("📈 Verificando marcos de seguidores...");
    const followers = await getFollowersCount();
    console.log(`👥 Seguidores atuais: ${followers}`);

    const MILESTONES_FILE = path.join(process.cwd(), 'src', 'milestones.json');
    let milestoneHistory: string[] = [];
    if (fs.existsSync(MILESTONES_FILE)) {
      milestoneHistory = JSON.parse(fs.readFileSync(MILESTONES_FILE, 'utf-8'));
    }

    const currentMilestone = milestones.find(m => {
      const val = parseInt(m.value.replace('.', ''));
      return followers >= val && !milestoneHistory.includes(m.value);
    });

    if (currentMilestone) {
      console.log(`🎉 NOVO MARCO ALCANÇADO: ${currentMilestone.value}!`);
      const celebrationPath = await generateCelebrationImage(currentMilestone);
      
      const caption = `SOMOS ${currentMilestone.value}! ${currentMilestone.sub} Obrigado a cada um de vocês que faz parte do Oráculo da Bola. ⚽️❤️ #OraculoDaBola #Gratidão #Futebol`;
      await postToInstagram(celebrationPath, caption);
      
      milestoneHistory.push(currentMilestone.value);
      fs.writeFileSync(MILESTONES_FILE, JSON.stringify(milestoneHistory, null, 2));
      console.log(`✅ Celebração de ${currentMilestone.value} postada com sucesso!`);
    }
  } catch (mError) {
    console.error("❌ Erro no módulo de marcos:", mError);
  }
  
  console.log("🔮 O Oráculo terminou sua jornada.");
  process.exit(0);
}

runOráculo();
