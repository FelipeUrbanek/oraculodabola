import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID; // Football ID
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function cleanNonSantosPosts() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais incompletas.");
    return;
  }

  console.log(`🔍 Conectando à conta oficial do Instagram (ID: ${IG_USER_ID}) para auditar posts...`);

  try {
    // 1. Buscar posts recentes do feed
    const url = `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "id,caption,timestamp,permalink,media_url"
      }
    });

    const mediaList = response.data.data || [];
    console.log(`📦 Encontrados ${mediaList.length} posts no feed.`);

    if (mediaList.length === 0) {
      console.log("✅ Nenhum post encontrado.");
      return;
    }

    const keywords = ["santos", "peixe", "vila belmiro", "alvinegro", "sfc", "menino da vila", "neymar", "carille", "teixeira", "brasileirão"];
    const cinemaKeywords = ["filme", "série", "netflix", "cinema", "oscar", "streaming", "hbo", "disney", "critica", "gladiador", "duna", "stranger things", "bastidores"];

    const toDelete: any[] = [];
    const toKeep: any[] = [];

    for (const media of mediaList) {
      const caption = (media.caption || "").toLowerCase();
      
      // Decidir se mantém ou deleta
      const isAboutSantos = keywords.some(k => caption.includes(k));
      const isAboutCinema = cinemaKeywords.some(c => caption.includes(c));

      // Se tiver palavras-chave de cinema, ou se não tiver nada sobre o Santos, marcamos para exclusão
      if (isAboutCinema || (!isAboutSantos && caption.length > 0)) {
        toDelete.push(media);
      } else {
        toKeep.push(media);
      }
    }

    console.log(`\n📋 Relatório de Auditoria:`);
    console.log(`   ✅ Posts a MANTER (Santos FC): ${toKeep.length}`);
    toKeep.forEach(m => console.log(`      - ID: ${m.id} | Link: ${m.permalink} | Caption: "${m.caption ? m.caption.substring(0, 50) + "..." : ""}"`));

    console.log(`   🗑️ Posts a DELETAR (Não-Santos / Cinema / Outros): ${toDelete.length}`);
    toDelete.forEach(m => console.log(`      - ID: ${m.id} | Link: ${m.permalink} | Caption: "${m.caption ? m.caption.substring(0, 50) + "..." : ""}"`));

    if (toDelete.length === 0) {
      console.log("\n✨ Nenhum post intruso ou não-Santos encontrado. A página está 100% limpa!");
      return;
    }

    console.log(`\n🔥 Iniciando exclusão de ${toDelete.length} posts intrusos da página de futebol...`);
    for (const post of toDelete) {
      console.log(`   🗑️ Deletando post ID ${post.id}...`);
      try {
        await axios.delete(`https://graph.facebook.com/v21.0/${post.id}`, {
          params: { access_token: ACCESS_TOKEN }
        });
        console.log(`      ✅ Excluído com sucesso.`);
      } catch (e: any) {
        console.error(`      ❌ Falha ao excluir post ${post.id}:`, e.response?.data?.error?.message || e.message);
      }
    }

    console.log("\n✨ Limpeza online finalizada com sucesso!");

  } catch (e: any) {
    console.error("❌ Falha ao obter mídias do Instagram:", e.response?.data?.error?.message || e.message);
  }
}

cleanNonSantosPosts();
