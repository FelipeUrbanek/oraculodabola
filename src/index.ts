import { fetchFootballNews } from './lib/news.js';
import { processNewsWithGemini, rankBestNews } from './lib/gemini.js';
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

  // 1. Engajamento (Responder Comentários)
  await handleCommentsEngagement();

  // 2. Carregar Histórico e Verificar Limite de 25 posts/dia
  let history: { id: string, date: string }[] = [];
  if (existsSync(HISTORY_PATH)) {
    try {
      const raw = readFileSync(HISTORY_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // Suporte para migração (se o histórico antigo for só strings)
      history = parsed.map((item: any) => typeof item === 'string' ? { id: item, date: new Date(0).toISOString() } : item);
    } catch (e) { history = []; }
  }

  const now = new Date();
  const last24h = history.filter(h => (now.getTime() - new Date(h.date).getTime()) < 24 * 60 * 60 * 1000);
  console.log(`📊 Posts nas últimas 24h: ${last24h.length}/24`);

  if (last24h.length >= 24) {
    console.warn('🛑 Limite diário atingido (24 posts). Abortando para segurança.');
    return;
  }

  // 3. Buscar Tendências e Notícias
  const trends = await fetchCurrentTrends();
  const news = await fetchFootballNews(trends);
  const postedIds = history.map(h => h.id);
  const newItems = news.filter(item => !postedIds.includes(item.id));

  if (newItems.length === 0) {
    console.log('Nenhuma notícia nova encontrada.');
    return;
  }

  // 4. Seleção Inteligente da Notícia
  let newsToPost = newItems[0];

  if (newItems.length > 1) {
    console.log(`🧠 Analisando ${newItems.length} notícias para escolher a melhor...`);
    const bestIndex = await rankBestNews(newItems.map(item => ({
      title: item.title,
      snippet: item.contentSnippet
    })));
    newsToPost = newItems[bestIndex];
  }

  console.log(`🔥 Seleção do Oráculo: ${newsToPost.title}`);

  try {
    // 5. Processar com Gemini
    console.log('Consultando o Gemini...');
    const content = await processNewsWithGemini(newsToPost.title, newsToPost.contentSnippet);

    // 6. Gerar Imagens
    console.log('Gerando imagens premium...');
    const { feedPath, storyPath } = await generateImages(content, newsToPost.imageUrl || null);

    // 7. Postar no Instagram
    const finalCaption = `${content.caption}\n.\n.\n${content.hashtags.map(h => `#${h}`).join(' ')}`;
    console.log(`📝 Tamanho final da legenda: ${finalCaption.length} caracteres.`);

    console.log('🚀 Postando no Feed...');
    await postToInstagram(feedPath, finalCaption);
    
    // Story
    if (storyPath) await postStory(storyPath);

    // 8. Atualizar Histórico (ID + Data)
    history.push({ id: newsToPost.id, date: new Date().toISOString() });
    if (history.length > 200) history.shift();
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log('--- Ciclo Concluído com Sucesso! ---');
  } catch (error) {
    console.error('Falha no ciclo:', error);
    process.exit(1);
  }
}

main();
