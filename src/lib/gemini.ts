import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLD_STATE_PATH = path.join(__dirname, '..', 'world_state.json');

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

function loadWorldState() {
  if (fs.existsSync(WORLD_STATE_PATH)) {
    try { return JSON.parse(fs.readFileSync(WORLD_STATE_PATH, 'utf-8')); } catch (e) { return {}; }
  }
  return {};
}

function saveWorldState(state: any) {
  try {
    state.last_updated = new Date().toISOString();
    fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) { console.error('Erro ao salvar World State:', e); }
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const worldState = loadWorldState();
  const worldStateContext = JSON.stringify(worldState.teams || {}, null, 2);

  const prompt = `
    Persona: Você é um jornalista esportivo de elite do "Oráculo da Bola". Seu tom é DIRETO, IMPACTANTE e 100% FACTUAL. Estamos em MAIO DE 2026.
    
    MEMÓRIA DO MUNDO (Use isso para evitar erros sobre quem é o técnico ou em qual liga o time está):
    ${worldStateContext}

    REGRAS DE OURO:
    1. PROIBIDO MISTÉRIO: Use nomes reais. Nunca substitua por apelidos ou descrições vagas.
    2. LISTE OS NOMES: Se a notícia cita vários jogadores, liste-os individualmente no caption.
    3. VALORES EXATOS: Procure e use valores monetários exatos (ex: R$ 5,4 milhões).
    4. FIDELIDADE ABSOLUTA: Use APENAS os nomes que aparecem na notícia ou que estão na MEMÓRIA DO MUNDO. Se a memória diz que o técnico do Fortaleza é Carpini, não diga que é Vojvoda.
    5. NUNCA USE PLACEHOLDERS.
    6. VARIANT STYLES: Diversifique o estilo da legenda. Use "Entenda os detalhes:" em vez de sempre "3 pontos".
    7. CAPTION RICO: Explique o fato com profundidade.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA (max 40 chars). Impactante e criativa.
    - summary: Fato principal (max 120 chars).
    - caption: Texto para Instagram (350-500 chars).
    - hashtags: string[]
    - category: URGENTE, PLANTÃO, MERCADO, BASTIDORES, TÁTICA, EXCLUSIVO, ANÁLISE, OPINIÃO, NÚMEROS, FATO, HISTÓRIA.
    - shouldCreateStory: boolean
    - imageKeywords: string
  `;

  let processed: ProcessedContent = await callGemini(prompt);

  // --- CAMADA DE REVISÃO (FACT-CHECK) ---
  console.log(`🔍 Revisando fatos para: ${processed.headline}...`);
  const revisionPrompt = `
    Persona: Você é o Revisor-Chefe do "Oráculo da Bola". Sua missão é GARANTIR A PRECISÃO.
    
    FONTE DA VERDADE (Notícia Atual): ${snippet}
    MEMÓRIA DO MUNDO (Contexto): ${worldStateContext}
    
    CONTEÚDO GERADO:
    ${JSON.stringify(processed, null, 2)}
    
    HIERARQUIA DE VERDADE:
    1. A Notícia Atual é a autoridade MÁXIMA. Se a notícia diz que o técnico mudou, IGNORE a Memória do Mundo.
    2. A Memória do Mundo serve apenas para preencher lacunas (ex: se a notícia cita "o técnico" sem dar nome, use o nome da Memória).
    3. Seu Conhecimento de Treinamento (IA) é a última prioridade e nunca deve contradizer os itens acima.
    
    TAREFA:
    - Se a notícia atual menciona um NOVO NOME (técnico/jogador) que é diferente da Memória, MANTENHA o nome da notícia.
    - Se a notícia não dá o nome mas a Memória tem, use o da Memória.
    - Corrija qualquer "alucinação" de nomes famosos que não estão no texto (ex: não deixe passar 'Vojvoda' se o técnico atual for outro).
    - Certifique-se de que todos os jogadores listados na notícia como desfalques apareçam no post.
    
    Retorne o JSON FINAL corrigido:
  `;
  
  try {
    const revised = await callGemini(revisionPrompt);
    processed = revised;
  } catch (e) {
    console.warn('⚠️ Falha na camada de revisão, usando original.');
  }
  
  // --- ATUALIZAÇÃO DA MEMÓRIA DO MUNDO ---
  const updatePrompt = `
    Analise a notícia e atualize a Memória do Mundo.
    Notícia: ${title} - ${snippet}
    
    Regras de Atualização:
    - Identifique o técnico atual do time e a competição/liga que estão disputando.
    - Se a notícia diz que alguém FOI DEMITIDO, remova o nome ou marque como vago.
    - Se a notícia confirma uma CONTRATAÇÃO, adicione ao contexto do time.
    
    Retorne um JSON com a estrutura sugerida para 'teams':
    {
      "teams": {
        "Nome do Time": { "coach": "Nome", "league": "Nome", "recent_changes": "Descrição curta" }
      }
    }
    Retorne apenas as mudanças detectadas. Se nada mudou, retorne {}.
  `;
  try {
    const updates = await callGemini(updatePrompt);
    if (updates.teams && Object.keys(updates.teams).length > 0) {
      const newState = { ...worldState, teams: { ...(worldState.teams || {}), ...updates.teams } };
      saveWorldState(newState);
      console.log('🧠 Memória do Mundo atualizada.');
    }
  } catch (e) {}

  // Validação Anti-Placeholder
  const placeholders = ["[Nome]", "[NOME]", "[atleta]", "[jogador]", "[técnico]", "[dirigente]", "ERRO:"];
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
