import { fetchFootballNews } from './lib/news.js';
import { processNewsWithGemini } from './lib/gemini.js';
import { fetchCurrentTrends } from './lib/trends.js';
import { handleCommentsEngagement } from './lib/engagement.js';
import { generateImages } from './lib/renderer.js';
import { postToInstagram, postStory } from './lib/instagram.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const HISTORY_PATH = path.join(__dirname, 'history.json');

async function main() {
  console.log('--- Iniciando Ciclo do Oráculo ---');

  // 1. Engajamento (Responder Comentários)
  await handleCommentsEngagement();

  // 2. Carregar Histórico
  let history: string[] = [];
  if (existsSync(HISTORY_PATH)) {
    history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
  }

  // 3. Buscar Tendências e Notícias
  const trends = await fetchCurrentTrends();
  const news = await fetchFootballNews(trends);
  const newItems = news.filter(item => !history.includes(item.id));

  if (newItems.length === 0) {
    console.log('Nenhuma notícia nova encontrada.');
    return;
  }

  // 4. Seleção da Notícia
  const now = new Date();
  const peaks = [12, 18, 21];
  let newsToPost = newItems[0];

  // Se for horário de pico, pedimos ao Gemini para escolher a melhor entre as disponíveis
  if (peaks.includes(now.getHours()) && newItems.length > 1) {
    console.log('🌟 Horário de Pico Detectado! Selecionando a melhor notícia do lote...');
    // Aqui poderíamos adicionar uma função para o Gemini escolher, mas por simplificação, 
    // como já estão ordenadas por relevância na busca, pegamos a primeira que é a 'Trend' do momento.
    newsToPost = newItems[0];
  }

  console.log(`Nova notícia selecionada: ${newsToPost.title}`);

  try {
    // 3. Processar com Gemini
    console.log('Consultando o Gemini...');
    const content = await processNewsWithGemini(newsToPost.title, newsToPost.contentSnippet);

    // 4. Gerar Imagens
    console.log('Gerando imagens premium...');
    const { feedPath, storyPath } = await generateImages(content, newsToPost.imageUrl || null);

    // 5. Postar no Instagram
    console.log('Postando no Instagram...');
    // const ig = await loginToInstagram();
    
    // Feed
    const finalCaption = `${content.caption}\n.\n.\n${content.hashtags.map(h => `#${h}`).join(' ')}`;
    console.log(`📝 Tamanho final da legenda: ${finalCaption.length} caracteres.`);

    // Postagem imediata (1 por hora)
    console.log('🚀 Postando no Feed...');
    await postToInstagram(feedPath, finalCaption);
    
    // Story
    if (storyPath) await postStory(storyPath);

    // 6. Atualizar Histórico
    history.push(newsToPost.id);
    // Manter apenas as últimas 100 para não crescer infinitamente
    if (history.length > 100) history.shift();
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log('--- Ciclo Concluído com Sucesso! ---');
  } catch (error) {
    console.error('Falha no ciclo:', error);
    process.exit(1);
  }
}

main();
