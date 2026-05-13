import { fetchFootballNews } from './lib/news.js';
import { processNewsWithGemini } from './lib/gemini.js';
import { generateImages } from './lib/renderer.js';
import { loginToInstagram, postToInstagram, postStory } from './lib/instagram.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const HISTORY_PATH = path.join(__dirname, 'history.json');

async function main() {
  console.log('--- Iniciando Ciclo do Oráculo ---');

  // 1. Carregar Histórico
  let history: string[] = [];
  if (existsSync(HISTORY_PATH)) {
    history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
  }

  // 2. Buscar Notícias
  const news = await fetchFootballNews();
  const newItems = news.filter(item => !history.includes(item.id));

  if (newItems.length === 0) {
    console.log('Nenhuma notícia nova encontrada.');
    return;
  }

  // Pegar a mais recente
  const newsToPost = newItems[0];
  console.log(`Nova notícia encontrada: ${newsToPost.title}`);

  try {
    // 3. Processar com Gemini
    console.log('Consultando o Gemini...');
    const content = await processNewsWithGemini(newsToPost.title, newsToPost.contentSnippet);

    // 4. Gerar Imagens
    console.log('Gerando imagens premium...');
    const { feedPath, storyPath } = await generateImages(content, newsToPost.imageUrl);

    // 5. Postar no Instagram
    console.log('Postando no Instagram...');
    const ig = await loginToInstagram();
    
    // Feed
    const finalCaption = `${content.caption}\n.\n.\n${content.hashtags.map(h => `#${h}`).join(' ')}`;
    await postToInstagram(ig, feedPath, finalCaption);
    
    // Story
    await postStory(ig, storyPath);

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
