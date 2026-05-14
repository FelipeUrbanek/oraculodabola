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

export async function resolveAndScrapeImage(googleUrl: string): Promise<{ finalUrl: string, imageUrl?: string }> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    console.log(`\n📡 Iniciando resolução: ${googleUrl.substring(0, 40)}...`);
    await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    if (page.url().includes('news.google.com')) {
      console.log('⏳ Ainda no Google News, aguardando salto final...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    const finalUrl = page.url();
    console.log(`📍 URL Final: ${finalUrl}`);

    const imageUrl = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const ogSecure = document.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content');
      const twitter = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
      let img = og || ogSecure || twitter;

      if (!img) {
        const imgEls = Array.from(document.querySelectorAll('img'));
        for (const el of imgEls) {
          const src = el.getAttribute('src');
          if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
            img = src;
            break;
          }
        }
      }
      return img || null;
    }) || undefined;

    if (imageUrl) {
      console.log(`🖼️ Sucesso! Imagem encontrada: ${imageUrl.substring(0, 70)}...`);
    }

    await browser.close();
    return { finalUrl, imageUrl };
  } catch (error: any) {
    console.error('❌ Erro no Processo:', error.message || error);
    await browser.close();
    return { finalUrl: googleUrl, imageUrl: undefined };
  }
}

export async function fetchFootballNews(trendTerms: string[] = []): Promise<NewsItem[]> {
  try {
    const mainTerms = '("Flamengo" OR "Palmeiras" OR "Corinthians" OR "São Paulo FC" OR "Atlético-MG" OR "Cruzeiro futebol" OR "Grêmio" OR "Internacional futebol" OR "Vasco" OR "Santos FC" OR "Mercado da Bola" OR "Brasileirão" OR "Libertadores" OR "Copa do Brasil" OR "Champions League")';
    const context = '(futebol OR soccer OR "contratação" OR "reforço")';
    
    const query = encodeURIComponent(`${mainTerms} ${context} -site:ge.globo.com when:6h`);
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    
    console.log(`\n🔍 Consultando Google News: ${searchUrl}`);
    const feed = await parser.parseURL(searchUrl);
    
    const uniqueNews: any[] = [];
    const seenTitles = new Set();
    
    const junkTerms = [
      'prefeitura', 'governo', 'bolsa', 'funarte', 'dia internacional', 'institucional', 'anpd', 'concurso', 'vacina', 'sesc', 
      'ingressos', 'bilheteria', 'venda de ingressos', 'sócio-torcedor', 'feminino', 'feminina', 'sub-17', 'sub-15',
      'onde assistir', 'escalação', 'escalações', 'provável time', 'horário do jogo', 'transmissão', 'vôlei', 'basquete', 'vender'
    ];

    for (const item of feed.items) {
      if (!item.link || !item.title) continue;
      const titleLower = item.title.toLowerCase();

      if (item.pubDate) {
        const pubDate = new Date(item.pubDate);
        const now = new Date();
        const diffInHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours > 6) {
          console.log(`🚫 Notícia antiga descartada (${Math.floor(diffInHours)}h atrás): ${item.title}`);
          continue;
        }
      }
      
      if (junkTerms.some(term => titleLower.includes(term))) continue;

      const upperCaseLetters = item.title.replace(/[^A-Z]/g, "").length;
      if (upperCaseLetters > item.title.length * 0.5 && item.title.length > 20) continue;

      const words = titleLower.split(' ').slice(0, 2).join(' ');
      if (!seenTitles.has(words) && uniqueNews.length < 20) {
        uniqueNews.push(item);
        seenTitles.add(words);
      }
    }
    
    let filteredList = uniqueNews;
    if (uniqueNews.length > 0) {
      console.log(`🤖 IA analisando ${uniqueNews.length} candidatos filtrados...`);
      const validIndices = await filterFootballOnly(uniqueNews.map(n => ({ 
        title: n.title || '', 
        snippet: n.contentSnippet || n.title || '',
        source: n.source?.name || n.source || 'Portal de Notícias'
      })));
      
      if (validIndices.length > 0) {
        console.log(`✅ IA aprovou os índices: ${JSON.stringify(validIndices)}`);
        filteredList = validIndices.map(i => uniqueNews[i]).filter(n => n !== undefined);
      } else {
        console.log('⚠️ IA foi muito rigorosa. Usando candidatos originais como fallback.');
      }
    }

    const processedItems = [];
    for (const item of filteredList) {
      const { finalUrl, imageUrl } = await resolveAndScrapeImage(item.link || '');
      
      const lowUrl = finalUrl.toLowerCase();
      const forbiddenDomains = ['instagram.com', 'twitter.com', 'facebook.com', 'ge.globo.com', 'youtube.com', 'tiktok.com'];
      if (forbiddenDomains.some(domain => lowUrl.includes(domain))) {
        console.log(`🚫 Fonte inválida descartada pós-resolução: ${finalUrl}`);
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

      if (processedItems.length >= 5) break;
    }

    return processedItems;
  } catch (error: any) {
    console.error('Erro ao buscar notícias:', error);
    return [];
  }
}
