import { growFollowers, engageHashtag } from './src/lib/engagement';

async function run() {
  console.log("🚀 Iniciando Ciclo de Engajamento Humano...");
  
  // 1. Seguir alguns seguidores de um grande portal de notícias (ex: GE)
  // Isso atrai pessoas interessadas em futebol
  await growFollowers('ge.globo', 3);
  
  // 2. Comentar em posts da hashtag principal
  // O Gemini vai gerar comentários naturais para cada post
  await engageHashtag('brasileirao', 2);
  
  console.log("✅ Ciclo de engajamento concluído!");
  process.exit(0);
}

run();
