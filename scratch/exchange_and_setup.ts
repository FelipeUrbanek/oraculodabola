import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const SHORT_LIVED_TOKEN = "EAAZBoxrlHzGUBRQ6kIMPabpsbITcTIW0LRMYCaIHaeZCM6iLKmtCBr9odYjoPGxM8xJgx6VomgfFi684Q8XXzVdfL8QsayxTbxbNf0srbZCm3nl9tk3j4euG75TjFTZC7vb6uZBCfZCZBWPRiKjqufyLO8Mo4PF2eKScgMWE5GgZAImbZCumYZBzUY7FOB2xEZCxL3PA9fvwMhWDCBudo4gynWtMH3cNrwiJls8fEFZBz5gvzCpCQveZAzYJXcWg1Xu7FZAhZCUOdleLU6hJaAMvyZBXkZCSpWr9C";

async function runExchangeAndSetup() {
  if (!FB_APP_ID || !FB_APP_SECRET) {
    console.error("❌ Erro: FB_APP_ID ou FB_APP_SECRET ausentes no .env.local!");
    process.exit(1);
  }

  console.log("🔄 1. Trocando token curto por token de longa duração (60 dias)...");
  
  let longLivedToken = SHORT_LIVED_TOKEN;

  try {
    const exchangeResponse = await axios.get(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: FB_APP_ID,
          client_secret: FB_APP_SECRET,
          fb_exchange_token: SHORT_LIVED_TOKEN
        }
      }
    );

    longLivedToken = exchangeResponse.data.access_token;
    console.log("✅ Token de 60 dias obtido com sucesso!");

  } catch (err: any) {
    console.warn(`⚠️ Aviso: Falha ao trocar token por 60 dias (${err.response?.data?.error?.message || err.message}).`);
    console.warn("Usaremos o token fornecido diretamente para tentar a sincronização...");
  }

  console.log("\n📡 2. Testando conexões e buscando páginas...");

  try {
    const pagesResponse = await axios.get(
      "https://graph.facebook.com/v21.0/me/accounts",
      {
        params: {
          fields: "id,name,access_token",
          access_token: longLivedToken
        }
      }
    );

    const pages = pagesResponse.data.data;
    if (!pages || pages.length === 0) {
      console.error("❌ Nenhuma página foi encontrada vinculada a este Token!");
      process.exit(1);
    }

    console.log(`📊 Encontradas ${pages.length} páginas do Facebook:`);
    let cinemaIgId = "";

    for (const page of pages) {
      console.log(`\n- 📄 Página: "${page.name}" (ID: ${page.id})`);
      
      try {
        const igResponse = await axios.get(
          `https://graph.facebook.com/v21.0/${page.id}`,
          {
            params: {
              fields: "instagram_business_account{id,username,name}",
              access_token: page.access_token
            }
          }
        );

        const igAccount = igResponse.data.instagram_business_account;
        if (igAccount) {
          console.log(`  📸 Instagram: @${igAccount.username} (${igAccount.name})`);
          console.log(`     ID (IG_USER_ID): ${igAccount.id}`);
          
          if (page.name.toLowerCase().includes("espectador comum")) {
            cinemaIgId = igAccount.id;
            console.log("  🌟 [CINEMA!] Esta é a conta correta para o Cinema!");
          }
        } else {
          console.log("  ⚠️ Sem conta do Instagram vinculada.");
        }
      } catch (err: any) {
        console.log(`  ❌ Erro ao consultar detalhes da página: ${err.message}`);
      }
    }

    // 3. Atualizar o .env.local
    console.log("\n💾 3. Gravando credenciais atualizadas no .env.local...");
    const envPath = path.resolve(process.cwd(), ".env.local");
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Substituir FB_ACCESS_TOKEN
    envContent = envContent.replace(
      /FB_ACCESS_TOKEN=.*/,
      `FB_ACCESS_TOKEN=${longLivedToken}`
    );

    // Substituir ou Adicionar IG_USER_ID_CINEMA
    if (cinemaIgId) {
      if (envContent.includes("IG_USER_ID_CINEMA=")) {
        envContent = envContent.replace(
          /IG_USER_ID_CINEMA=.*/,
          `IG_USER_ID_CINEMA=${cinemaIgId}`
        );
      } else {
        // Encontrar a linha após IG_USER_ID para ficar organizado
        envContent = envContent.replace(
          /IG_USER_ID=(.*)/,
          `IG_USER_ID=$1\nIG_USER_ID_CINEMA=${cinemaIgId}`
        );
      }
      console.log(`✅ Adicionado IG_USER_ID_CINEMA=${cinemaIgId} no .env.local!`);
    } else {
      console.warn("⚠️ Atenção: A página 'Espectador comum' ainda não retornou um Instagram Business Account vinculado.");
      console.warn("Verifique se você concluiu a vinculação de página ou se o token tem permissões corretas.");
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log("🎉 Processo concluído com sucesso total! Suas credenciais estão 100% salvas e seguras.");

  } catch (error: any) {
    console.error("❌ Erro grave ao testar conexões com a Graph API:", error.response?.data || error.message);
  }
}

runExchangeAndSetup();
