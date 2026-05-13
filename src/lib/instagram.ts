import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

/**
 * Sobe a imagem local para o Cloudinary para obter um link público
 */
async function uploadToCloudinary(imagePath: string): Promise<string> {
  console.log(`☁️ Subindo imagem para o Cloudinary: ${path.basename(imagePath)}`);
  const result = await cloudinary.uploader.upload(imagePath, {
    folder: 'oraculo_bola',
    public_id: `post_${Date.now()}`
  });
  return result.secure_url;
}

/**
 * Publica no Feed do Instagram usando a Graph API Oficial
 * Suporta agendamento via scheduledTime (Unix Timestamp)
 */
export async function postToInstagram(imagePath: string, caption: string, scheduledTime?: number) {
  try {
    if (!IG_USER_ID || !ACCESS_TOKEN) {
      throw new Error("IG_USER_ID ou FB_ACCESS_TOKEN não configurados!");
    }

    // 1. Upload da imagem para o Cloudinary
    const publicImageUrl = await uploadToCloudinary(imagePath);
    console.log("🔗 Link público gerado:", publicImageUrl);

    // 2. Criar o Container de Mídia no Instagram
    console.log(scheduledTime ? `📦 Agendando container para ${new Date(scheduledTime * 1000).toLocaleString()}...` : "📦 Criando container de mídia imediato...");
    
    const params: any = {
      image_url: publicImageUrl,
      caption: caption,
      access_token: ACCESS_TOKEN
    };

    if (scheduledTime) {
      params.scheduled_publish_time = scheduledTime;
    }

    const containerResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${IG_USER_ID}/media`,
      null,
      { params }
    );

    const creationId = containerResponse.data.id;

    // 3. Publicar a mídia (Se for agendado, o creationId já basta para o fluxo de agendamento em alguns casos, 
    // mas na Graph API, posts agendados são finalizados no media_publish)
    console.log(scheduledTime ? "🚀 Finalizando agendamento..." : "🚀 Publicando post oficial...");
    
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: ACCESS_TOKEN
        }
      }
    );

    console.log(scheduledTime ? "✅ AGENDADO COM SUCESSO!" : "✅ POSTADO COM SUCESSO!");
    return publishResponse.data.id;

  } catch (error: any) {
    console.error("❌ Erro na postagem oficial:", error.response?.data?.error?.message || error.message);
    throw error;
  }
}

/**
 * Publica um Story (A API Oficial tem limitações para Stories, 
 * então por enquanto focaremos no Feed que é 100% estável)
 */
export async function postStory(imagePath: string) {
  console.log("⚠️ Postagem de Story via API Oficial requer permissões extras de App Review.");
  console.log("Focando no Feed por enquanto para garantir estabilidade.");
  return null;
}

export async function getFollowersCount(): Promise<number> {
  try {
    const response = await axios.get(`https://graph.facebook.com/v22.0/${process.env.IG_USER_ID}`, {
      params: {
        fields: 'followers_count',
        access_token: process.env.FB_ACCESS_TOKEN
      }
    });
    return response.data.followers_count || 0;
  } catch (error) {
    console.error("❌ Erro ao buscar contador de seguidores:", error);
    return 0;
  }
}
