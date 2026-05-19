import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID; // Football ID
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function strictCleanNonSantos() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais incompletas.");
    return;
  }

  console.log(`🔍 Iniciando auditoria estrita de Santos FC na conta ID: ${IG_USER_ID}...`);

  try {
    const url = `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "id,caption,timestamp,permalink"
      }
    });

    const mediaList = response.data.data || [];
    console.log(`📦 Encontrados ${mediaList.length} posts ativos online.`);

    const strictSantosKeywords = ["santos", "peixe", "vila belmiro", "alvinegro praiano", "sfc"];

    const toDelete: any[] = [];
    const toKeep: any[] = [];

    for (const media of mediaList) {
      const caption = (media.caption || "").toLowerCase();
      
      // Checagem estrita: Deve conter especificamente alguma palavra-chave direta do Santos FC
      const hasDirectSantosLink = strictSantosKeywords.some(k => caption.includes(k));

      if (!hasDirectSantosLink) {
        toDelete.push(media);
      } else {
        toKeep.push(media);
      }
    }

    console.log(`\n📋 Relatório Estrito:`);
    console.log(`   ✅ Posts a MANTER (Santos FC estrito): ${toKeep.length}`);
    toKeep.forEach(m => console.log(`      - ID: ${m.id} | Link: ${m.permalink} | Caption: "${m.caption ? m.caption.substring(0, 80) + "..." : ""}"`));

    console.log(`   🗑️ Posts a DELETAR (Não-Santos FC): ${toDelete.length}`);
    toDelete.forEach(m => console.log(`      - ID: ${m.id} | Link: ${m.permalink} | Caption: "${m.caption ? m.caption.substring(0, 80) + "..." : ""}"`));

    if (toDelete.length === 0) {
      console.log("\n✨ A página já está 100% limpa com o filtro estrito!");
      return;
    }

    console.log(`\n🔥 Excluindo os ${toDelete.length} posts que não são do Santos FC...`);
    for (const post of toDelete) {
      console.log(`   🗑️ Deletando post ID ${post.id}...`);
      try {
        await axios.delete(`https://graph.facebook.com/v21.0/${post.id}`, {
          params: { access_token: ACCESS_TOKEN }
        });
        console.log(`      ✅ Sucesso.`);
      } catch (e: any) {
        console.error(`      ❌ Falha ao excluir post ${post.id}:`, e.response?.data?.error?.message || e.message);
      }
    }

    console.log("\n✨ Faxina estrita concluída com sucesso!");

  } catch (e: any) {
    console.error("❌ Falha na auditoria estrita:", e.response?.data?.error?.message || e.message);
  }
}

strictCleanNonSantos();
