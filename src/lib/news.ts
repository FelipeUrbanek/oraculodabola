import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

const parser = new Parser();

const TRUSTED_DOMAINS = [
  "terra.com.br",
  "globo.com",
  "uol.com.br",
  "espn.com.br",
  "gazetaesportiva.com",
  "lance.com.br",
  "goal.com",
  "itatiaia.com.br",
  "cnnbrasil.com.br",
  "estadao.com.br",
  "folha.uol.com.br",
  "google.com",
  "meutimao.com.br",
  "netvasco.com.br",
  "netflu.com.br",
  "futebolinterior.com.br",
  "diariodepernambuco.com.br",
  "opovo.com.br",
  "gauchazh.clicrbs.com.br",
  "jmonline.com.br",
  "bandab.com.br",
  "msn.com",
  "ogol.com.br",
  "instagram.com",
  "metropoles.com",
  "portalpopline.com.br",
  "band.uol.com.br",
  "r7.com",
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  id: string;
  imageUrl?: string;
  category: string; // Adicionado para lógica de rodízio
}

const FOOTBALL_TARGETS = [
  { name: "Flamengo", terra: "https://www.terra.com.br/esportes/flamengo/" },
  { name: "Palmeiras", terra: "https://www.terra.com.br/esportes/palmeiras/" },
  {
    name: "Corinthians",
    terra: "https://www.terra.com.br/esportes/corinthians/",
  },
  { name: "São Paulo", terra: "https://www.terra.com.br/esportes/sao-paulo/" },
  { name: "Santos", terra: "https://www.terra.com.br/esportes/santos/" },
  {
    name: "Atlético-MG",
    terra: "https://www.terra.com.br/esportes/atletico-mg/",
  },
  { name: "Cruzeiro", terra: "https://www.terra.com.br/esportes/cruzeiro/" },
  { name: "Grêmio", terra: "https://www.terra.com.br/esportes/gremio/" },
  {
    name: "Internacional",
    terra: "https://www.terra.com.br/esportes/internacional/",
  },
  { name: "Vasco", terra: "https://www.terra.com.br/esportes/vasco/" },
  { name: "Botafogo", terra: "https://www.terra.com.br/esportes/botafogo/" },
  {
    name: "Fluminense",
    terra: "https://www.terra.com.br/esportes/fluminense/",
  },
  { name: "Bahia", terra: "https://www.terra.com.br/esportes/bahia/" },
  { name: "Fortaleza", terra: "https://www.terra.com.br/esportes/fortaleza/" },
  {
    name: "Athletico-PR",
    terra: "https://www.terra.com.br/esportes/atletico-pr/",
  },
  { name: "Coritiba", terra: "https://www.terra.com.br/esportes/coritiba/" },
  { name: "Vitória", terra: "https://www.terra.com.br/esportes/vitoria/" },
  { name: "Sport", terra: "https://www.terra.com.br/esportes/sport/" },
  { name: "Ceará", terra: "https://www.terra.com.br/esportes/ceara/" },
  {
    name: "Bragantino",
    terra: "https://www.terra.com.br/esportes/bragantino/",
  },
  { name: "Cuiabá", terra: "https://www.terra.com.br/esportes/cuiaba/" },
  {
    name: "Mercado da Bola",
    terra: "https://www.terra.com.br/esportes/futebol/mercado-da-bola/",
  },
  {
    name: "Brasileirão",
    terra: "https://www.terra.com.br/esportes/futebol/brasileiro-serie-a/",
  },
  {
    name: "Libertadores",
    terra: "https://www.terra.com.br/esportes/futebol/libertadores/",
  },
  {
    name: "Copa do Brasil",
    terra: "https://www.terra.com.br/esportes/futebol/copa-do-brasil/",
  },
  {
    name: "Champions League",
    terra:
      "https://www.terra.com.br/esportes/futebol/internacional/liga-dos-campeoes/",
  },
  {
    name: "Futebol Internacional",
    terra: "https://www.terra.com.br/esportes/futebol/internacional/",
  },
  {
    name: "Real Madrid",
    terra:
      "https://www.terra.com.br/esportes/futebol/internacional/equipes/real-madrid/",
  },
  {
    name: "Barcelona",
    terra:
      "https://www.terra.com.br/esportes/futebol/internacional/equipes/barcelona/",
  },
  {
    name: "Copa 2026",
    terra: "https://www.terra.com.br/esportes/futebol/copa-2026/",
  },
];

/**
 * Resolve o link final e captura a imagem
 */
