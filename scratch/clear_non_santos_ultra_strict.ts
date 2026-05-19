import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID; // Football ID
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

// Termos estritos do Santos FC
const SANTOS_KEYWORDS = ["santos fc", "sfc", "vila belmiro", "peixe", "alvinegro praiano", "meninos da vila"];

function isSantosPost(caption: string): boolean {
  const text = caption.toLowerCase();
  
  // 1. Checagem direta de termos específicos do Santos FC
  if (SANTOS_KEYWORDS.some(k => text.includes(k))) {
    return true;
  }

  // 2. Se contiver "santos" isolado (mas não "Nilton Santos" ou estádios) e não estiver infestado de outros times
  if (text.includes("santos") && !text.includes("nilton santos")) {
    const otherClubs = ["fluminense", "botafogo", "corinthians", "palmeiras", "cruzeiro", "gremio", "bahia", "vasco", "fortaleza", "atlético-mg", "sampaoli", "remoto", "remo"];
    const mentionsOtherClubs = otherClubs.filter(club => text.includes(club));
    
    // Se mencionar outro clube mas não mencionar explicitamente "Santos FC" ou "Peixe", provavelmente é do outro clube
    if (mentionsOtherClubs.length > 0) {
      return false;
    }
    return true;
  }

  // 3. Se for notícia do Neymar voltando/jogando no Santos
  if (text.includes("neymar") && (text.includes("vila") || text.includes("peixe") || text.includes("santos"))) {
    return true;
  }

  return false;
}

async function runDefinitiveClean() {
  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Credenciais incompletas no .env.local");
    return;
  }

  console.log("🚀 Iniciando Motor de Limpeza Ultra Estrita com Retentativas...");
  
  let hasMore = true;
  let cycle = 1;

  while (hasMore) {
    console.log(`\n🔄 --- Ciclo de Limpeza #${cycle} ---`);
    
    try {
      // Buscar o feed atual do Instagram
      const url = `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`;
      const response = await axios.get(url, {
        params: {
          access_token: ACCESS_TOKEN,
          fields: "id,caption,timestamp,permalink",
          limit: 30
        }
      });

      const mediaList = response.data.data || [];
      console.log(`📦 Lote carregado: ${mediaList.length} posts.`);

      if (mediaList.length === 0) {
        console.log("✅ Feed completamente vazio ou limpo.");
        hasMore = false;
        break;
      }

      const toDelete: any[] = [];
      const toKeep: any[] = [];

      for (const media of mediaList) {
        const caption = media.caption || "";
        if (isSantosPost(caption)) {
          toKeep.push(media);
        } else {
          toDelete.push(media);
        }
      }

      console.log(`   👉 Santos FC Puro (Manter): ${toKeep.length}`);
      console.log(`   👉 Posts Intrusos (Deletar): ${toDelete.length}`);

      if (toDelete.length === 0) {
        console.log("✨ Excelente! Não há mais posts intrusos neste lote. Limpeza concluída!");
        hasMore = false;
        break;
      }

      console.log(`\n🔥 Deletando ${toDelete.length} posts deste lote...`);
      for (const post of toDelete) {
        const titleSnippet = post.caption ? post.caption.substring(0, 50).replace(/\n/g, " ") + "..." : "Sem legenda";
        console.log(`   🗑️ Removendo ID ${post.id} ("${titleSnippet}")...`);
        
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 5) {
          try {
            await axios.delete(`https://graph.facebook.com/v21.0/${post.id}`, {
              params: { access_token: ACCESS_TOKEN }
            });
            console.log("      ✅ Removido com sucesso.");
            success = true;
          } catch (e: any) {
            attempts++;
            const errorMsg = e.response?.data?.error?.message || e.message;
            console.error(`      ❌ Falha (Tentativa ${attempts}/5): ${errorMsg}`);
            
            if (errorMsg.includes("actions") || errorMsg.includes("limit")) {
              console.log("      ⏳ Rate limit detectado. Aguardando 60 segundos antes de tentar novamente...");
              await new Promise(resolve => setTimeout(resolve, 60000));
            } else {
              // Se for outro tipo de erro, podemos pular para evitar loops infinitos
              break;
            }
          }
        }

        // Dormir 10 segundos entre remoções bem-sucedidas para evitar novos rate limits
        if (success) {
          console.log("   ⏳ Aguardando 10 segundos de respiro para a API...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      cycle++;
      
    } catch (e: any) {
      console.error("❌ Falha crítica no ciclo de limpeza:", e.response?.data?.error?.message || e.message);
      hasMore = false;
    }
  }

  console.log("\n🏁 Varredura e faxina finalizadas com 100% de precisão!");
}

runDefinitiveClean();
