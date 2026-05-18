import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLD_STATE_PATH = path.join(__dirname, "..", "world_state.json");

// Define API keys and current index for rotation
const API_KEYS = [
  process.env.GEMINI_API_KEY || "", // Chave principal do .env
  process.env.GEMINI_API_KEY_BACKUP || "", // Chave de backup do .env
].filter(k => k !== "");
let currentKeyIndex = 0;

// Configuração da API do Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

async function callGroq(prompt: string, isJson: boolean = true) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Modelo atualizado e poderoso no Groq
        messages: [
          { role: "system", content: "Você deve sempre responder em Português do Brasil (pt-BR)." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
        throw new Error(`Groq API Error: ${response.statusText}`);
    }

    const data: any = await response.json();
    let text = data.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (isJson && jsonMatch) {
      text = jsonMatch[0];
    } else {
      text = text.replace(/```json|```/g, "").trim();
    }
    
    return isJson ? JSON.parse(text) : text;
  } catch (error: any) {
    console.log(`⚠️ Fallback para Groq falhou: ${error.message}`);
    throw new Error("❌ Falha crítica: Nenhum modelo (Gemini ou Groq) respondeu.");
  }
}

/**
 * Sistema de Modelos de Elite com Fallback
 */
async function callGemini(prompt: string, isJson: boolean = true, retryCount: number = 0): Promise<any> {
  const models = [
    "gemini-3.1-pro-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "gemini-pro-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
  ];

  // Se esgotamos as chaves, usamos o Groq como última opção
  if (retryCount >= API_KEYS.length) {
      console.warn(`\n[AVISO] Todas as chaves do Gemini falharam ou esgotaram a cota. Usando GROQ como fallback final...`);
      return await callGroq(prompt, isJson);
  }

  const currentKey = API_KEYS[currentKeyIndex];
  // Ignora chave vazia caso a principal do env nao esteja setada
  if(!currentKey) {
     currentKeyIndex++;
     return callGemini(prompt, isJson, retryCount + 1);
  }

  const genAI = new GoogleGenerativeAI(currentKey);

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      
      if (isJson) {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          text = jsonMatch[0];
        } else {
          text = text.replace(/```json|```/g, "").trim();
        }
        return JSON.parse(text);
      }
      return text;
    } catch (e: any) {
      console.log(`⚠️ Modelo ${modelName} com a chave ${currentKeyIndex + 1} falhou. Erro: ${e.message}`);
      // Verifica se o erro foi de rate limit ou cota excedida (429)
      if (e.message && e.message.includes("429")) {
         console.warn(`[AVISO] Chave ${currentKeyIndex + 1} exaurida. Rotacionando chave...`);
         currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
         return callGemini(prompt, isJson, retryCount + 1);
      }
    }
  }

  // Se passou por todos os modelos e não deu 429 mas todos falharam, roda chave de backup
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return callGemini(prompt, isJson, retryCount + 1);
}

export interface ProcessedContent {
  headline: string;
  summary: string;
  caption: string;
  hashtags: string[];
  category:
    | "URGENTE"
    | "PLANTÃO"
    | "MERCADO"
    | "BASTIDORES"
    | "TÁTICA"
    | "EXCLUSIVO"
    | "ANÁLISE"
    | "OPINIÃO"
    | "NÚMEROS"
    | "FATO"
    | "HISTÓRIA";
  mainTeam: string;
  isFocusedOnSingleTeam: boolean; // TRUE se a notícia for focada apenas em UM time principal. FALSE se citar rivais, vários times ou for um fato geral.
  shouldCreateStory: boolean;
  imageKeywords: string;
}

