import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface ProcessedContent {
  headline: string;
  summary: string;
  caption: string;
  hashtags: string[];
  category: 'MERCADO' | 'URGENTE' | 'HOJE' | 'EXCLUSIVO' | 'ORÁCULO' | 'OPINIÃO' | 'NÚMEROS' | 'ANÁLISE' | 'PLANTÃO';
  shouldCreateStory: boolean;
  imageKeywords: string;
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const prompt = `
    Persona: Você é um jornalista esportivo brasileiro de elite. Seu tom é profissional, informativo e dinâmico. Você foca nos fatos, nomes e números de forma clara e objetiva, como um repórter dos grandes portais de esportes do Brasil (Globo, ESPN, TNT).
    
    Analise esta notícia: "${title}" - "${snippet}"
 
    Retorne um JSON estrito com:
    - headline: Manchete direta e jornalística (max 50 caracteres).
    - summary: Resumo informativo dos fatos para a arte (max 150 caracteres).
    - caption: Legenda MAGNA e EXTENSA para o Instagram (Mínimo de 600 e MÁXIMO de 1200 caracteres). Estrutura: 1. Manchete impactante com emojis, 2. Parágrafo detalhado sobre o fato, 3. Parágrafo de ANÁLISE TÁTICA ou CONTEXTO HISTÓRICO, 4. Parágrafo sobre o que isso muda para o time/jogador no futuro, 5. Pergunta engajadora. Seja um jornalista de elite, imparcial e profundo. (NÃO use hashtags aqui).
    - hashtags: 3 a 5 hashtags sobre o time ou assunto.
    - category: Escolha APENAS UMA entre: 'MERCADO', 'URGENTE', 'HOJE', 'EXCLUSIVO', 'ORÁCULO', 'OPINIÃO', 'NÚMEROS', 'ANÁLISE', 'PLANTÃO'.
    - shouldCreateStory: true se a notícia for importante, false se for secundária.
    - imageKeywords: Uma string com 3 palavras-chave para busca de imagem.

    Importante: Retorne APENAS o JSON.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return JSON.parse(text.replace(/```json|```/g, ""));
}
