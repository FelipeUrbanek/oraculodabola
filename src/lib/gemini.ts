import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLD_STATE_PATH = path.join(__dirname, "..", "world_state.json");

function extractJSON(text: string): string {
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  
  if (firstBrace === -1 && firstBracket === -1) {
    return text.replace(/```json|```/g, "").trim();
  }
  
  const startIdx = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) 
    ? firstBrace 
    : firstBracket;
    
  const charStart = text[startIdx];
  const charEnd = charStart === "{" ? "}" : "]";
  
  let lastIdx = text.lastIndexOf(charEnd);
  
  while (lastIdx > startIdx) {
    const candidate = text.substring(startIdx, lastIdx + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      lastIdx = text.substring(0, lastIdx).lastIndexOf(charEnd);
    }
  }
  
  const greedyMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return greedyMatch ? greedyMatch[0] : text;
}

const API_KEYS = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : [];
let currentKeyIndex = 0;

// Configuração da API do Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

async function callGroq(prompt: string, isJson: boolean = true, fallbackModel: boolean = false): Promise<any> {
  const modelToUse = fallbackModel ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
  // console.log(`[Groq] Chamando ${modelToUse} com prompt de tamanho: ${prompt.length} caracteres.`);
  try {
    const body: any = {
      model: modelToUse,
      messages: [
        { role: "system", content: "Você deve sempre responder em Português do Brasil (pt-BR)." + (isJson ? " Você deve retornar APENAS um JSON válido. Não inclua comentários nem formatação Markdown extra." : "") },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };

    if (isJson) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data: any = await response.json();
    let text = data.choices[0].message.content.trim();
    if (isJson) {
      text = extractJSON(text);
      // Remove possible unescaped control characters inside string literals that break JSON.parse
      // We keep newlines (\n) and carriage returns (\r) and tabs (\t), but remove other controls.
      text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    }
    
    return isJson ? JSON.parse(text) : text;
  } catch (error: any) {
    console.log(`⚠️ Fallback para Groq (${modelToUse}) falhou: ${error.message}`);
    if (!fallbackModel) {
      console.log(`🔄 Tentando modelo mais leve da Groq: llama-3.1-8b-instant...`);
      return await callGroq(prompt, isJson, true);
    }
    throw new Error("❌ Falha crítica: Nenhum modelo (Gemini ou Groq) respondeu.");
  }
}

function cleanErrorMessage(msg: string): string {
  if (!msg) return "Erro desconhecido";
  const httpCodeMatch = msg.match(/\[(429|403|500|503|400)\]\s*([A-Za-z\s_-]+)/);
  if (httpCodeMatch) {
    return `HTTP ${httpCodeMatch[1]} - ${httpCodeMatch[2].trim()}`;
  }
  if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.includes("429")) {
    return "Cota de requisições excedida (429)";
  }
  if (msg.toLowerCase().includes("forbidden") || msg.includes("403")) {
    return "Acesso negado/Não autorizado (403)";
  }
  if (msg.length > 150) {
    return msg.substring(0, 150) + "...";
  }
  return msg;
}

/**
 * Sistema de Modelos de Elite com Fallback
 */