export async function resolveAndScrapeImage(
  googleUrl: string,
  browser?: any,
): Promise<{ finalUrl: string; imageUrl?: string; fullSnippet?: string }> {
  let internalBrowser = false;
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    internalBrowser = true;
  }

  const page = await browser.newPage();

  try {
    await page.goto(googleUrl, { waitUntil: "networkidle2", timeout: 20000 });
    if (page.url().includes("news.google.com")) {
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
        .catch(() => {});
    }
    const finalUrl = page.url();
    // console.log(`🌐 Scrapeando: ${finalUrl}`);

    const { imageUrl, fullSnippet } = await page.evaluate(() => {
      const getMeta = (name: string) => 
        document.querySelector(`meta[property="${name}"]`)?.getAttribute("content") ||
        document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");

      const img = getMeta("og:image") || getMeta("twitter:image") || getMeta("image");
      
      // Se não tem meta image, tenta a primeira imagem grande do artigo
      let articleImg = null;
      if (!img) {
        const firstImg = document.querySelector('article img, .content img, .post-content img, .main-image img');
        if (firstImg && firstImg instanceof HTMLImageElement && firstImg.src.startsWith('http')) {
          articleImg = firstImg.src;
        }
      }

      const selectors = [
        "article p", ".article-content p", ".content p", ".post-content p",
        ".entry-content p", ".news-content p", ".texto-noticia p", ".m-news-body p",
        ".main-text p", "#article-body p"
      ];

      let paragraphs = "";
      for (const sel of selectors) {
        const found = Array.from(document.querySelectorAll(sel))
          .slice(0, 10)
          .map((p) => p.textContent?.trim())
          .filter((t) => t && t.length > 20)
          .join(" ");
        if (found.length > 50) {
          paragraphs = found;
          break;
        }
      }

      const metaDesc = getMeta("description") || "";
      const metaKeywords = getMeta("keywords") || "";
      const articleTags = Array.from(document.querySelectorAll('meta[property="article:tag"]'))
        .map((m) => m.getAttribute("content"))
        .join(", ");

      return {
        imageUrl: img || articleImg || null,
        fullSnippet: `${paragraphs} | Tags: ${articleTags} | Keywords: ${metaKeywords} | Desc: ${metaDesc}`.substring(0, 2000),
      };
    });

    if (!imageUrl) {
      // console.log(`⚠️ Nenhuma imagem encontrada para ${finalUrl}`);
    }

    return { finalUrl, imageUrl: imageUrl || undefined, fullSnippet };
  } catch (error: any) {
    return { finalUrl: googleUrl, imageUrl: undefined, fullSnippet: undefined };
  } finally {
    await page.close();
    if (internalBrowser) await browser.close();
  }
}

/**
 * Busca notícias via RSSHub (Terra)
 */
async function fetchRSSHubTerra(target: {
  name: string;
  terra: string;
}): Promise<NewsItem[]> {
  const rsshubBase = "http://localhost:1200/rsshub/transform/html/";
  const rules = "item=.card-news&itemTitle=.card-news__text--title&itemLink=a&itemImage=img";
  const fullUrl = `${rsshubBase}${encodeURIComponent(target.terra)}/${encodeURIComponent(rules)}`;

  try {
    const feed = await parser.parseURL(fullUrl);
    return feed.items.map((item, index) => {
      // O usuário confirmou que as notícias mais acima são as mais novas.
      // Se a data for inválida ou ausente, usamos o timestamp atual menos alguns segundos para manter a ordem.
      let pubDate = item.pubDate;
      if (!pubDate || pubDate === "Invalid Date" || isNaN(Date.parse(pubDate))) {
        const date = new Date();
        date.setSeconds(date.getSeconds() - index); // Mantém a ordem decrescente
        pubDate = date.toISOString();
      }

      return {
        title: item.title || "",
        link: item.link || "",
        pubDate: pubDate,
        contentSnippet: item.contentSnippet || "",
        id: item.guid || item.link || "",
        category: target.name,
      };
    });
  } catch (e) {
    console.log(
      `⚠️ RSSHub falhou para ${target.name}. Tentando Scraper Direto...`,
    );
    return fetchTerraDirect(target);
  }
}

/**
 * Scraper direto do Terra usando Puppeteer (Anti-Bloqueio 503)
 */
export async function fetchTerraDirect(target: any): Promise<NewsItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(target.terra, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const news = await page.evaluate((category) => {
      const items: any[] = [];
      const cards = document.querySelectorAll(
        ".card-news, .card-news-horizontal",
      );

      cards.forEach((card, index) => {
        const titleEl = card.querySelector(
          ".card-news__text--title, .card-news-horizontal__text--title",
        );
        const linkEl = card.querySelector("a");
        const imgEl = card.querySelector("img");
        
        if (titleEl && linkEl) {
          const date = new Date();
          date.setSeconds(date.getSeconds() - index);

          items.push({
            title: titleEl.textContent?.trim() || "",
            link: linkEl.href,
            pubDate: date.toISOString(),
            contentSnippet: "",
            id: linkEl.href,
            imageUrl: imgEl?.src || imgEl?.getAttribute('data-src') || undefined,
            category: category,
          });
        }
      });
      return items;
    }, target.name);

    await browser.close();
    return news;
  } catch (e) {
    await browser.close();
    return [];
  }
}

