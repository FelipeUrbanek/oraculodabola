import { fetchFootballNews } from './lib/news.js';
import { processNewsWithGemini, rankBestNews, filterDuplicateThemes } from './lib/gemini.js';
import { fetchCurrentTrends } from './lib/trends.js';
import { handleCommentsEngagement } from './lib/engagement.js';
import { generateImages } from './lib/renderer.js';
import { postToInstagram, postStory } from './lib/instagram.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_PATH = path.join(__dirname, 'history.json');

async function main() {
  console.log('--- Iniciando Ciclo do Oráculo ---');

  try {
    // 1. Engajamento (Responder Comentários)
    await handleCommentsEngagement();

    // 2. Carregar Histórico e Verificar Limite de 24 posts/dia
    let history: { id: string, title?: string, date: string }[] = [];
    if (existsSync(HISTORY_PATH)) {
      try {
        const raw = readFileSync(HISTORY_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        history = parsed.map((item: any) => {
          if (typeof item === 'string') {
            // Tenta extrair um título se for o formato legado alternado [url, titulo, url, titulo]
            return { id: item, date: new Date(0).toISOString() };
          }
          return item;
        });
      } catch (e) { history = []; }
    }

    const now = new Date();
    const last24h = history.filter(h => (now.getTime() - new Date(h.date).getTime()) < 24 * 60 * 60 * 1000);
    let postsToday = last24h.length;
    console.log(`📊 Posts nas últimas 24h: ${postsToday}/24`);

    if (postsToday >= 24) {
      console.warn('🛑 Limite diário atingido (24 posts). Abortando para segurança.');
      return;
    }

    // 3. Buscar Tendências e Notícias
    const trends = await fetchCurrentTrends();
    const news = await fetchFootballNews(trends);
    const postedIds = history.map(h => h.id);
    const uniqueItems = news.filter(item => !postedIds.includes(item.id));

    if (uniqueItems.length === 0) {
      console.log('💤 Nenhuma novidade fresquinha na última hora.');
      return;
    }

    // 3.1 De-duplicação Semântica (Evitar vários posts sobre o mesmo tema)
    console.log('🧠 Verificando duplicidade de temas com Gemini...');
    const recentHistoryTitles = history
      .filter(h => h.title && (now.getTime() - new Date(h.date).getTime()) < 48 * 60 * 60 * 1000) // Últimas 48h
      .map(h => h.title!);
    
    const validIndices = await filterDuplicateThemes(uniqueItems, recentHistoryTitles);
    const newItems = validIndices.map(i => uniqueItems[i]);

    if (newItems.length === 0) {
      console.log('♻️ Todas as novidades tratam de temas já postados recentemente.');
      return;
    }

    // 4. Lógica de Compensação (Catch-up Mode)
    const lastPostDate = history.length > 0 ? new Date(history[history.length - 1].date) : new Date(0);
    const hoursSinceLastPost = (now.getTime() - lastPostDate.getTime()) / (1000 * 60 * 60);
    
    let maxPostsThisRun = 1;
    if (hoursSinceLastPost > 8) maxPostsThisRun = 3;
    else if (hoursSinceLastPost > 4) maxPostsThisRun = 2;

    console.log(`📈 Modo Compensação: Gap de ${hoursSinceLastPost.toFixed(1)}h detectado. Permitindo até ${maxPostsThisRun} posts.`);

    const toProcess = newItems.slice(0, maxPostsThisRun);
    let postsCount = 0;

    for (const newsToPost of toProcess) {
      if (postsToday >= 24) break;

      console.log(`\n🔥 Processando: ${newsToPost.title}`);

      // 5. Processar com Gemini
      const content = await processNewsWithGemini(newsToPost.title, newsToPost.contentSnippet);

      // 6. Gerar Imagens Premium
      const { feedPath, storyPath } = await generateImages(content, newsToPost.imageUrl || null);

      // 7. Postar no Instagram
      const finalCaption = `${content.caption}\n.\n.\n${content.hashtags.map(h => `#${h}`).join(' ')}`;
      console.log(`📝 Legenda: ${finalCaption.length} chars. Postando...`);

      const postResult = await postToInstagram(feedPath, finalCaption);
      
      if (postResult) {
        console.log(`✅ Postado com sucesso!`);
        if (storyPath) await postStory(storyPath);

        // 8. Atualizar Histórico
        history.push({ 
          id: newsToPost.id, 
          title: newsToPost.title, 
          date: new Date().toISOString() 
        });
        postsCount++;
        postsToday++;

        // Salvar após cada post para garantir persistência
        if (history.length > 200) history.shift();
        writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

        // Delay entre posts múltiplos para evitar spam (60 segundos)
        if (postsCount < toProcess.length) {
          console.log('⏳ Aguardando 60s para o próximo post do modo compensação...');
          await new Promise(r => setTimeout(r, 60000));
        }
      }
    }

    console.log(`--- Ciclo Concluído: ${postsCount} posts realizados ---`);
  } catch (error) {
    console.error('Falha no ciclo:', error);
    process.exit(1);
  }
}

main();
