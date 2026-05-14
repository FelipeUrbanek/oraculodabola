import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Sistema de Modelos de Elite (Baseado na lista oficial v1beta)
 */
async function callGemini(prompt: string, isJson: boolean = true) {
  const models = [
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-flash-latest"
  ];
  
  for (const modelName of models) {
    try {
      console.log(`🤖 Tentando modelo de elite: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, "").trim();
      return isJson ? JSON.parse(text) : text;
    } catch (e: any) {
      console.log(`⚠️ Modelo ${modelName} indisponível: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error("❌ Falha crítica: Nenhum modelo de elite da lista respondeu.");
}

export interface ProcessedContent {
  headline: string;
  summary: string;
  caption: string;
  hashtags: string[];
  category: 'URGENTE' | 'PLANTÃO' | 'MERCADO' | 'HOJE' | 'EXCLUSIVO' | 'ANÁLISE' | 'OPINIÃO' | 'NÚMEROS' | 'ORÁCULO';
  shouldCreateStory: boolean;
  imageKeywords: string;
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const prompt = `
    Notícia: "${title}" - "${snippet}"
    Gere um JSON para o Instagram (Oráculo da Bola):
    - headline (max 40 chars, factual, sem vageza)
    - summary (max 140 chars, fato real)
    - caption (legenda 500-1000 chars, análise profunda)
    - hashtags (array)
    - category (MERCADO, URGENTE, HOJE, EXCLUSIVO, ANÁLISE, OPINIÃO, NÚMEROS, ORÁCULO ou PLANTÃO)
    - shouldCreateStory (boolean)
    - imageKeywords (string)
  `;
  return await callGemini(prompt);
}

export async function filterFootballOnly(candidates: any[]): Promise<number[]> {
  const prompt = `Selecione índices das notícias de futebol masculino:\n${candidates.map((c, i) => `${i}: ${c.title}`).join('\n')}\nRetorne array JSON.`;
  try { return await callGemini(prompt); } catch (e) { return candidates.map((_, i) => i); }
}

export async function rankBestNews(newsList: any[]): Promise<any> {
  if (newsList.length <= 1) return newsList[0] || null;
  const newsContext = newsList.map((n, i) => `[${i}] ${n.category}: ${n.title}`).join('\n');
  const prompt = `Escolha o índice da notícia de maior impacto e frescor:\n${newsContext}\nResponda apenas o número.`;
  try {
    const res = await callGemini(prompt, false);
    const index = parseInt(res.replace(/[^0-9]/g, ''));
    return newsList[index] || newsList[0];
  } catch (e) { return newsList[0]; }
}
