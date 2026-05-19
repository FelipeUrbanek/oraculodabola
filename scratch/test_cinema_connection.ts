import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IG_USER_ID_CINEMA = process.env.IG_USER_ID_CINEMA;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function testCinemaConnection() {
  console.log("🎬 [TESTE DE CONEXÃO CINEMA] Validando token de 60 dias para Espectador Comum...");
  console.log(`🆔 ID do Instagram do Cinema: ${IG_USER_ID_CINEMA}`);

  if (!IG_USER_ID_CINEMA || !ACCESS_TOKEN) {
    console.error("❌ Erro: IG_USER_ID_CINEMA ou FB_ACCESS_TOKEN ausentes no .env.local!");
    process.exit(1);
  }

  try {
    // Fazer uma requisição de leitura básica no perfil do Instagram
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${IG_USER_ID_CINEMA}`,
      {
        params: {
          fields: "username,name,biography,media_count,followers_count",
          access_token: ACCESS_TOKEN
        }
      }
    );

    const data = response.data;
    console.log("\n========================================================");
    console.log("✅ [CONEXÃO CINEMA ATIVA & FUNCIONANDO 100%!]");
    console.log("========================================================");
    console.log(`📸 Username do Instagram : @${data.username}`);
    console.log(`👤 Nome da Conta        : ${data.name}`);
    console.log(`📝 Biografia Atual      : ${data.biography || "Sem biografia"}`);
    console.log(`📊 Número de Posts      : ${data.media_count}`);
    console.log(`👥 Seguidores           : ${data.followers_count}`);
    console.log("========================================================");
    console.log("🚀 A conta @espectadorcomum está 100% pronta para receber postagens automáticas!");

  } catch (error: any) {
    console.error("\n❌ Falha na conexão com a Graph API do Instagram:");
    console.error(error.response?.data || error.message);
  }
}

testCinemaConnection();