export function isTrustedSource(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return TRUSTED_DOMAINS.some(
      (trusted) => domain === trusted || domain.endsWith("." + trusted),
    );
  } catch (e) {
    return false;
  }
}

export async function fetchFootballNews(
  trends: string[] = [],
  excludeIds: string[] = [],
): Promise<NewsItem[]> {
  try {
    console.log(
      `\n🚀 Iniciando Agregador de Notícias (RSSHub + Terra Scraper)...`,
    );

    // EXCLUSIVO RSSHUB/TERRA: Conforme solicitado pelo usuário.
    const terraTasks = FOOTBALL_TARGETS.map((target) => fetchRSSHubTerra(target));
    const terraResults = await Promise.all(terraTasks);
    const allItems = terraResults.flat();
    
    console.log(`📊 Total bruto de itens encontrados: ${allItems.length} (Fonte: RSSHub/Terra)`);

    const uniqueNews: NewsItem[] = [];
    const seenLinks = new Set();
    const seenTitles = new Set();

    const now = Date.now();
    let blockedSourcesCount = 0;

    for (const item of allItems) {
      if (!item.link || !item.title) continue;

      // Validação de Fonte Confiável e se já foi postada
      const itemIdentifier = item.id || item.link;
      if (!isTrustedSource(item.link) || excludeIds.includes(itemIdentifier)) {
        if (!isTrustedSource(item.link)) blockedSourcesCount++;
        // console.log(`⏩ Ignorando ${item.title} (Já postado ou fonte não confiável)`);
        continue;
      }

      // Limpeza de título (remove o nome do portal se houver)
      const cleanTitle = item.title.split(" - ")[0].trim();

      // Filtro de frescor: 4 horas para geral (restaurado), 24h para Mercado da Bola
      const diff = (now - new Date(item.pubDate).getTime()) / (1000 * 60);
      const limitMinutes = item.category === "Mercado da Bola" ? 1440 : 240; // 24h vs 4h
      if (diff > limitMinutes) continue;

      // Anti-duplicação
      if (seenLinks.has(item.link) || seenTitles.has(cleanTitle.toLowerCase()))
        continue;

      uniqueNews.push({ ...item, title: cleanTitle });
      seenLinks.add(item.link);
      seenTitles.add(cleanTitle.toLowerCase());
    }

    // Ordena por data (mais recentes primeiro)
    const sortedNews = uniqueNews.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    );

    console.log(`🔎 Filtradas ${sortedNews.length} notícias relevantes. (🚫 ${blockedSourcesCount} fontes não confiáveis ocultadas)`);
    console.log(`📸 Capturando imagens para as melhores candidatas...`);

    // Garante variedade de categorias nas notícias processadas
    const diverseNews: NewsItem[] = [];
    const categoriesIncluded = new Set<string>();

    // Primeiro, pega a notícia mais recente de CADA categoria
    for (const target of FOOTBALL_TARGETS) {
      const latestForTarget = sortedNews.find(
        (n) => n.category === target.name,
      );
      if (latestForTarget) {
        diverseNews.push(latestForTarget);
        categoriesIncluded.add(target.name);
      }
    }

    // Depois, preenche o resto com as mais recentes que ainda não foram incluídas, até chegar em 20
    const remaining = sortedNews.filter(
      (n) => !diverseNews.some((dn) => dn.link === n.link),
    );
    const toProcess = [...diverseNews, ...remaining].slice(0, 40);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const finalItems: NewsItem[] = [];

    try {
      console.log(`📸 Processando imagens para as top ${toProcess.length} notícias selecionadas...`);
      
      // Processa em lotes de 10 para não sobrecarregar mas garantir que achamos algo
      for (let i = 0; i < toProcess.length && finalItems.length < 15; i += 10) {
        const batch = toProcess.slice(i, i + 10);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            const { finalUrl, imageUrl, fullSnippet } = await resolveAndScrapeImage(item.link, browser);
            // Se não tem imagem, ainda incluímos o item MAS sem o campo imageUrl. 
            // A lógica do main.ts decidirá se aceita ou não (preferencialmente não, mas se não tiver nada, ele aceita).
            return {
              ...item,
              link: finalUrl,
              imageUrl: imageUrl || undefined,
              contentSnippet: fullSnippet || item.contentSnippet,
            };
          })
        );
        
        for (const res of batchResults) {
          if (res) finalItems.push(res);
        }
        
        // Se já temos 10 com imagem, podemos parar
        if (finalItems.filter(f => f.imageUrl).length >= 10) break;
      }
    } finally {
      await browser.close();
    }

    console.log(`✅ Agregação concluída: ${finalItems.length} itens prontos para processamento (Com imagem: ${finalItems.filter(f => f.imageUrl).length}).`);
    return finalItems;
  } catch (error: any) {
    console.error("Erro fatal ao buscar notícias:", error);
    return [];
  }
}