function loadWorldState() {
  if (fs.existsSync(WORLD_STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(WORLD_STATE_PATH, "utf-8"));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveWorldState(state: any) {
  try {
    state.last_updated = new Date().toISOString();
    fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("Erro ao salvar World State:", e);
  }
}

export async function processNewsWithGemini(
  title: string,
  snippet: string,
  teamName: string = "",
): Promise<ProcessedContent> {
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
    6. TRAVA DE NOMES: Se a notícia for sobre um PROFISSIONAL (jogador, técnico, dirigente) e o NOME PRÓPRIO não estiver disponível, REJEITE o post. Se a notícia for INSTITUCIONAL (multas, patrocínios, estádio, dívidas do clube), o nome do clube é suficiente.
    7. VARIANT STYLES: Diversifique o estilo da legenda. Use "Entenda os detalhes:" em vez de sempre "3 pontos".
    8. CAPTION RICO: Explique o fato com profundidade, mencionando explicitamente todos os nomes envolvidos, datas, locais e contextos principais.
    9. LIMITE DE CARACTERES: O caption deve ter entre 350 e 2000 caracteres. NUNCA exceda 2200 caracteres.
    10. LÓGICA DE ESCUDO: Se a notícia mencionar mais de um time (ex: clássico, negociação entre clubes, comparação), defina isFocusedOnSingleTeam como false. Se for sobre um fato interno de um clube apenas, defina como true.
    11. FILTRO DE ELITE: REJEITE (retorne JSON com headline "REJEITADO") se a notícia for sobre: Categorias de Base (Sub-20, Sub-17, etc.), Futebol Feminino, divisões inferiores (Série B, C, D), ou times pequenos sem relevância nacional imediata. O foco ÚNICO é ELITE (Série A Masculina) e Grandes Clubes.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA (max 40 chars). Impactante e criativa.
    - summary: Fato principal (max 120 chars).
    - caption: Texto para Instagram (350-500 chars).
    - hashtags: string[]
    - category: URGENTE, PLANTÃO, MERCADO, BASTIDORES, TÁTICA, EXCLUSIVO, ANÁLISE, OPINIÃO, NÚMEROS, FATO, HISTÓRIA.
    - mainTeam: O nome do time principal da notícia (Ex: "Flamengo", "Paraná Clube", "Real Madrid").
    - isFocusedOnSingleTeam: boolean (true se apenas um time é o foco, false se citar vários).
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
    - Corrija qualquer "alucinação" de nomes famosos que não estão no texto.
    - NUNCA use nomes genéricos como "[jogador]", "[atleta]" ou "joia" se o nome estiver no texto. 
    - Se a notícia cita um jogador, técnico ou dirigente, o nome DEVE aparecer na legenda.
    - Se você não encontrar o nome de jeito nenhum no texto e a notícia for sobre uma contratação/reforço, retorne Headline: "REJEITADO" e a justificativa no campo caption.
    
    Retorne o JSON FINAL corrigido:
  `;

  try {
    const revised = await callGemini(revisionPrompt);
    
    // Verificação de Identidade na revisão
    const revisedStr = JSON.stringify(revised).toLowerCase();
    if (teamName && teamName !== "MERCADO DA BOLA" && teamName !== "TREND") {
      if (!revisedStr.includes(teamName.toLowerCase())) {
         throw new Error(`MISMATCH: Conteúdo revisado perdeu a identidade do time ${teamName}.`);
      }
    }

    processed = revised;
  } catch (e) {
    console.warn("⚠️ Falha na camada de revisão, usando original.");
  }

  // Validação de Limite de Caracteres (Instagram: 2200)
  const captionLength = processed.caption.length;
  if (captionLength > 2200) {
    throw new Error(
      `❌ Caption excede o limite do Instagram: ${captionLength} caracteres.`,
    );
  }
  if (captionLength > 1980) {
    console.warn(
      `⚠️ Alerta: Caption atingiu 90% do limite (2200). Atual: ${captionLength}`,
    );
  }

  // --- ATUALIZAÇÃO DA MEMÓRIA DO MUNDO ---
  const updatePrompt = `
    Analise a notícia e atualize a Memória do Mundo.
    Notícia: ${title} - ${snippet}
    
    Regras de Atualização:
    - Identifique o técnico atual do time e a competição/liga que estão disputando.
    - Se a notícia diz que alguém FOI DEMITIDO, remova o nome ou marque como vago.
    - Se a notícia confirma uma CONTRATAÇÃO, adicione ao contexto do time.
    - NUNCA use "Não informada" ou "Não mencionado" se você puder manter o valor anterior da Memória.
    - Se a informação não estiver na notícia, retorne o valor que já está na Memória.
    
    Memória Atual: ${worldStateContext}

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
      const newState = {
        ...worldState,
        teams: { ...(worldState.teams || {}), ...updates.teams },
      };
      saveWorldState(newState);
      console.log("🧠 Memória do Mundo atualizada de forma síncrona.");
    }
  } catch (e) {
    console.error("❌ Erro ao atualizar Memória do Mundo:", e);
  }

  // Validação Anti-Placeholder e Termos Vagos Proibidos
  const forbidden = [
    "[Nome]",
    "[NOME]",
    "[atleta]",
    "[jogador]",
    "[técnico]",
    "[dirigente]",
    "ERRO:",
    "POST REJEITADO",
  ];
  const contentStr = JSON.stringify(processed).toLowerCase();
  const contextStr = (title + " " + snippet).toLowerCase();

    if (forbidden.some((p) => contentStr.includes(p.toLowerCase()))) {
      throw new Error(
        `❌ Erro de Rejeição/Placeholder detectado: ${processed.headline}`,
      );
    }

    // --- VALIDAÇÃO DE IDENTIDADE (RELAXADA) ---
    // Deixamos a IA livre para identificar o time correto da notícia, 
    // mesmo que o feed original tenha um rótulo diferente.

  // Se for notícia sobre PESSOAS INDIVIDUAIS (baixa, reforço, desfalque, contratação, saída, demissão), exige nome próprio.
  // Notícias coletivas (escalação, horário, resultado, treino) NÃO precisam de nome individual.
  const isAboutPerson = contextStr.includes("jogador") || contextStr.includes("técnico") || contextStr.includes("atleta") || 
                        contentStr.includes("jogador") || contentStr.includes("técnico") || contentStr.includes("atleta");

  const isIndividualFocus = 
    isAboutPerson && (
      contextStr.includes("reforço") || 
      contextStr.includes("contratação") || 
      contextStr.includes("demissão") || 
      contextStr.includes("saída") ||
      contextStr.includes("desfalque") ||
      contextStr.includes("lesão") ||
      contextStr.includes("baixa")
    );

  if (isIndividualFocus) {
    // Regex melhorada: Aceita nomes simples (Everson), compostos (Léo Ortiz) e com partículas (da, de, do)
    // Busca por sequências que começam com Maiúscula.
    const names = processed.caption.match(/[A-ZÀ-Ÿ][a-zà-ÿ]+( [a-z]{1,3})?( [A-ZÀ-Ÿ][a-zà-ÿ]+)*/g);
    
    // Filtro para remover palavras comuns que o regex pode pegar por engano no início de frases
    const validNames = names?.filter(n => !["Notícia", "O", "A", "Os", "As", "Neste", "Nesta", "Segundo", "Após", "Com", "Em"].includes(n)) || [];

    if (validNames.length === 0) {
      throw new Error(
        `❌ Notícia retida por falta de identificação exata do profissional: ${processed.headline}`,
      );
    }
  }

  // Validação de segurança: Pelo menos um nome de time ou um nome próprio deve estar presente
  const teamNames = Object.keys(worldState.teams || {});
  const hasTeamName = teamNames.some((team) =>
    processed.caption.toLowerCase().includes(team.toLowerCase()),
  );
  const hasPersonName =
    (processed.caption.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || []).length > 0;

  if (!hasTeamName && !hasPersonName) {
    throw new Error(
      `❌ Notícia muito vaga: Sem nome de time ou de profissional no caption.`,
    );
  }

  return processed;
}

