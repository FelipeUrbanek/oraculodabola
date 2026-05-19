import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID_CINEMA || process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function manageScheduledPosts() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais incompletas.");
    return;
  }

  console.log(`🔍 Buscando posts agendados para a conta Instagram ID: ${IG_USER_ID}...`);

  try {
    // 1. Obter a lista de posts agendados
    // O endpoint para buscar posts agendados no Instagram Graph API é: /ig-user-id/scheduled_posts
    // Também podemos buscar do campo /ig-user-id/media?filter=scheduled
    const url = `https://graph.facebook.com/v21.0/${IG_USER_ID}/scheduled_posts`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "id,caption,scheduled_publish_time,media_type,media_url"
      }
    });

    const posts = response.data.data || [];
    console.log(`📦 Encontrados ${posts.length} posts agendados.`);

    if (posts.length === 0) {
      console.log("✅ Nenhum post agendado encontrado.");
      return;
    }

    // Ordenar posts pela data de agendamento (do mais antigo ao mais recente/futuro)
    posts.sort((a: any, b: any) => a.scheduled_publish_time - b.scheduled_publish_time);

    console.log("\n📋 Fila de Agendamento:");
    posts.forEach((post: any, idx: number) => {
      const scheduledDate = new Date(post.scheduled_publish_time * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      console.log(`   [${idx + 1}] ID: ${post.id}`);
      console.log(`       └─ Data: ${scheduledDate} BRT`);
      console.log(`       └─ Caption: ${post.caption ? post.caption.substring(0, 60) + "..." : "Sem legenda"}`);
    });

    // Manter apenas o último (o de maior timestamp, que fica na última posição do array ordenado)
    const keepPost = posts[posts.length - 1];
    const postsToDelete = posts.slice(0, posts.length - 1);

    const keepDate = new Date(keepPost.scheduled_publish_time * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    console.log(`\n📌 Post que SERÁ MANTIDO (Último da fila):`);
    console.log(`   ID: ${keepPost.id} | Data: ${keepDate} BRT`);

    if (postsToDelete.length === 0) {
      console.log("✅ Apenas 1 post agendado existe. Nenhuma exclusão necessária.");
      return;
    }

    console.log(`\n🔥 Excluindo os outros ${postsToDelete.length} posts agendados...`);

    for (const post of postsToDelete) {
      const postDate = new Date(post.scheduled_publish_time * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      console.log(`   🗑️ Excluindo ID ${post.id} (agendado para ${postDate} BRT)...`);
      
      try {
        await axios.delete(`https://graph.facebook.com/v21.0/${post.id}`, {
          params: { access_token: ACCESS_TOKEN }
        });
        console.log(`      ✅ Sucesso.`);
      } catch (e: any) {
        console.error(`      ❌ Falha ao excluir post ${post.id}:`, e.response?.data?.error?.message || e.message);
      }
    }

    console.log("\n✨ Processo de limpeza concluído com sucesso!");

  } catch (e: any) {
    console.error("❌ Falha ao buscar posts agendados:", e.response?.data?.error?.message || e.message);
  }
}

manageScheduledPosts();
