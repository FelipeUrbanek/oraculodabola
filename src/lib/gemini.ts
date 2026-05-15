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
    1. PROIBIDO MISTÉRIO: Se a notícia menciona um jogador/técnico/dirigente pelo nome, você DEVE usar esse nome. Nunca substitua um nome por "ex-rival", "camisa 10" ou "o reforço".
    2. NOMES QUANDO EXISTIREM: Se a notícia trata de UMA PESSOA ESPECÍFICA, o nome dela TEM QUE aparecer na manchete, resumo e legenda. Se a notícia for sobre um CLUBE, RESULTADO ou COMPETIÇÃO (sem protagonista específico), não há problema em não ter nome de pessoa.
    3. NUNCA USE PLACEHOLDERS: Proibido usar "[Nome]", "[Jogador]", "[Técnico]" ou qualquer campo vazio para preencher depois.
    4. PILARES EDITORIAIS (ESCOLHA O MELHOR PARA O FATO):
       - BREAKING NEWS: Para contratações, demissões ou bastidores urgentes.
       - CONTEXTO EM 3 PONTOS: Para notícias detalhadas. Use a estrutura "Entenda em 3 pontos:" no caption.
       - OPINIÃO/ENGAJAMENTO: Para polêmicas. Termine o caption com uma pergunta provocativa para o seguidor (Ex: "Erro da diretoria ou pressão da torcida?").
    5. SEM "CORPORATIVÊS": Proibido clichês como "agressividade no mercado", "equilibrar fluxo de caixa", "projeto estruturado".
    6. CAPTION RICO EM FATOS: A legenda DEVE explicar O QUÊ aconteceu com detalhes. NUNCA seja vago — o leitor precisa saber o fato completo no Instagram.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA impactante (max 40 chars).
    - summary: Resumo curto com o FATO PRINCIPAL (max 120 chars).
    - caption: Texto para Instagram (350-500 chars). Use um dos pilares (Urgência, 3 Pontos ou Pergunta Final). Seja vibrante e rico em detalhes.
    - hashtags: string[] (Relacionadas ao clube, jogador/técnico, competição)
    - category: Uma das oficiais: URGENTE, PLANTÃO, MERCADO, BASTIDORES, TÁTICA, EXCLUSIVO, ANÁLISE, OPINIÃO, NÚMEROS, FATO, HISTÓRIA.
    - shouldCreateStory: boolean
    - imageKeywords: string
  `;

  const processed: ProcessedContent = await callGemini(prompt);
  
  // Validação Anti-Placeholder (Evita postagens com "[Nome]", "(Nome)", etc)
  const placeholders = [
    "[Nome]", "[NOME]", "[atleta]", "[jogador]", "[técnico]", "[dirigente]",
    "(Nome)", "(NOME)", "{Nome}", "{NOME}", "[Nome do Jogador]", "[Nome do Atleta]",
    "[Insira Nome]", "[Nome do Técnico]", "[Jogador]", "[Clube]", "ERRO:"
  ];
  const contentStr = JSON.stringify(processed);
  if (placeholders.some(p => contentStr.includes(p))) {
    throw new Error(`❌ Erro de Placeholder detectado: ${processed.headline}`);
  }

  return processed;
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
