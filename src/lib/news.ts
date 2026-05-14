import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { filterFootballOnly } from './gemini.js';

const parser = new Parser();

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  id: string;
  imageUrl?: string;
}

/**
 * Resolve o link final do Google News e tenta capturar a imagem principal (og:image)
 */
export async function resolveAndScrapeImage(googleUrl: string): Promise<{ finalUrl: string, imageUrl?: string }> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    if (page.url().includes('news.google.com')) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    }
    const finalUrl = page.url();
    const imageUrl = await page.evaluate(() => {
      return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
             document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || null;
    });
    await browser.close();
    return { finalUrl, imageUrl: imageUrl || undefined };
  } catch (error: any) {
    await browser.close();
    return { finalUrl: googleUrl, imageUrl: undefined };
  }
}

/**
 * Realiza uma busca individual no Google News com filtro de 1 hora
 */
async function fetchSingleQuery(queryStr: string): Promise<any[]> {
  try {
    // Filtro when:1h aplicado em cada busca individual para máxima precisão
    const query = encodeURIComponent(`${queryStr} -site:ge.globo.com when:1h`);
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    const feed = await parser.parseURL(searchUrl);
    return feed.items;
  } catch (e) {
    console.error(`Erro na query [${queryStr}]:`, e);
    return [];
  }
}

/**
 * Função principal que coordena as múltiplas buscas paralelas
 */
export async function fetchFootballNews(): Promise<NewsItem[]> {
  try {
    // LISTA EXPANDIDA DE TIMES E TERMOS (Série A, B e Internacional)
    const queries = [
      // G4 e Gigantes
      'Flamengo futebol', 'Palmeiras futebol', 'Corinthians futebol', '"São Paulo FC" futebol',
      // Minas e Sul
      '"Atlético-MG" futebol', 'Cruzeiro futebol', 'Grêmio futebol', 'Internacional futebol',
      // Rio e SP
      'Vasco futebol', 'Botafogo futebol', 'Fluminense futebol', 'Santos FC futebol',
      // Nordeste e Centro-Oeste
      'Bahia futebol', 'Fortaleza futebol', 'Vitória futebol', 'Ceará futebol', 'Cuiabá futebol',
      // Outros Série A/B
      'Athletico-PR futebol', 'Coritiba futebol', 'Bragantino futebol', 'Sport Recife futebol',
      // Mercado e Competições
      '"Mercado da Bola" futebol', '"Transferências futebol"', 'Brasileirão', 'Libertadores',
      '"Copa do Brasil"', '"Champions League"', '"Seleção Brasileira" futebol'
    ];

    console.log(`\n🚀 Iniciando ${queries.length} buscas paralelas no Google News...`);
    
    // Executa todas as buscas simultaneamente
    const results = await Promise.all(queries.map(q => fetchSingleQuery(q)));
    
    const allItems = results.flat();
    const uniqueNews: any[] = [];
    const seenLinks = new Set();
    const seenTitles = new Set();
    
    // Termos para filtrar notícias que não são sobre o jogo/notícia em si
    const junkTerms = [
      'prefeitura', 'governo', 'bolsa', 'funarte', 'dia internacional', 'institucional', 'anpd', 'concurso', 'vacina', 'sesc', 
      'ingressos', 'bilheteria', 'venda de ingressos', 'sócio-torcedor', 'feminino', 'feminina', 'sub-17', 'sub-15',
      'onde assistir', 'escalação', 'escalações', 'provável time', 'horário do jogo', 'transmissão', 'vôlei', 'basquete'
    ];

    for (const item of allItems) {
      if (!item.link || !item.title) continue;
      
      const titleLower = item.title.toLowerCase();
      const cleanTitle = item.title.split(' - ')[0].trim();

      // 1. Evitar duplicatas (mesma notícia vindo de buscas diferentes)
      if (seenLinks.has(item.link) || seenTitles.has(cleanTitle)) continue;
      
      // 2. Filtro de lixo institucional
      if (junkTerms.some(term => titleLower.includes(term))) continue;

      // 3. Filtro temporal de segurança (máximo 70 minutos atrás)
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate);
        const now = new Date();
        const diffInMinutes = (now.getTime() - pubDate.getTime()) / (1000 * 60);
        if (diffInMinutes > 70) continue; 
      }

      uniqueNews.push(item);
      seenLinks.add(item.link);
      seenTitles.add(cleanTitle);
    }
    
    console.log(`✅ Total de ${uniqueNews.length} notícias únicas encontradas na última hora.`);

    // Ordenar por mais recente e pegar as top 20 para a IA
    const sortedNews = uniqueNews
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 20);

    // Filtragem final com IA (Gemini)
    let filteredList = sortedNews;
    if (sortedNews.length > 0) {
      console.log(`🤖 IA analisando ${sortedNews.length} candidatos...`);
      const validIndices = await filterFootballOnly(sortedNews.map(n => ({ 
        title: n.title || '', 
        snippet: n.contentSnippet || n.title || '',
        source: n.source || 'Portal'
      })));
      
      if (validIndices.length > 0) {
        filteredList = validIndices.map(i => sortedNews[i]).filter(n => n !== undefined);
      }
    }

    // Resolução de links e imagens
    const processedItems = [];
    for (const item of filteredList) {
      const { finalUrl, imageUrl } = await resolveAndScrapeImage(item.link || '');
      
      // Bloqueio de fontes indesejadas pós-redirecionamento
      const lowUrl = finalUrl.toLowerCase();
      if (['instagram.com', 'twitter.com', 'facebook.com', 'ge.globo.com', 'youtube.com'].some(d => lowUrl.includes(d))) continue;
      
      processedItems.push({
        title: item.title || '',
        link: finalUrl,
        pubDate: item.pubDate || '',
        contentSnippet: item.contentSnippet || '',
        id: item.guid || item.link || '',
        imageUrl: imageUrl
      });
    }

    return processedItems;
  } catch (error: any) {
    console.error('Erro ao buscar notícias:', error);
    return [];
  }
}
