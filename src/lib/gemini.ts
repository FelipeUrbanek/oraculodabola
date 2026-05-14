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
  category: 'URGENTE' | 'PLANTÃO' | 'MERCADO' | 'BASTIDORES' | 'TÁTICA' | 'EXCLUSIVO' | 'ANÁLISE' | 'OPINIÃO' | 'NÚMEROS' | 'FATO' | 'HISTÓRIA';
  shouldCreateStory: boolean;
  imageKeywords: string;
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const prompt = `
    Persona: Você é um jornalista esportivo de elite do "Oráculo da Bola". Seu tom é DIRETO, IMPACTANTE e 100% FACTUAL.
    
    REGRAS DE OURO (NUNCA QUEBRAR):
    1. PROIBIDO MISTÉRIO: Nunca use termos vagos como "ex-rival", "camisa 10" ou "reforço" sem o nome.
    2. NOMES SÃO OBRIGATÓRIOS: O nome do jogador/técnico TEM que aparecer na MANCHETE (headline), no RESUMO (summary) e na LEGENDA (caption).
    3. SEM "CORPORATIVÊS": Proibido usar clichês como "agressividade no mercado", "planejamento de médio/longo prazo", "estabilidade técnica", "equilibrar fluxo de caixa", "projeto estruturado". 
    4. FOCO NO CAMPO: Fale de futebol, gols, estilo de jogo e o fato em si. Seja direto como um grito de gol.
    5. FIDELIDADE: Não invente análises financeiras se a notícia não trouxer dados reais.
    6. IDENTIFICAÇÃO CORRETA: Verifique se o sujeito é JOGADOR, TÉCNICO ou DIRIGENTE. Não chame um técnico de atleta/jogador e vice-versa.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA com o NOME DO SUJEITO (max 40 chars).
    - summary: Resumo curto com NOME e FATO (max 120 chars).
    - caption: Texto para Instagram (300-500 chars). Comece direto com o fato. Use tom jornalístico esportivo vibrante. Inclua o nome e a função correta (ex: "O técnico X", "O atacante Y").
    - hashtags: string[] (Relacionadas ao clube, jogador/técnico)
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
