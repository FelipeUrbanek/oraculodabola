import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function findInstagramPage() {
  if (!ACCESS_TOKEN) {
    console.error("❌ FB_ACCESS_TOKEN não encontrado no seu arquivo .env.local!");
    process.exit(1);
  }

  console.log("🔍 Consultando endpoints alternativos do Facebook Graph API...");
  
  try {
    // 1. Tentar ler as contas do instagram associadas diretamente ao usuário (/me/instagram_accounts)
    try {
      console.log("\n📡 Buscando em '/me/instagram_accounts'...");
      const directIgResponse = await axios.get(
        "https://graph.facebook.com/v21.0/me/instagram_accounts",
        {
          params: {
            fields: "id,username,name",
            access_token: ACCESS_TOKEN
          }
        }
      );
      const directIgs = directIgResponse.data.data;
      if (directIgs && directIgs.length > 0) {
        console.log(`✅ Encontradas ${directIgs.length} contas associadas diretamente:`);
        for (const ig of directIgs) {
          console.log(`- 📸 Instagram: @${ig.username} (ID: ${ig.id})`);
        }
      } else {
        console.log("⚠️ Nenhuma conta retornada por '/me/instagram_accounts'.");
      }
    } catch (e: any) {
      console.log(`⚠️ '/me/instagram_accounts' indisponível: ${e.response?.data?.error?.message || e.message}`);
    }

    // 2. Tentar ler as contas a partir das páginas
    console.log("\n📡 Analisando páginas em '/me/accounts' novamente...");
    const pagesResponse = await axios.get(
      "https://graph.facebook.com/v21.0/me/accounts",
      {
        params: {
          fields: "id,name,access_token",
          access_token: ACCESS_TOKEN
        }
      }
    );

    const pages = pagesResponse.data.data;
    if (pages) {
      for (const page of pages) {
        console.log(`\n- 📄 Analisando Página: "${page.name}" (ID: ${page.id})`);
        
        try {
          // Consultar a página com o access_token da própria PÁGINA (às vezes o token de usuário falha se a página for restrita)
          const igResponse = await axios.get(
            `https://graph.facebook.com/v21.0/${page.id}`,
            {
              params: {
                fields: "instagram_business_account{id,username,name}",
                access_token: page.access_token // Token da página!
              }
            }
          );

          const igAccount = igResponse.data.instagram_business_account;
          if (igAccount) {
            console.log(`  🌟 [SUCESSO!] Conta de Instagram encontrada com Token de Página:`);
            console.log(`     📸 @${igAccount.username} (${igAccount.name})`);
            console.log(`     🆔 ID do Instagram (IG_USER_ID): ${igAccount.id}`);
          } else {
            console.log("  ⚠️ Sem vínculo de Instagram Business retornado para o Token de Página.");
          }
        } catch (err: any) {
          console.log(`  ⚠️ Erro ao consultar com token de página: ${err.response?.data?.error?.message || err.message}`);
        }
      }
    }

  } catch (error: any) {
    console.error("❌ Erro ao consultar a Graph API:", error.response?.data || error.message);
  }
}

findInstagramPage();
