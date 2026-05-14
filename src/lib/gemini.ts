import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Usando o modelo MAIS NOVO disponível no mundo (3.1 Flash!)
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-live-preview" });

export interface ProcessedContent {
  headline: string;
  summary: string;
  caption: string;
  hashtags: string[];
  category: 'MERCADO' | 'URGENTE' | 'HOJE' | 'EXCLUSIVO' | 'ORÁCULO' | 'OPINIÃO' | 'NÚMEROS' | 'ANÁLISE' | 'PLANTÃO';
  shouldCreateStory: boolean;
  imageKeywords: string;
}

export interface NewsCandidate {
  title: string;
  snippet: string;
  source?: string;
  pubDate: string;
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const prompt = `
    Persona: Você é um jornalista esportivo brasileiro de elite. Seu tom é profissional, informativo e dinâmico.
    
    REGRAS CRÍTICAS:
    - PROIBIDO VAGUEZA: Nunca use frases como "mandou recado", "fez declaração forte" sem dizer O QUE foi dito.
    - SEJA ESPECÍFICO: Extraia o fato real do título e snippet.
    - Como estamos no Instagram, não temos links clicáveis. 
    - PROIBIDO: Não use NENHUM emoji ou ícone nos campos "headline" e "summary".
    
    Analise: "${title}" - "${snippet}"
 
    Retorne um JSON estrito com:
    - headline: Manchete Factual (max 40 caracteres).
    - summary: Resumo com o FATO REAL (max 140 caracteres).
    - caption: Legenda profunda para o Instagram (Mínimo de 500 e MÁXIMO de 1000 caracteres).
    - hashtags: 3 a 5 hashtags.
    - category: Uma entre 'URGENTE', 'PLANTÃO', 'MERCADO', 'HOJE', 'EXCLUSIVO', 'ANÁLISE', 'OPINIÃO', 'NÚMEROS', 'ORÁCULO'.
    - shouldCreateStory: boolean.
    - imageKeywords: 3 palavras-chave.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    let parsedResult = JSON.parse(text);
    if (parsedResult.caption.length > 2000) {
      parsedResult.caption = parsedResult.caption.substring(0, 1990) + "...";
    }
    return parsedResult;
  } catch (e) {
    console.error("Erro Gemini 3.1:", e);
    throw e;
  }
}

export async function filterFootballOnly(candidates: any[]): Promise<number[]> {
  const prompt = `Selecione os índices das notícias MAIS QUENTES sobre futebol masculino. Ignore TV e enquetes. 
  Notícias:\n${candidates.map((c, i) => `${i}: ${c.title}`).join('\n')}
  Responda APENAS o array JSON. Ex: [0, 3]`;
  try {
    const result = await model.generateContent(prompt);
    const match = result.response.text().match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (e) { return candidates.map((_, i) => i); }
}

export async function rankBestNews(newsList: any[]): Promise<any> {
  if (newsList.length <= 1) return newsList[0] || null;
  const newsContext = newsList.map((n, i) => `[${i}] ${n.category}: ${n.title}`).join('\n');
  const prompt = `Escolha o índice da ÚNICA notícia com mais engajamento. Priorize o FRESCOR (mais novas).
  Lista:\n${newsContext}\nResponda APENAS o número do índice.`;
  try {
    const result = await model.generateContent(prompt);
    const index = parseInt(result.response.text().trim().replace(/[^0-9]/g, ''));
    return newsList[index] || newsList[0];
  } catch (e) { return newsList[0]; }
}
