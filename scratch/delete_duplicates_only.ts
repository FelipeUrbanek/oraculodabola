import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function deleteIndividualDuplicates() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais faltando no .env.local");
    return;
  }

  try {
    console.log("🔍 Analisando feed para encontrar duplicatas semânticas...");
    
    // 1. Listar mídias com legendas
    const listResponse = await axios.get(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
      params: { 
        access_token: ACCESS_TOKEN,
        fields: 'id,caption,timestamp'
      }
    });

    const posts = listResponse.data.data;
    if (!posts || posts.length === 0) {
      console.log("✅ Nenhum post encontrado.");
      return;
    }

    const seenCaptions = new Set<string>();
    const toDelete: string[] = [];

    for (const post of posts) {
      const caption = post.caption || "";
      // Usamos os primeiros 50 caracteres para comparar temas (evita problemas com hashtags diferentes)
      const themeKey = caption.substring(0, 50).toLowerCase().trim();
      
      if (seenCaptions.has(themeKey) && themeKey.length > 10) {
        console.log(`🚩 Duplicata detectada: "${themeKey}..."`);
        toDelete.push(post.id);
      } else {
        seenCaptions.add(themeKey);
      }
    }

    if (toDelete.length === 0) {
      console.log("✨ Nenhuma duplicata encontrada no feed recente.");
      return;
    }

    console.log(`🗑️ Removendo ${toDelete.length} posts duplicados...`);

    for (const id of toDelete) {
      try {
        console.log(`⏳ Apagando post ID: ${id}...`);
        await axios.delete(`https://graph.facebook.com/v21.0/${id}`, {
          params: { access_token: ACCESS_TOKEN }
        });
        console.log(`✅ Post ${id} removido.`);
      } catch (err: any) {
        console.error(`❌ Erro ao apagar post ${id}:`, err.response?.data?.error?.message || err.message);
      }
    }

    console.log("\n🏁 Limpeza de duplicatas concluída!");
  } catch (error: any) {
    console.error("❌ Falha na operação:", error.response?.data?.error?.message || error.message);
  }
}

deleteIndividualDuplicates();