export async function filterFootballOnly(candidates: any[]): Promise<number[]> {
  const prompt = `Selecione índices de notícias REAIS de futebol MASCULINO PROFISSIONAL (Série A). 
  REJEITE EXPRESSAMENTE: Categorias de Base (Sub-20, Sub-17, etc.), Futebol Feminino, enquetes, scouts de apostas e guias de TV. 
  Notícias:\n${candidates.map((c, i) => `${i}: ${c.title}`).join("\n")}
  Retorne JSON [index, index]`;
  try {
    return await callGemini(prompt);
  } catch (e) {
    return candidates.map((_, i) => i);
  }
}

export async function rankBestNews(newsList: any[]): Promise<any> {
  if (newsList.length <= 1) return newsList[0] || null;
  const newsContext = newsList
    .map((n, i) => `[${i}] ${n.category}: ${n.title}`)
    .join("\n");
  const prompt = `Escolha a notícia de MAIOR impacto. Priorize o que é NOVO. 
  Responda APENAS o índice.\n${newsContext}`;
  try {
    const res = await callGemini(prompt, false);
    const index = parseInt(res.replace(/[^0-9]/g, ""));
    return newsList[index] || newsList[0];
  } catch (e) {
    return newsList[0];
  }
}

function getCleanWords(title: string): Set<string> {
  const stopWords = new Set([
    "a", "o", "de", "para", "por", "com", "em", "um", "uma", "os", "as", 
    "contra", "apos", "após", "para", "sobre", "entre", "sem", "sob", 
    "e", "do", "da", "dos", "das", "no", "na", "nos", "nas", 
    "pelo", "pela", "pelos", "pelas", "ao", "aos", "que", 
    "se", "um", "uma", "uns", "umas", "ele", "ela", "eles", "elas"
  ]);
  
  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s-]/g, " ")   // Mantém apenas letras, números e espaços
    .split(/\s+/);
    
  const cleanWords = new Set<string>();
  for (const word of normalized) {
    if (word.length > 2 && !stopWords.has(word)) {
      cleanWords.add(word);
    }
  }
  return cleanWords;
}

