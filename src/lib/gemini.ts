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
    2. CONTEÚDO REAL: Proibido dizer "manda recado", "faz revelação" ou "quebra o silêncio" SEM DIZER EXATAMENTE O QUE FOI DITO. Se você usar essas expressões, a frase seguinte DEVE conter a aspa ou o resumo real do recado.
    3. NOMES QUANDO EXISTIREM: Se a notícia trata de UMA PESSOA ESPECÍFICA, o nome dela TEM QUE aparecer na manchete, resumo e legenda. 
    4. NUNCA USE PLACEHOLDERS: Proibido usar "[Nome]", "[Jogador]", "[Técnico]" ou qualquer campo vazio para preencher depois.
    5. PILARES EDITORIAIS (ESCOLHA O MELHOR PARA O FATO):
       - BREAKING NEWS: Para contratações, demissões ou bastidores urgentes.
       - CONTEXTO EM 3 PONTOS: Para notícias detalhadas. Use a estrutura "Entenda em 3 pontos:" no caption.
       - OPINIÃO/ENGAJAMENTO: Para polêmicas. Termine o caption com uma pergunta provocativa para o seguidor.
    6. SEM "CORPORATIVÊS": Proibido clichês como "agressividade no mercado", "equilibrar fluxo de caixa", "projeto estruturado".
    7. CAPTION RICO EM FATOS: A legenda DEVE explicar O QUÊ aconteceu com detalhes. NUNCA seja vago — o leitor precisa saber o fato completo no Instagram. Se a notícia fala de um "recado", descreva o conteúdo desse recado.

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

/**
 * Filtra notícias que possuem o mesmo tema de notícias já postadas recentemente.
 */
export async function filterDuplicateThemes(candidates: { title: string }[], historyTitles: string[]): Promise<number[]> {
  if (candidates.length === 0) return [];
  if (historyTitles.length === 0) return candidates.map((_, i) => i);

  const prompt = `
    Persona: Você é o Editor-Chefe do "Oráculo da Bola". Sua missão é evitar REPETIÇÃO.
    
    Abaixo estão os títulos das notícias que JÁ POSTAMOS recentemente:
    ${historyTitles.slice(-20).map(t => `- ${t}`).join('\n')}

    Abaixo estão as NOVAS candidatas:
    ${candidates.map((c, i) => `[${i}] ${c.title}`).join('\n')}

    TAREFA:
    Analise se as novas candidatas tratam do MESMO FATO ou MESMO ASSUNTO que já foi postado.
    Mesmo que o título seja diferente, se a NOTÍCIA CENTRAL (ex: contratação de X, demissão de Y, resultado do jogo Z) for a mesma, ela deve ser REPROVADA.
    
    CRITÉRIOS DE REPROVAÇÃO:
    - Se já postamos que Dorival foi para o SPFC, qualquer nova notícia sobre "Dorival assume", "Dorival oficializado", "Dorival chega" deve ser REPROVADA.
    - Se já postamos o resultado de um jogo, novas notícias com apenas o placar ou "vitoria do time X" devem ser REPROVADAS.
    
    CRITÉRIOS DE APROVAÇÃO:
    - Somente fatos novos, temas inéditos ou desdobramentos significativos (ex: uma análise tática profunda de algo que antes era só notícia).

    Retorne APENAS um JSON array com os índices das notícias APROVADAS.
    Exemplo: [1, 3]
  `;

  try {
    const res = await callGemini(prompt);
    return Array.isArray(res) ? res : candidates.map((_, i) => i);
  } catch (e) {
    console.error('⚠️ Falha ao filtrar temas duplicados com Gemini:', e);
    return candidates.map((_, i) => i);
  }
}
