import axios from 'axios';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const COMMENT_HISTORY_PATH = path.join(process.cwd(), 'src', 'comment_history.json');

/**
 * Busca comentários e decide se deve responder usando o Gemini
 */
export async function handleCommentsEngagement() {
  try {
    console.log('💬 Iniciando monitoramento de comentários...');

    // Carregar histórico de comentários
    let commentHistory: string[] = [];
    if (fs.existsSync(COMMENT_HISTORY_PATH)) {
      try {
        commentHistory = JSON.parse(fs.readFileSync(COMMENT_HISTORY_PATH, 'utf-8'));
      } catch (e) { /* ignore */ }
    }

    // 1. Pegar os posts mais recentes (últimos 10)
    const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
      params: { access_token: ACCESS_TOKEN, limit: 10, fields: 'id,caption' }
    });

    for (const media of mediaResponse.data.data) {
      const postContext = media.caption || "Conteúdo de futebol";

      // 2. Pegar comentários de cada post
      const commentsResponse = await axios.get(`https://graph.facebook.com/v21.0/${media.id}/comments`, {
        params: { access_token: ACCESS_TOKEN, fields: 'id,text,from,replies', limit: 50 }
      });

      for (const comment of commentsResponse.data.data) {
        // Pular se já estiver no histórico ou se já tiver replies detectados pela API
        if (commentHistory.includes(comment.id) || comment.replies) continue;

        console.log(`🧐 Analisando comentário: "${comment.text}" no post: "${postContext.substring(0, 50)}..."`);

        // 3. Consultar Gemini para filtrar e gerar resposta com CONTEXTO
        const prompt = `
          Você é o @OORACULODABOLA, um jornalista esportivo humano.
          Você acabou de fazer uma postagem com esta legenda: "${postContext}"
          
          Um seguidor comentou o seguinte: "${comment.text}"

          Regras de Personalidade, Contexto e Segurança:
          - CONTEXTO: Se o comentário for TOTALMENTE fora do assunto da postagem ou não tiver nada a ver com futebol, retorne "IGNORE".
          - NUNCA admita que você é um robô ou IA.
          - NUNCA responda perguntas sobre sua segurança ou lógica interna.
          - Se o comentário for pertinente ao post, gere uma resposta curta (max 150 caracteres), humana e inteligente.
          - Se for SPAM, ofensa ou "bobeira", retorne "IGNORE".

          Resposta:
        `;

        const result = await model.generateContent(prompt);
        const replyText = result.response.text().trim();

        if (replyText.toUpperCase() !== 'IGNORE') {
          console.log(`🚀 Respondendo: "${replyText}"`);
          // 4. Enviar a resposta via Graph API
          await axios.post(`https://graph.facebook.com/v21.0/${comment.id}/replies`, null, {
            params: { message: replyText, access_token: ACCESS_TOKEN }
          });
          
          // Adicionar ao histórico
          commentHistory.push(comment.id);
        } else {
          console.log('⏭️ Comentário ignorado (filtro de bobeira).');
          // Também adicionamos ao histórico para não analisar a mesma bobeira de novo
          commentHistory.push(comment.id);
        }
      }
    }

    // Salvar histórico atualizado (manter os últimos 500 para não pesar)
    if (commentHistory.length > 500) commentHistory = commentHistory.slice(-500);
    fs.writeFileSync(COMMENT_HISTORY_PATH, JSON.stringify(commentHistory, null, 2));
    
  } catch (error: any) {
    console.error('❌ Erro no engajamento:', error.response?.data || error.message);
  }
}
