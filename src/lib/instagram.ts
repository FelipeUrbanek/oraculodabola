import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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
 * Calcula o próximo horário de pico (12h, 18h, 21h BRT)
 */
export function calculateNextSchedule(): number {
  const now = new Date();
  const peaks = [12, 18, 21];
  
  let target = new Date(now);
  target.setMinutes(0, 0, 0);

  for (const hour of peaks) {
    if (now.getHours() < hour) {
      target.setHours(hour);
      return Math.floor(target.getTime() / 1000);
    }
  }

  // Se passou das 21h, agenda para as 12h do dia seguinte
  target.setDate(target.getDate() + 1);
  target.setHours(12);
  return Math.floor(target.getTime() / 1000);
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

    // 3. Aguardar o processamento da mídia (Instagram pode levar alguns segundos)
    console.log("⏳ Aguardando processamento do Instagram...");
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Espera 10 segundos
      const statusResponse = await axios.get(`https://graph.facebook.com/v21.0/${creationId}`, {
        params: { fields: 'status_code', access_token: ACCESS_TOKEN }
      });
      const status = statusResponse.data.status_code;
      console.log(`Status da mídia: ${status}`);
      if (status === 'FINISHED') {
        ready = true;
      } else if (status === 'ERROR') {
        throw new Error("Erro no processamento da mídia pelo Instagram.");
      }
      attempts++;
    }

    if (!ready) throw new Error("Tempo limite de processamento excedido.");

    // 4. Publicar a mídia
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

/**
 * Responde automaticamente aos comentários dos seus posts (Engajamento Humanizado)
 * Apenas usando a API Oficial.
 */
export async function autoReplyToComments() {
  try {
    console.log("💬 Verificando novos comentários para responder...");
    
    // 1. Pegar as mídias recentes
    const mediaResponse = await axios.get(`https://graph.facebook.com/v22.0/${IG_USER_ID}/media`, {
      params: { access_token: ACCESS_TOKEN, limit: 10 }
    });
    
    const mediaList = mediaResponse.data.data;
    const REPLIES_FILE = path.join(process.cwd(), 'src', 'replies.json');
    let repliedIds: string[] = fs.existsSync(REPLIES_FILE) ? JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf-8')) : [];

    for (const media of mediaList) {
      // 2. Pegar comentários de cada mídia
      const commentsResponse = await axios.get(`https://graph.facebook.com/v22.0/${media.id}/comments`, {
        params: { access_token: ACCESS_TOKEN, fields: 'id,text,from,timestamp' }
      });

      const comments = commentsResponse.data.data || [];
      for (const comment of comments) {
        // Ignora se for comentário do próprio Oráculo ou se já respondemos
        if (comment.from?.id === IG_USER_ID || repliedIds.includes(comment.id)) continue;

        console.log(`👤 Comentário de @${comment.from?.username || 'usuário'}: "${comment.text}"`);

        // 3. Gerar resposta humanizada com Gemini
        const replyText = await generateReplyWithGemini(comment.text, comment.from?.username);

        // 4. Postar a resposta
        try {
          await axios.post(`https://graph.facebook.com/v22.0/${comment.id}/replies`, null, {
            params: { message: replyText, access_token: ACCESS_TOKEN }
          });
          
          console.log(`✅ Respondido: "${replyText}"`);
          repliedIds.push(comment.id);
          fs.writeFileSync(REPLIES_FILE, JSON.stringify(repliedIds.slice(-1000), null, 2));
          
          // Pequeno delay entre respostas
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (e: any) {
          console.error(`❌ Erro ao responder comentário ${comment.id}:`, e.response?.data?.error?.message || e.message);
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Erro no sistema de respostas automáticas:", error.response?.data?.error?.message || error.message);
  }
}

async function generateReplyWithGemini(userComment: string, username?: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
    Persona: Você é o "Oráculo da Bola", um perfil de notícias de futebol vibrante e interativo.
    Ação: Responda a este comentário de um seguidor chamado ${username || 'Fiel Seguidor'} de forma curta, simpática e humana.
    Comentário: "${userComment}"
    
    REGRAS:
    1. Máximo 15 palavras.
    2. Pode usar 1 emoji.
    3. Seja amigável e incentive a pessoa a continuar acompanhando.
    4. Use o nome/username da pessoa se parecer natural.
    5. Não use hashtags na resposta.
    
    Retorne APENAS o texto da resposta.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    return "Valeu por acompanhar o Oráculo! Tmj ⚽";
  }
}

/**
 * Faz um comentário em uma mídia específica (usado para o "Oracle Comment")
 */
export async function postComment(mediaId: string, message: string) {
  try {
    console.log(`💬 Postando comentário automático no post ${mediaId}...`);
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${mediaId}/comments`,
      null,
      {
        params: {
          message: message,
          access_token: ACCESS_TOKEN
        }
      }
    );
    console.log(`✅ Comentário postado! ID: ${response.data.id}`);
    return response.data.id;
  } catch (error: any) {
    console.error("❌ Erro ao postar comentário:", error.response?.data?.error?.message || error.message);
    return null;
  }
}