async function callGemini(prompt: string, isJson: boolean = true, retryCount: number = 0): Promise<any> {
  const models = process.env.GEMINI_MODELS ? process.env.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean) : [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-pro-exp",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];

  // Se esgotamos as chaves, usamos o Groq como última opção
  if (retryCount >= API_KEYS.length) {
      if (retryCount === API_KEYS.length) console.warn(`⚠️ Usando Groq (Fallback)...`);
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
        text = extractJSON(text);
        return JSON.parse(text);
      }
      return text;
    } catch (e: any) {
      // const cleanErr = cleanErrorMessage(e.message);
      // Ocultando log verboso de falha individual por modelo/chave para limpar o terminal
      // console.log(`⚠️ Modelo ${modelName} com a chave ${currentKeyIndex + 1} falhou. Erro: ${cleanErr}`);
      
      // Verifica se o erro foi de rate limit/cota (429) ou acesso negado/billing (403)
      if (e.message && (e.message.includes("429") || e.message.includes("403"))) {
         // console.warn(`[AVISO] Chave ${currentKeyIndex + 1} indisponível (Erro: ${e.message.includes("429") ? "429 (Cota)" : "403 (Acesso)"}). Rotacionando chave...`);
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
function filterWorldState(teams: any, title: string, snippet: string): any {
  if (!teams) return {};
  const filtered: any = {};
  const combinedText = `${title} ${snippet}`.toLowerCase();

  // Sempre inclui o Santos e a Seleção Brasileira
  const alwaysInclude = ["Santos", "Seleção Brasileira"];

  for (const teamName of Object.keys(teams)) {
    const isAlwaysIncluded = alwaysInclude.some(
      t => t.toLowerCase() === teamName.toLowerCase()
    );

    const normalizedTeam = teamName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const normalizedText = combinedText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isMentioned = normalizedText.includes(normalizedTeam);

    if (isAlwaysIncluded || isMentioned) {
      filtered[teamName] = teams[teamName];
    }
  }

  return filtered;
}

export async function processNewsWithGemini(
  title: string,
  snippet: string,
  teamName: string = "",
): Promise<ProcessedContent> {
  const worldState = loadWorldState();
  const filteredTeams = filterWorldState(worldState.teams || {}, title, snippet);
  const worldStateContext = JSON.stringify(filteredTeams, null, 2);

  const prompt = `
    Persona: Você é o setorista oficial do "Oráculo da Bola", cobrindo exclusivamente o Santos Futebol Clube (o Peixe). O seu foco é Mercado da Bola, bastidores e breaking news do Santos FC e do futebol brasileiro (quando houver relevância direta para o Peixe) em posts rápidos, diretos, dinâmicos e de altíssimo impacto. Seu tom é DIRETO, IMPACTANTE e 100% FACTUAL. Estamos em MAIO DE 2026.
    
    MEMÓRIA DO MUNDO (Use isso para evitar erros sobre quem é o técnico ou em qual liga o time está):
    ${worldStateContext}

    REGRAS DE OURO:
    1. COBERTURA EXCLUSIVA: Foco absoluto e único no Santos Futebol Clube. Toda notícia deve destacar fatos relativos ao Santos, seus jogadores, técnico, diretoria e confrontos.
    2. PROIBIDO MISTÉRIO: Use nomes reais. Nunca substitua por apelidos ou descrições vagas.
    3. LISTE OS NOMES: Se a notícia cita vários jogadores, liste-os individualmente no caption.
    4. VALORES EXATOS: Procure e use valores monetários exatos (ex: R$ 5,4 milhões).
    5. FIDELIDADE ABSOLUTA: Use APENAS os nomes que aparecem na notícia ou que estão na MEMÓRIA DO MUNDO. Se a memória diz que o técnico do Santos é Carpini, não diga que é outro.
    6. NUNCA USE PLACEHOLDERS.
    7. TRAVA DE NOMES: Se a notícia for sobre um PROFISSIONAL (jogador, técnico, dirigente) e o NOME PRÓPRIO não estiver disponível, REJEITE o post. Se a notícia for INSTITUCIONAL (multas, patrocínios, estádio, dívidas do clube), o nome do Santos é suficiente.
    8. VARIANT STYLES: Diversifique o estilo da legenda. Use "Entenda os detalhes:" em vez de sempre "3 pontos".
    9. CAPTION RICO: Explique o fato com profundidade, mencionando explicitamente todos os nomes envolvidos, datas, locais e contextos principais do Santos FC.
    10. LIMITE DE CARACTERES: O caption deve ter entre 350 e 2000 caracteres. NUNCA exceda 2200 caracteres.
    11. LÓGICA DE ESCUDO: Como o foco é 100% no Santos FC, isFocusedOnSingleTeam deve ser true se for um fato interno do Santos. Se for sobre um jogo contra outro time, defina como false para ocultar o escudo do rival.
    12. FILTRO DE ELITE: REJEITE (retorne JSON com headline "REJEITADO") se a notícia for sobre outro time que não tenha ligação ou relevância direta para o Santos Futebol Clube. Rejeite também futebol feminino e categorias de base, exceto se muito relevante para o time profissional do Santos.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA (max 40 chars). Impactante e criativa.
    - summary: Fato principal (max 120 chars).
    - caption: Texto para Instagram (350-500 chars).
    - hashtags: string[]
    - category: URGENTE, PLANTÃO, MERCADO, BASTIDORES, TÁTICA, EXCLUSIVO, ANÁLISE, OPINIÃO, NÚMEROS, FATO, HISTÓRIA.
    - mainTeam: O nome do time principal da notícia (deve ser "Santos").
    - isFocusedOnSingleTeam: boolean (true se apenas o Santos é o foco interno, false se citar confrontos/rivais).
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
    const generalCategories = [
      "mercado da bola",
      "trend",
      "futebol internacional",
      "copa 2026",
      "brasileirão",
      "libertadores",
      "copa do brasil",
      "champions league",
      "futebol"
    ];
    if (teamName && !generalCategories.includes(teamName.toLowerCase())) {
      if (!revisedStr.includes(teamName.toLowerCase())) {
         throw new Error(`MISMATCH: Conteúdo revisado perdeu a identidade do time ${teamName}.`);
      }
    }

    processed = revised;
  } catch (e: any) {
    console.warn(`⚠️ Falha na camada de revisão: ${e.message}. Rejeitando para evitar post sem revisão.`);
    throw e;
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

  // Verifica explicitamente se a notícia foi rejeitada
  if (processed.headline.toUpperCase().includes("REJEITADO")) {
    throw new Error(
      `❌ Erro de Rejeição/Placeholder detectado: ${processed.caption || "Conteúdo rejeitado pelo filtro editorial."}`
    );
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
    
    // Filtro avançado para remover palavras comuns, termos do ecossistema e nomes de times
    const teamNamesList = Object.keys(worldState.teams || {}).map(t => t.toLowerCase());
    const commonWords = new Set([
      "notícia", "o", "a", "os", "as", "neste", "nesta", "segundo", "após", "com", "em",
      "infelizmente", "mas", "porém", "contudo", "entretanto", "todavia", "não", "sim",
      "hoje", "ontem", "amanhã", "nas", "nos", "de", "do", "da", "para", "por", "sem",
      "mais", "menos", "muito", "pouco", "ele", "ela", "eles", "elas", "se", "como",
      "quem", "que", "quando", "onde", "porque", "porquê", "santos", "peixe", "alvinegro",
      "vila", "belmiro", "clube", "time", "diretoria", "presidente", "técnico", "treinador",
      "jogador", "atleta", "volante", "meio", "meia", "zagueiro", "lateral", "goleiro",
      "atacante", "ponta", "centroavante", "reforço", "contratação", "copa", "mundo",
      "campeonato", "brasileiro", "paulista", "libertadores", "sul-americana", "brasil",
      "seleção", "arena", "estádio", "rodada", "fc", "futebol"
    ]);

    const validNames = names?.filter(n => {
      const parts = n.toLowerCase().trim().split(/\s+/);
      // Um nome próprio válido deve ter pelo menos uma palavra que não seja palavra comum nem time
      return parts.some(part => !commonWords.has(part) && !teamNamesList.includes(part));
    }) || [];

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

  if (!Array.isArray(processed.hashtags)) {
    processed.hashtags = typeof processed.hashtags === "string" 
      ? (processed.hashtags as string).split(/[ ,]+/).map((h: string) => h.trim().replace(/^#/, "")).filter(Boolean)
      : [];
  }

  return processed;
}

export async function processCinemaNewsWithGemini(
  title: string,
  snippet: string,
): Promise<ProcessedContent> {
  const prompt = `
    Persona: Você é o crítico e setorista oficial do "@espectadorcomum" (Espectador Comum), cobrindo notícias de Filmes, Séries, Streaming (Netflix, HBO, Disney, Prime Video, etc.), Cinema e Cultura Pop. O seu foco é Mercado, bastidores, teasers, novidades e críticas/breaking news em posts rápidos, diretos, dinâmicos e de altíssimo impacto. Seu tom é VIBRANTE, INTELECTUAL, MODERNO e altamente envolvente. Estamos em MAIO DE 2026.

    REGRAS DE OURO:
    1. PROIBIDO MISTÉRIO: Use nomes reais de atores, atrizes, diretores e títulos oficiais das obras. Nunca substitua por apelidos ou descrições vagas.
    2. VALORES EXATOS: Sempre procure e use valores monetários exatos (ex: bilheteria de $1.2 bilhão, orçamento de $200 milhões).
    3. FIDELIDADE ABSOLUTA: Use apenas fatos e nomes citados na notícia. Não invente detalhes que não estão no texto.
    4. NUNCA USE PLACEHOLDERS.
    5. LIMITE DE CARACTERES: O caption deve ter entre 300 e 800 caracteres. Direto ao ponto e dinâmico!
    6. CATEGORIAS EXCLUSIVAS: Escolha entre: Filmes, Séries, Estreia, Bastidores, Crítica, Breaking.

    7. ESTRUTURA E PARÁGRAFOS (CRÍTICO):
       - O caption deve ser estruturado em 3 parágrafos curtos, fluidos e bem delineados.
       - Você DEVE inserir obrigatoriamente UMA LINHA COMPLETAMENTE EM BRANCO (espaçamento de parágrafo duplo) entre cada parágrafo do caption.
       - Parágrafo 1: Gancho impactante sobre a notícia (uma frase de altíssimo impacto que chame a atenção imediata).
       - Parágrafo 2: Detalhes importantes de produção, enredo, elenco relevante, direção, estúdio envolvido ou plataforma de streaming.
       - Parágrafo 3: Fechamento instigante com uma pergunta reflexiva ou a repercussão esperada do público, seguido das hashtags no final.
       - Use emojis de forma cirúrgica e moderada (máximo 1 ou 2 por parágrafo, no início ou fim) para dar leveza.

    Notícia: "${title}" - "${snippet}"
 
    Retorne apenas o JSON:
    - headline: MANCHETE EM CAIXA ALTA (max 40 chars). Impactante e cativante.
    - summary: Fato principal (max 120 chars).
    - caption: Texto para Instagram (300-800 chars, estruturado em parágrafos separados por linhas em branco).
    - hashtags: string[]
    - category: Filmes, Séries, Estreia, Bastidores, Crítica, Breaking.
    - mainTeam: O nome da obra principal ou estúdio (ex: "Netflix", "Marvel", "Stranger Things").
    - isFocusedOnSingleTeam: boolean (true sempre para cinema).
    - shouldCreateStory: boolean (true se for um lançamento gigante, crítica importante ou teaser muito esperado).
    - imageKeywords: string (termos de busca no Unsplash em inglês para cartaz ou cena do filme. Ex: "star wars movie poster cinematic")
  `;

  let processed: ProcessedContent = await callGemini(prompt);

  // Validação Anti-Placeholder e Termos Vagos Proibidos
  const forbidden = [
    "[Nome]",
    "[NOME]",
    "[ator]",
    "[atriz]",
    "[filme]",
    "ERRO:",
    "POST REJEITADO",
  ];
  const contentStr = JSON.stringify(processed).toLowerCase();
  if (forbidden.some((p) => contentStr.includes(p.toLowerCase()))) {
    throw new Error(
      `❌ Erro de Rejeição/Placeholder detectado em Cinema: ${processed.headline}`,
    );
  }

  if (!Array.isArray(processed.hashtags)) {
    processed.hashtags = typeof processed.hashtags === "string" 
      ? (processed.hashtags as string).split(/[ ,]+/).map((h: string) => h.trim().replace(/^#/, "")).filter(Boolean)
      : [];
  }

  return processed;
}

export async function rankBestCinemaNews(newsList: any[]): Promise<any> {
  if (newsList.length <= 1) return newsList[0] || null;
  const newsContext = newsList
    .map((n, i) => `[${i}] ${n.category}: ${n.title}`)
    .join("\n");
  const prompt = `Escolha a notícia de MAIOR impacto e apelo para o público geral sobre Filmes e Séries. Priorize anúncios de elenco, teasers de franquias gigantes (Marvel, DC, Star Wars, Netflix), estreias de peso ou bastidores chocantes.
  Responda APENAS o índice.\n${newsContext}`;
  try {
    const res = await callGemini(prompt, false);
    const idx = parseInt(res.trim().replace(/[^\d]/g, ""));
    if (!isNaN(idx) && newsList[idx]) {
      return newsList[idx];
    }
  } catch (e) {}
  return newsList[0];
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
  const prompt = `Escolha a notícia de MAIOR impacto sobre o Santos FC. Priorize o que é NOVO e de relevância imediata (contratações, lesões importantes, resultados de clássicos ou bastidores).
  Responda APENAS o índice.\n${newsContext}`;
  try {
    const res = await callGemini(prompt, false);
    const index = parseInt(res.replace(/[^0-9]/g, ""));
    return newsList[index] || newsList[0];
  } catch (e) {
    return newsList[0];
  }
}

function stemPortuguese(word: string): string {
  // Remove plural suffix 's'
  if (word.endsWith("s") && word.length > 3) {
    word = word.slice(0, -1);
  }
  // Remove gender/variation suffixes 'o', 'a', 'e' if the word is long enough
  if ((word.endsWith("o") || word.endsWith("a") || word.endsWith("e")) && word.length > 4) {
    word = word.slice(0, -1);
  }
  // Normalise common football-related word stems
  if (word.startsWith("lesiona") || word.startsWith("lesao")) {
    return "les";
  }
  if (word.startsWith("convoca")) {
    return "convoc";
  }
  if (word.startsWith("saida") || word.startsWith("sair")) {
    return "sa";
  }
  if (word.startsWith("contrata")) {
    return "contrat";
  }
  if (word.startsWith("demit") || word.startsWith("demiss")) {
    return "demit";
  }
  return word;
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
      cleanWords.add(stemPortuguese(word));
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
  
  // Duplicados se compartilharem mais de 40% das palavras chave significativas normalizadas
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
    for (const histTitle of historyTitles.slice(-50)) { // Compara com as últimas 50 postagens
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
