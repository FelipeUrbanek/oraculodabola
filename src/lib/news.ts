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
 * Resolve o link final e captura a imagem apenas se for de alta qualidade
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
    
    // Captura apenas se houver og:image (padrão de portais grandes)
    const imageUrl = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const twitter = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
      return og || twitter || null;
    });

    await browser.close();
    return { finalUrl, imageUrl: imageUrl || undefined };
  } catch (error: any) {
    await browser.close();
    return { finalUrl: googleUrl, imageUrl: undefined };
  }
}

async function fetchSingleQuery(queryStr: string): Promise<any[]> {
  try {
    // Filtro when:1h para garantir última hora
    const query = encodeURIComponent(`${queryStr} -site:ge.globo.com when:4h`);
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    const feed = await parser.parseURL(searchUrl);
    return feed.items;
  } catch (e) {
    return [];
  }
}

export async function fetchFootballNews(): Promise<NewsItem[]> {
  try {
    const queries = [
      'Flamengo futebol', 'Palmeiras futebol', 'Corinthians futebol', '"São Paulo FC" futebol',
      '"Atlético-MG" futebol', 'Cruzeiro futebol', 'Grêmio futebol', 'Internacional futebol',
      'Vasco futebol', 'Botafogo futebol', 'Fluminense futebol', 'Santos FC futebol',
      'Bahia futebol', 'Fortaleza futebol', '"Mercado da Bola" futebol', 'Brasileirão', 
      'Libertadores', '"Copa do Brasil"', '"Champions League"'
    ];

    // LISTA DE PORTAIS CONFIÁVEIS (Elite)
    const elitePortals = [
      'uol.com.br', 'terra.com.br', 'espn.com.br', 'cnnbrasil.com.br', 'estadao.com.br', 
      'oglobo.globo.com', 'gazetaesportiva.com', 'metropoles.com', 'lance.com.br', 
      'goal.com', 'itatiaia.com.br', 'tntsports.com.br', 'band.uol.com.br'
    ];

    console.log(`\n🚀 Buscando notícias da última hora em portais de elite...`);
    const results = await Promise.all(queries.map(q => fetchSingleQuery(q)));
    
    const allItems = results.flat();
    const uniqueNews: any[] = [];
    const seenLinks = new Set();
    const seenTitles = new Set();

    for (const item of allItems) {
      if (!item.link || !item.title) continue;
      
      const titleLower = item.title.toLowerCase();
      const cleanTitle = item.title.split(' - ')[0].trim();
      const source = item.source?.toLowerCase() || '';

      // 1. FILTRO DE PORTAIS: Apenas fontes conhecidas
      const isElite = elitePortals.some(portal => item.link.toLowerCase().includes(portal) || source.includes(portal.split('.')[0]));
      if (!isElite) continue;

      // 2. FILTRO DE TEMPO RÍGIDO (Máximo 60 minutos)
      if (item.pubDate) {
        const diff = (new Date().getTime() - new Date(item.pubDate).getTime()) / (1000 * 60);
        if (diff > 60) continue;
      }

      if (seenLinks.has(item.link) || seenTitles.has(cleanTitle)) continue;

      uniqueNews.push(item);
      seenLinks.add(item.link);
      seenTitles.add(cleanTitle);
    }
    
    // Ordenar por mais recente
    const sortedNews = uniqueNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const processedItems = [];
    for (const item of sortedNews) {
      if (processedItems.length >= 10) break; // Limite de processamento

      const { finalUrl, imageUrl } = await resolveAndScrapeImage(item.link || '');
      
      // 3. EXIGÊNCIA DE IMAGEM: Se não tem og:image, descarta (evita portais ruins)
      if (!imageUrl) {
        console.log(`🚫 Descartada por falta de imagem de qualidade: ${item.title}`);
        continue;
      }

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
