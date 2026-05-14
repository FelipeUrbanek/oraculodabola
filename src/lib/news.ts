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
    const footballKeywords = ['futebol', 'soccer', 'gol', 'copa', 'brasileirão', 'libertadores', 'champions', 'escalação', 'mercado', 'transferência', 'treinador', 'estádio', 'fifa', 'nba', 'basquete', 'vôlei', 'tênis', 'reforço', 'contratação', 'arbitragem', 'var', 'tabela', 'clássico'];
    const popularClubs = ['flamengo', 'palmeiras', 'corinthians', 'santos', 'vasco', 'botafogo', 'fluminense', 'grêmio', 'inter', 'cruzeiro', 'atlético', 'bahia', 'sport', 'vitória', 'fortaleza', 'ceará', 'real madrid', 'barcelona', 'city', 'liverpool', 'psg', 'bayern', 'united', 'chelsea', 'arsenal', 'juventus'];
    
    // Filtrar apenas tendências que pareçam esportivas ou de clubes famosos
    const filteredTrends = trendTerms.filter(term => 
      footballKeywords.some(key => term.toLowerCase().includes(key)) ||
      popularClubs.some(club => term.toLowerCase().includes(club))
    );

    const trendQuery = filteredTrends.length > 0 ? `${filteredTrends.join(' OR ')} OR ` : '';
    const mainTerms = 'Flamengo OR Palmeiras OR Corinthians OR "São Paulo" OR "Atlético-MG" OR Cruzeiro OR Grêmio OR Inter OR Vasco OR Santos OR "Mercado da Bola" OR Brasileirão OR Libertadores OR "Copa do Brasil" OR "Champions League" OR "Seleção Brasileira" OR "Pós-jogo" OR Oficial OR Reforço OR Escalação OR Tabela OR Sorteio';
    const context = '(futebol OR soccer OR "mercado da bola" OR esporte)';
    
    // Permitir qualquer site, bloqueando apenas o ge.globo.com na query
    const query = encodeURIComponent(`(${trendQuery}${mainTerms}) ${context} -site:ge.globo.com when:4h`);
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    console.log(`\n🔍 Consultando Google News: ${searchUrl}`);
    const feed = await parser.parseURL(searchUrl);
    
    const uniqueNews: any[] = [];
    const seenWords = new Set();

    for (const item of feed.items) {
      if (!item.link || !item.title) continue;
      
      // Filtrar redes sociais e GE que às vezes vaza
      const link = item.link.toLowerCase();
      if (link.includes('ge.globo.com') || link.includes('instagram.com') || link.includes('youtube.com') || link.includes('twitter.com') || link.includes('facebook.com')) continue;

      const words = item.title.split(' ').slice(0, 3).join(' ');
      if (!seenWords.has(words) && uniqueNews.length < 15) {
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
