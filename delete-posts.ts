import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function deleteRecentPosts() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais faltando no .env.local");
    return;
  }

  try {
    console.log("🔍 Buscando posts recentes no Instagram...");
    
    // 1. Listar mídias recentes
    const listResponse = await axios.get(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
      params: { access_token: ACCESS_TOKEN }
    });

    const posts = listResponse.data.data;

    if (!posts || posts.length === 0) {
      console.log("✅ Nenhum post encontrado para apagar.");
      return;
    }

    console.log(`🗑️ Encontrados ${posts.length} posts. Iniciando exclusão...`);

    // 2. Apagar cada mídia
    for (const post of posts) {
      try {
        console.log(`⏳ Apagando post ID: ${post.id}...`);
        await axios.delete(`https://graph.facebook.com/v21.0/${post.id}`, {
          params: { access_token: ACCESS_TOKEN }
        });
        console.log(`✅ Post ${post.id} removido.`);
      } catch (err: any) {
        console.error(`❌ Erro ao apagar post ${post.id}:`, err.response?.data?.error?.message || err.message);
      }
    }

    console.log("\n🏁 Limpeza online concluída!");
  } catch (error: any) {
    console.error("❌ Falha na operação:", error.response?.data?.error?.message || error.message);
  }
}

deleteRecentPosts();
