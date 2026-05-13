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
  
  // 2.1 Filtrar por link e também por similaridade de título
  const processedTitlesInCurrentRun = new Set();
  const newItems = newsList.filter((item: any) => {
    const isNewLink = !history.includes(item.link);
    
    const cleanTitle = item.title.split(' - ')[0].toLowerCase().trim();
    const isNewContent = !history.some(h => h === cleanTitle) && !processedTitlesInCurrentRun.has(cleanTitle);
    const hasImage = !!item.imageUrl;

    // Filtro de utilidade (Ignorar onde assistir, ao vivo, etc)
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some(word => cleanTitle.includes(word));

    if (isNewLink && isNewContent && hasImage && !isServiceNews) {
      processedTitlesInCurrentRun.add(cleanTitle);
      return true;
    }
    return false;
  }).slice(0, 1); // Apenas 1 post por hora para manter o limite de 25/dia do Instagram

  if (newItems.length === 0) {
    console.log("💤 Nenhuma novidade fresquinha na última hora.");
    return;
  }

  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    console.log(`🧐 [${i+1}/${newItems.length}] Processando: ${item.title}`);
    
    try {
      // 3. IA Process
      const processed = await processNewsWithGemini(item.title, item.contentSnippet);
      
      // 4. Render
      console.log(`🎨 Gerando artes: ${processed.headline}`);
      const paths = await generateImages(processed, item.imageUrl || null);
      
      // 5. Postar no Instagram com Agendamento (0, 10, 20 minutos)
      // O Instagram exige que agendamentos sejam feitos no mínimo 10 min no futuro.
      // Então o primeiro vai na hora, os outros agendados.
      const scheduledTime = i === 0 ? undefined : Math.floor(Date.now() / 1000) + (i * 10 * 60);
      
      console.log(`🚀 Iniciando postagem automática...`);
      await postToInstagram(
        paths.feedPath, 
        `${processed.caption}\n\n${processed.hashtags.join(' ')}`,
        scheduledTime
      );
      
      if (processed.shouldCreateStory && paths.storyPath) {
        console.log(`📱 Story detectado (Pendente aprovação manual/API p/ Stories).`);
      }

      // 6. Salvar Legenda e Metadados
      const metadataPath = paths.feedPath.replace('_feed.jpg', '_meta.json');
      fs.writeFileSync(metadataPath, JSON.stringify({
        ...processed,
        originalLink: item.link,
        timestamp: new Date().toISOString()
      }, null, 2));

      // 7. Atualizar Histórico Imediatamente (Link + Título Limpo)
      const cleanTitle = item.title.split(' - ')[0].toLowerCase().trim();
      history.push(item.link);
      history.push(cleanTitle);
      
      if (history.length > 1000) history = history.slice(-1000);
      
      if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
        fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
      
      console.log(`✅ Postagem confirmada e salva: ${processed.headline}`);
      
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
      
      // Postar no Instagram
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
}

runOráculo();
