import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function exchangeToken() {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const shortToken = process.env.FB_ACCESS_TOKEN;

  if (!appId || !appSecret || !shortToken) {
    console.error("❌ Erro: FB_APP_ID, FB_APP_SECRET ou FB_ACCESS_TOKEN faltando no .env.local");
    return;
  }

  console.log("🔄 Trocando token curto por token de 60 dias...");

  try {
    const url = `https://graph.facebook.com/v21.0/oauth/access_token`;
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken
      }
    });

    const longLivedToken = response.data.access_token;
    console.log("\n✅ SUCESSO! Seu token de longa duração foi gerado:");
    console.log("--------------------------------------------------");
    console.log(longLivedToken);
    console.log("--------------------------------------------------");
    console.log("\n👉 COPIE o código acima e substitua no FB_ACCESS_TOKEN do seu .env.local");
  } catch (error: any) {
    console.error("❌ FALHA NA TROCA:", error.response?.data?.error?.message || error.message);
  }
}

exchangeToken();
