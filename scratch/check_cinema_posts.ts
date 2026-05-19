import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID_CINEMA = process.env.IG_USER_ID_CINEMA;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function checkCinemaFeed() {
  if (!IG_USER_ID_CINEMA || !ACCESS_TOKEN) return;

  console.log(`🔍 Verificando feed da conta de Cinema (@espectadorcomum) ID: ${IG_USER_ID_CINEMA}...`);
  try {
    const url = `https://graph.facebook.com/v21.0/${IG_USER_ID_CINEMA}/media`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: "id,caption,timestamp,permalink"
      }
    });

    const mediaList = response.data.data || [];
    console.log(`📦 Encontrados ${mediaList.length} posts no feed de Cinema.`);

    for (const post of mediaList) {
      console.log(`- ID: ${post.id}`);
      console.log(`  Caption: "${post.caption ? post.caption.substring(0, 150) + "..." : "Sem legenda"}"`);
      console.log(`  Link: ${post.permalink}`);
    }

  } catch (e: any) {
    console.error("❌ Erro:", e.response?.data?.error?.message || e.message);
  }
}

checkCinemaFeed();