function areTitlesDuplicate(title1: string, title2: string): boolean {
  const words1 = getCleanWords(title1);
  const words2 = getCleanWords(title2);
  
  if (words1.size === 0 || words2.size === 0) return false;
  
  let intersectionCount = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersectionCount++;
    }
  }
  
  const minSize = Math.min(words1.size, words2.size);
  const similarity = intersectionCount / minSize;
  
  // Duplicados se compartilharem mais de 40% das palavras chave significativas
  return similarity >= 0.40;
}

/**
 * Filtra notícias que possuem o mesmo tema de notícias já postadas recentemente.
 */
export async function filterDuplicateThemes(
  candidates: { title: string }[],
  historyTitles: string[],
): Promise<number[]> {
  if (candidates.length === 0) return [];

  // 1. Filtragem Programática Local (Segurança Determinística)
  const approvedIndices: number[] = [];
  const approvedTitles: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    
    // Compara com o histórico de títulos recentes
    let isDupWithHistory = false;
    for (const histTitle of historyTitles.slice(-30)) { // Compara com as últimas 30 postagens
      if (areTitlesDuplicate(candidate.title, histTitle)) {
        console.log(`[LOCAL FILTER] Reprovado por duplicidade com histórico: "${candidate.title}" vs "${histTitle}"`);
        isDupWithHistory = true;
        break;
      }
    }
    if (isDupWithHistory) continue;

    // Compara com os aprovados no lote atual
    let isDupWithCurrentBatch = false;
    for (const appTitle of approvedTitles) {
      if (areTitlesDuplicate(candidate.title, appTitle)) {
        console.log(`[LOCAL FILTER] Reprovado por duplicidade no lote atual: "${candidate.title}" vs "${appTitle}"`);
        isDupWithCurrentBatch = true;
        break;
      }
    }
    if (isDupWithCurrentBatch) continue;

    approvedIndices.push(i);
    approvedTitles.push(candidate.title);
  }

  if (approvedIndices.length === 0) {
    console.log("⚠️ Filtragem programática local removeu todos os itens por duplicidade.");
    return [];
  }

  const localCandidates = approvedIndices.map(idx => candidates[idx]);

  // Se sobrou apenas 1 notícia aprovada localmente, não precisamos chamar a API para de-duplicar
  if (localCandidates.length === 1) {
    return approvedIndices;
  }

  const prompt = `
    Persona: Você é o Editor-Chefe do "Oráculo da Bola". Sua missão é evitar REPETIÇÃO.
    
    Abaixo estão os títulos das notícias que JÁ POSTAMOS recentemente:
    ${historyTitles
      .slice(-20)
      .map((t) => `- ${t}`)
      .join("\n")}

    Abaixo estão as NOVAS candidatas:
    ${localCandidates.map((c, i) => `[${i}] ${c.title}`).join("\n")}

    TAREFA:
    1. Analise se as novas candidatas tratam do MESMO FATO ou MESMO ASSUNTO que já foi postado (Histórico).
    2. Analise se entre as PRÓPRIAS candidatas existem notícias repetidas (mesmo fato com manchetes diferentes).
    
    POLÍTICA DE TOLERÂNCIA ZERO: Se a notícia trata da mesma pessoa fazendo a mesma coisa no mesmo clube, ela DEVE ser REPROVADA. Não importa se a manchete é diferente. Se houver duas candidatas sobre o mesmo tema, escolha apenas UMA (a melhor) e reprove a outra.
    
    EXEMPLOS DE REPROVAÇÃO OBRIGATÓRIA:
    - Já postamos: "Renato fala sobre Thiago Mendes". Nova: "Renato detona Thiago após expulsão". -> REPROVAR (Mesma pessoa, mesmo tema).
    - Entre Candidatas: "[0] Muralha Everson salva o Galo" e "[1] Everson brilha e garante vitória". -> REPROVAR uma delas (Mesmo fato).
    - Já postamos: "Cruzeiro tem desfalques". Nova: "As baixas do Cruzeiro para o jogo". -> REPROVAR (Mesma lista de desfalques).
    
    CRITÉRIOS DE APROVAÇÃO:
    - Apenas fatos genuinamente inéditos ou desdobramentos com informações novas e cruciais.

    Retorne APENAS um JSON array com os índices das notícias APROVADAS e ÚNICAS.
    Exemplo: [1, 3]
  `;

  try {
    const res = await callGemini(prompt);
    if (Array.isArray(res)) {
      return res.map(localIdx => approvedIndices[localIdx]).filter(idx => idx !== undefined);
    }
    return approvedIndices;
  } catch (e) {
    console.error("⚠️ Falha ao filtrar temas duplicados com Gemini. Usando fallback local:", e);
    return approvedIndices;
  }
}
