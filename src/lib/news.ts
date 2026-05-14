import Parser from 'rss-parser';

const parser = new Parser();

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  id: string;
  imageUrl?: string;
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export async function resolveAndScrapeImage(googleUrl: string): Promise<{ finalUrl: string, imageUrl?: string }> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    console.log(`\n📡 Iniciando resolução: ${googleUrl.substring(0, 40)}...`);
    
    // Abrir o link do Google News e esperar o redirecionamento real
    await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Se ainda estiver no Google News, esperar um pouco mais
    if (page.url().includes('news.google.com')) {
      console.log('⏳ Ainda no Google News, aguardando salto final...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    const finalUrl = page.url();
    console.log(`📍 URL Final: ${finalUrl}`);

    // Capturar a imagem usando código simples para evitar erro de transpiração (__name)
    const imageUrl = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og) return og;
      // Tentar pegar a imagem de forma mais robusta
      let imageUrl = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
                   document.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content') ||
                   document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

      // Se não achou meta tag, tenta buscar a maior imagem do corpo
      if (!imageUrl) {
        const images: string[] = [];
        document.querySelectorAll('img').forEach((el) => {
          const src = el.getAttribute('src');
          if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
            images.push(src);
          }
        });
        imageUrl = images[0] || null;
      }
      const img = document.querySelector('meta[name="image"]')?.getAttribute('content');
      if (img) return img;
      return imageUrl || null;
    }) || undefined;

    if (imageUrl) {
      console.log(`🖼️ Sucesso! Imagem encontrada: ${imageUrl.substring(0, 70)}...`);
    } else {
      console.warn('⚠️ Nenhuma imagem (og:image) detectada no HTML.');
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
    const trendQuery = trendTerms.length > 0 ? `(${trendTerms.join(' OR ')}) ` : '';
    const query = encodeURIComponent(`${trendQuery}(futebol brasileiro OR "Mercado da Bola" OR Flamengo OR Palmeiras OR Corinthians OR "São Paulo" OR "Atlético-MG" OR Cruzeiro OR Grêmio OR Inter OR Vasco OR Santos OR Botafogo OR Fluminense OR "Pós-jogo" OR "Coletiva" OR "Entrevista" OR "Atuações" OR "Notas" OR "Tabela" OR "Classificação" OR "Goleada" OR "Virada" OR "Oficial" OR "Confirmado" OR "Exclusivo" OR "Demissão" OR "Contratação" OR "Reforço") -site:ge.globo.com (site:uol.com.br OR site:tntsports.com.br OR site:espn.com.br OR site:trivela.com.br OR site:lance.com.br OR site:terra.com.br OR site:gazetaesportiva.com OR site:goal.com OR site:metropoles.com OR site:itatiaia.com.br OR site:estadao.com.br) when:1h`);
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    console.log(`\n🔍 Consultando Google News: ${searchUrl}`);
    const feed = await parser.parseURL(searchUrl);
    
    // Filtrar notícias com títulos muito parecidos (ex: SAF)
    const uniqueNews: any[] = [];
    const seenWords = new Set();

    for (const item of feed.items) {
      const words = (item.title || '').split(' ').slice(0, 3).join(' ');
      const pubDate = new Date(item.pubDate || '');
      const now = new Date();
      const diffHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);

      // Só aceita se for nas últimas 24h e não for repetido
      if (!seenWords.has(words) && diffHours < 24 && uniqueNews.length < 4) {
        uniqueNews.push(item);
        seenWords.add(words);
      }
    }
    
    const processedItems = [];
    for (const item of uniqueNews) {
      const { finalUrl, imageUrl } = await resolveAndScrapeImage(item.link || '');
      
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
