import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
}

export async function processNewsWithGemini(title: string, snippet: string): Promise<ProcessedContent> {
  const prompt = `
    Persona: Você é um jornalista esportivo brasileiro de elite. Seu tom é profissional, informativo e dinâmico. Você foca nos fatos, nomes e números de forma clara e objetiva.
    
    REGRAS CRÍTICAS:
    - NUNCA use palavras que sugiram conteúdo externo ou vídeos, como "Veja", "Assista", "Confira no vídeo" ou "Onde assistir". 
    - Como estamos no Instagram, não temos links clicáveis. Transforme notícias de "transmissão" ou "vídeo" em FATOS NARRATIVOS. (Ex: Em vez de "Veja o golaço", use "Bontempo marca golaço e Santos vence").
    - NUNCA prometa links ou cliques. 
    
    Analise esta notícia: "${title}" - "${snippet}"
 
    Retorne um JSON estrito com:
    - headline: Manchete Factual e Narrativa (max 50 caracteres).
    - summary: Resumo informativo dos fatos para a arte (max 150 caracteres).
    - caption: Legenda MAGNA e EXTENSA para o Instagram (Mínimo de 500 e MÁXIMO de 1000 caracteres). Estrutura: 1. Manchete impactante com emojis, 2. Parágrafo detalhado sobre o fato, 3. Parágrafo de ANÁLISE TÁTICA ou CONTEXTO HISTÓRICO, 4. Parágrafo sobre o que isso muda para o time/jogador no futuro, 5. Pergunta engajadora. Seja um jornalista de elite, imparcial e profundo.
    - hashtags: 3 a 5 hashtags sobre o time ou assunto.
    - category: Escolha APENAS UMA entre: 'MERCADO', 'URGENTE', 'HOJE', 'EXCLUSIVO', 'ORÁCULO', 'OPINIÃO', 'NÚMEROS', 'ANÁLISE', 'PLANTÃO'.
    - shouldCreateStory: true se a notícia for importante, false se for secundária.
    - imageKeywords: Uma string com 3 palavras-chave para busca de imagem.

    Importante: Retorne APENAS o JSON.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().replace(/```json|```/g, "").trim();
  let parsedResult = JSON.parse(text);

  // Validação de segurança: Se a legenda for muito grande, tenta gerar de novo mais curta
  if (parsedResult.caption.length > 1800) {
    console.log(`⚠️ Legenda muito longa (${parsedResult.caption.length} chars). Tentando reduzir...`);
    const retryPrompt = `${prompt}\n\nIMPORTANTE: A legenda anterior ficou muito longa. Gere uma versão mais concisa, com no máximo 1500 caracteres.`;
    const retryResult = await model.generateContent(retryPrompt);
    const retryText = retryResult.response.text().replace(/```json|```/g, '').trim();
    parsedResult = JSON.parse(retryText);
  }

  // Corte final de segurança (Hard Limit para Instagram é 2200, deixamos margem para hashtags)
  if (parsedResult.caption.length > 2000) {
    parsedResult.caption = parsedResult.caption.substring(0, 1990) + "...";
  }

  return parsedResult;
}

export async function rankBestNews(candidates: NewsCandidate[]): Promise<number> {
  if (candidates.length <= 1) return 0;

  const prompt = `
    Você é um editor-chefe de um portal de notícias esportivas. 
    Analise as seguintes notícias e escolha APENAS UMA que tenha o maior potencial de engajamento, curtidas e comentários no Instagram.
    Considere: Hype de jogadores, importância do clube, impacto do resultado e polêmica.

    Notícias:
    ${candidates.map((c, i) => `${i}: ${c.title}`).join('\n')}

    Retorne APENAS o número do índice da melhor notícia. Ex: 0
  `;

  try {
    const result = await model.generateContent(prompt);
    const index = parseInt(result.response.text().trim());
    return isNaN(index) ? 0 : index;
  } catch (e) {
    return 0;
  }
}

export async function filterFootballOnly(candidates: NewsCandidate[]): Promise<number[]> {
  if (candidates.length === 0) return [];

  const prompt = `
    Você é o Editor-Chefe do "Oráculo da Bola". Sua missão é ENCONTRAR as melhores notícias de FUTEBOL MASCULINO PROFISSIONAL.
    
    DIRETRIZ DE OURO: SEJA PERMISSIVO. 
    Se a notícia fala de um time grande, de um jogo, de uma escalação ou de um resultado, ELA É BOA. 
    Não descarte notícias de "Onde assistir" ou "Escalações", elas são ótimas para o Instagram!

    VALORIZE:
    - Times: Flamengo, Palmeiras, Corinthians, São Paulo, Vasco, Santos, Cruzeiro, Atlético-MG, Grêmio, Inter, etc.
    - Assuntos: Resultados, Gols, Mercado, Escalações, Polêmicas, Arbitragem.
    - Fontes: UOL, CNN, Estadão, ESPN, Lance, etc.

    O QUE PROIBIR (BANIR):
    - Futebol FEMININO (totalmente proibido).
    - "Onde assistir", "Horário", "Escalações", "Provável time", "Transmissão".
    - Ingressos, bilheteria, sócio-torcedor, serviços de jogo.
    - Prefeituras, editais, concursos, vacina, governo.

    INSTRUÇÃO: Selecione os índices das notícias MAIS QUENTES sobre futebol masculino. 
    Ignore guias de TV e "serviço" de jogo. Seja assertivo: resultados e mercado são a prioridade.

    Notícias:
    ${candidates.map((c, i) => `${i}: [${c.source || 'Portal'}] ${c.title}`).join('\n')}

    Responda APENAS com o array JSON. Ex: [0, 1, 4]
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const indices = JSON.parse(match[0]);
      return Array.isArray(indices) ? indices.filter((i: number) => i >= 0 && i < candidates.length) : [];
    }
    return [];
  } catch (e) {
    console.error('Erro ao filtrar com IA:', e);
    return candidates.map((_, i) => i);
  }
}
