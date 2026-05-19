import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function testFootballConnection() {
  console.log("⚡ [TESTE DE CONEXÃO] Validando token de 60 dias...");
  console.log(`🆔 ID do Instagram do Futebol: ${IG_USER_ID}`);

  if (!IG_USER_ID || !ACCESS_TOKEN) {
    console.error("❌ Erro: IG_USER_ID ou FB_ACCESS_TOKEN ausentes no .env.local!");
    process.exit(1);
  }

  try {
    // Fazer uma requisição de leitura básica no perfil do Instagram
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${IG_USER_ID}`,
      {
        params: {
          fields: "username,name,biography,media_count,followers_count",
          access_token: ACCESS_TOKEN
        }
      }
    );

    const data = response.data;
    console.log("\n========================================================");
    console.log("✅ [CONEXÃO ATIVA & FUNCIONANDO 100%!]");
    console.log("========================================================");
    console.log(`📸 Username do Instagram : @${data.username}`);
    console.log(`👤 Nome da Conta        : ${data.name}`);
    console.log(`📝 Biografia Atual      : ${data.biography || "Sem biografia"}`);
    console.log(`📊 Número de Posts      : ${data.media_count}`);
    console.log(`👥 Seguidores           : ${data.followers_count}`);
    console.log("========================================================");
    console.log("🚀 O token de 60 dias está totalmente validado, ativo e autorizado!");

  } catch (error: any) {
    console.error("\n❌ Falha na conexão com a Graph API do Instagram:");
    console.error(error.response?.data || error.message);
    console.error("\nPor favor, verifique se o token foi colado corretamente e tem as permissões de Instagram.");
  }
}

testFootballConnection();
