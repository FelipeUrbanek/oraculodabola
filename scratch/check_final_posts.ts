import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function checkAndCleanFinal() {
  if (!IG_USER_ID || !ACCESS_TOKEN) return;

  console.log("🔍 Obtendo estado final do feed...");
  try {
    const url = `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "id,caption,timestamp,permalink"
      }
    });

    const mediaList = response.data.data || [];
    console.log(`📦 Encontrados ${mediaList.length} posts restantes.`);

    for (const post of mediaList) {
      console.log(`- ID: ${post.id}`);
      console.log(`  Caption: "${post.caption ? post.caption.substring(0, 120) + "..." : "Sem legenda"}"`);
      console.log(`  Link: ${post.permalink}`);
    }

  } catch (e: any) {
    console.error("❌ Erro:", e.response?.data?.error?.message || e.message);
  }
}

checkAndCleanFinal();
