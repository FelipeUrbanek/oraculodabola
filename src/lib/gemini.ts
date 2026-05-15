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
    3. NUNCA USE PLACEHOLDERS: Proibido usar "[Nome]", "[Jogador]", "[Técnico]" ou qualquer campo vazio para preencher depois. Se não souber um nome que deveria estar, use o que foi fornecido na notícia.
    4. SEM "CORPORATIVÊS": Proibido usar clichês como "agressividade no mercado", "planejamento de médio/longo prazo", "estabilidade técnica", "equilibrar fluxo de caixa", "projeto estruturado".
    5. CAPTION RICO EM FATOS: A legenda DEVE explicar O QUÊ aconteceu com detalhes. Ex: se alguém reclamou, diga do quê reclamou. Se houve uma oferta, diga o valor e por quem. Se foi um gol, descreva o lance. NUNCA seja vago no caption — o leitor precisa saber o fato completo sem precisar clicar no link.
    6. FIDELIDADE: Use apenas os fatos presentes na notícia. Não invente dados, valores ou declarações.
    7. IDENTIFICAÇÃO CORRETA: Verifique se o sujeito é JOGADOR, TÉCNICO ou DIRIGENTE. Não chame um técnico de atleta/jogador e vice-versa.
    8. SEMPRE POSTE: Nunca retorne um JSON indicando erro ou ausência. Sempre produza conteúdo com as informações disponíveis.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA impactante (max 40 chars). Se houver nome de pessoa relevante, inclua-o.
    - summary: Resumo curto com o FATO PRINCIPAL (max 120 chars). Inclua nome se houver protagonista.
    - caption: Texto para Instagram (350-500 chars). Comece DIRETO com o fato principal. Explique O QUÊ aconteceu, POR QUÊ é relevante, e QUAl é o contexto. Use tom jornalístico esportivo vibrante. NUNCA seja vago — inclua detalhes concretos da notícia.
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
