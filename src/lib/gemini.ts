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
    Você é o Editor-Chefe do "Oráculo da Bola". Sua missão é selecionar as notícias mais IMPACTANTES sobre futebol profissional para o Instagram.
    
    CRITÉRIOS DE OURO (ACEITE SEMPRE):
    - Resultados de jogos decisivos (eliminatórias, clássicos, finais).
    - Contratações OFICIAIS ou rumores fortes de times grandes (Flamengo, Palmeiras, Corinthians, etc).
    - Escalações e desfalques importantes para jogos de hoje ou amanhã.
    - Notícias de astros internacionais (Neymar, Vini Jr, Mbappe, Messi).

    O QUE DESCARTAR (LIXO):
    - Notícias de Prefeituras, Governo, Sesc ou editais públicos.
    - Turismo, shows ou eventos de cidades.
    - Outros esportes (Vôlei, Basquete) sem relação com o clube de futebol.

    INSTRUÇÃO: Analise os títulos abaixo e selecione os índices das notícias que são REALMENTE sobre futebol e têm potencial de engajamento. 
    Seja menos rígido: se o título cita um time grande e um contexto de jogo/mercado, É VÁLIDO.

    Notícias:
    ${candidates.map((c, i) => `${i}: ${c.title}`).join('\n')}

    Retorne APENAS um array JSON com os índices em ordem de RELEVÂNCIA (do melhor para o pior). 
    Ex: [5, 2, 0, 8]
    Se absolutamente nada for futebol, retorne [].
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[.*\]/);
    if (match) {
      const indices = JSON.parse(match[0]);
      // Garantir que os índices são válidos
      return indices.filter((i: number) => i >= 0 && i < candidates.length);
    }
    return [];
  } catch (e) {
    console.error('Erro ao filtrar com IA:', e);
    return candidates.map((_, i) => i);
  }
}
