import 'dotenv/config';
import { IgApiClient } from 'instagram-private-api';
import Database from 'better-sqlite3';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

const ig = new IgApiClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const db = new Database('engagement.db');

// Inicializa o banco de dados
db.exec(`
  CREATE TABLE IF NOT EXISTS interactions (
    target_id TEXT PRIMARY KEY,
    type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Sistema de Login com Persistência de Sessão
 */
async function login() {
  const username = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;

  if (!username || !password) {
    throw new Error("IG_USERNAME ou IG_PASSWORD não configurados no .env.local");
  }

  ig.state.generateDevice(username);
  
  // Opcional: Carregar cookies/sessão anterior para evitar logins frequentes
  // const sessionPath = path.join(process.cwd(), 'session.json');
  // if (fs.existsSync(sessionPath)) { ... }

  await ig.account.login(username, password);
  console.log(`🔐 Logado com sucesso em @${username}`);
}

/**
 * Gera um comentário humanizado usando Gemini
 */
async function generateHumanComment(postCaption: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    Você é um torcedor brasileiro apaixonado por futebol.
    Com base na legenda deste post: "${postCaption.substring(0, 500)}"
    
    Escreva um comentário curto (máximo 15 palavras), natural e engajador em português.
    REGRAS:
    1. Não use hashtags.
    2. Use no máximo 1 emoji.
    3. Pareça uma pessoa real, não um bot.
    4. Pode ser um elogio, uma dúvida ou uma opinião rápida.
    5. Se a legenda estiver vazia, faça um comentário genérico positivo sobre futebol.
    
    Retorne APENAS o texto do comentário.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    return "Muito bom! ⚽";
  }
}

/**
 * Segue seguidores de um perfil alvo (concorrência)
 */
export async function growFollowers(targetUsername: string = 'ge.globo', limit: number = 5) {
  try {
    await login();
    
    console.log(`🔍 Buscando seguidores de @${targetUsername}...`);
    const targetUser = await ig.user.searchExact(targetUsername);
    const followersFeed = ig.feed.accountFollowers(targetUser.pk);
    const items = await followersFeed.items();
    
    let followedCount = 0;
    for (const item of items) {
      if (followedCount >= limit) break;
      
      // Verifica se já interagimos
      const existing = db.prepare("SELECT 1 FROM interactions WHERE target_id = ?").get(item.pk.toString());
      if (existing) continue;
      
      try {
        await ig.friendship.create(item.pk);
        db.prepare("INSERT INTO interactions (target_id, type) VALUES (?, ?)").run(item.pk.toString(), 'follow');
        console.log(`✅ Seguindo: @${item.username}`);
        followedCount++;
        
        // Delay humano (15-30 segundos)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 15000 + 15000));
      } catch (e: any) {
        console.warn(`⚠️ Não foi possível seguir @${item.username}: ${e.message}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Erro no crescimento de seguidores:", error.message);
  }
}

/**
 * Comenta em posts de uma hashtag
 */
export async function engageHashtag(hashtag: string = 'brasileirao', limit: number = 3) {
  try {
    await login();
    
    console.log(`#️⃣ Buscando posts na hashtag #${hashtag}...`);
    const tagFeed = ig.feed.tag(hashtag);
    const posts = await tagFeed.items();
    
    let commentedCount = 0;
    for (const post of posts) {
      if (commentedCount >= limit) break;
      
      // Evita comentar no próprio post ou em posts já interagidos
      const existing = db.prepare("SELECT 1 FROM interactions WHERE target_id = ?").get(post.id);
      if (existing) continue;

      const caption = post.caption?.text || "";
      const commentText = await generateHumanComment(caption);
      
      try {
        await ig.media.comment(post.id, commentText);
        db.prepare("INSERT INTO interactions (target_id, type) VALUES (?, ?)").run(post.id, 'comment');
        console.log(`💬 Comentado em post de @${post.user.username}: "${commentText}"`);
        commentedCount++;
        
        // Delay humano (30-60 segundos)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));
      } catch (e: any) {
        console.warn(`⚠️ Erro ao comentar: ${e.message}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Erro no engajamento por hashtag:", error.message);
  }
}
