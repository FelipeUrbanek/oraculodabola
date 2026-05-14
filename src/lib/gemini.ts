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
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, "").trim();
      return isJson ? JSON.parse(text) : text;
    } catch (e: any) {
      console.log(`⚠️ Modelo ${modelName} falhou.`);
    }
  }
  throw new Error("❌ Falha crítica: Nenhum modelo respondeu.");
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
    Persona: Você é um jornalista esportivo de elite. Seu tom é DIRETO, FACTUAL e sem enrolação.
    
    REGRAS DE OURO (NUNCA QUEBRAR):
    1. PROIBIDO MISTÉRIO: Nunca use termos vagos como "ex-rival", "camisa 10", "reforço bombástico" ou "ex-jogador do time X" para esconder o nome do atleta.
    2. NOMES SÃO OBRIGATÓRIOS: O nome do jogador/técnico TEM que aparecer na MANCHETE (headline) e no RESUMO (summary). 
       - ERRADO: "Ex-rival assina com São Paulo"
       - CERTO: "ROGER GUEDES ENCAMINHA ACERTO COM SÃO PAULO"
    3. SEM CLICKBAIT: O Oráculo da Bola entrega a informação de cara. Não faça o leitor ter que ler a legenda para saber de quem estamos falando.
    4. FATUALIDADE: Se a notícia não diz o nome, procure no snippet. Se não tiver nome nenhum, descarte a notícia ou foque no clube, mas NUNCA faça mistério.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA com o NOME DO JOGADOR (max 40 chars).
    - summary: Resumo curto e direto com o NOME DO JOGADOR e o FATO (max 140 chars).
    - caption: Análise profunda (500-1000 chars) explicando o impacto técnico/financeiro.
    - hashtags: string[]
    - category: Uma das oficiais.
    - shouldCreateStory: boolean
    - imageKeywords: string
  `;

  return await callGemini(prompt);
}

export async function filterFootballOnly(candidates: any[]): Promise<number[]> {
  const prompt = `Selecione índices de notícias REAIS de futebol masculino. Ignore enquetes e guias de TV. 
  Notícias:\n${candidates.map((c, i) => `${i}: ${c.title}`).join('\n')}
  Retorne JSON [index, index]`;
  try { return await callGemini(prompt); } catch (e) { return candidates.map((_, i) => i); }
}

export async function rankBestNews(newsList: any[]): Promise<any> {
  if (newsList.length <= 1) return newsList[0] || null;
  const newsContext = newsList.map((n, i) => `[${i}] ${n.category}: ${n.title}`).join('\n');
  const prompt = `Escolha a notícia de MAIOR impacto. Priorize o que é NOVO. 
  Responda APENAS o índice.\n${newsContext}`;
  try {
    const res = await callGemini(prompt, false);
    const index = parseInt(res.replace(/[^0-9]/g, ''));
    return newsList[index] || newsList[0];
  } catch (e) { return newsList[0]; }
}
