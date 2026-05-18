import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

const parser = new Parser();

const TRUSTED_DOMAINS = [
  "terra.com.br",
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  id: string;
  imageUrl?: string;
  category: string;
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

export async function resolveAndScrapeImage(
  googleUrl: string,
  browser?: any,
): Promise<{ finalUrl: string; imageUrl?: string; fullSnippet?: string; exactDate?: string }> {
  let internalBrowser = false;
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    internalBrowser = true;
  }

  const page = await browser.newPage();

  try {
    // Intercepta e bloqueia assets desnecessários para acelerar o scrape em 10x
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    
    // Espera um pouco para o JS renderizar as meta tags se necessário
    await new Promise(r => setTimeout(r, 1000));

    if (page.url().includes("news.google.com")) {
      await page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 })
        .catch(() => {});
    }
    const finalUrl = page.url();

    const results = await page.evaluate(`(() => {
      const getMeta = (name) => {
        const el = document.querySelector('meta[property="' + name + '"]') ||
                   document.querySelector('meta[name="' + name + '"]') ||
                   document.querySelector('[itemprop="' + name + '"]');
        return el ? el.getAttribute("content") : null;
      };

      const img = getMeta("og:image") || getMeta("twitter:image") || getMeta("image") || getMeta("thumb") || getMeta("thumbnail");
      
      let articleImg = null;
      if (!img) {
        const imgSelectors = [
          '.article__image img',
          'article img',
          '.content img',
          '.post-content img',
          '.main-image img',
          '#article-body img',
          'picture img'
        ];
        for (const sel of imgSelectors) {
          const found = document.querySelector(sel);
          if (found && found instanceof HTMLImageElement && found.src && found.src.startsWith('http') && !found.src.includes('logo')) {
            articleImg = found.src;
            break;
          }
        }
      }

      const paragraphsSelectors = [
        "article p", ".article__content p", ".article-content p", ".content p", ".post-content p",
        ".entry-content p", ".news-content p", ".texto-noticia p", ".m-news-body p",
        ".main-text p", "#article-body p", ".story-content p", ".body-copy p"
      ];

      let paragraphs = "";
      for (const sel of paragraphsSelectors) {
        const found = Array.from(document.querySelectorAll(sel))
          .slice(0, 20)
          .map((p) => p.textContent.trim())
          .filter((t) => t && t.length > 20)
          .join(" ");
        if (found.length > 100) {
          paragraphs = found;
          break;
        }
      }

      const metaDesc = getMeta("description") || "";
      const metaKeywords = getMeta("keywords") || "";
      const articleTags = Array.from(document.querySelectorAll('meta[property="article:tag"]'))
        .map((m) => m.getAttribute("content"))
        .join(", ");

      const exactDate = getMeta("datePublished") || 
                        getMeta("article:published_time") || 
                        getMeta("publish-date") || 
                        getMeta("publishdate") || 
                        null;

      return {
        imageUrl: img || articleImg || null,
        fullSnippet: (paragraphs + " | Tags: " + articleTags + " | Keywords: " + metaKeywords + " | Desc: " + metaDesc).substring(0, 2000),
        exactDate: exactDate
      };
    })()`);

    const { imageUrl, fullSnippet, exactDate } = results as any;
    if (imageUrl || exactDate) {
       console.log(`[SCRAPER SUCCESS] ${finalUrl} -> img: ${imageUrl ? 'SIM' : 'NÃO'}, date: ${exactDate}`);
    }

    return { finalUrl, imageUrl: imageUrl || undefined, fullSnippet, exactDate: exactDate || undefined };
  } catch (error: any) {
    console.error(`❌ Erro no Scrape de Imagem/Data para ${googleUrl}:`, error.message);
    return { finalUrl: googleUrl, imageUrl: undefined, fullSnippet: undefined, exactDate: undefined };
  } finally {
    await page.close();
    if (internalBrowser) await browser.close();
  }
}

export async function fetchRSSHubTerra(target: {
  name: string;
  terra: string;
}, browser?: any): Promise<NewsItem[]> {
  const rsshubBase = "http://localhost:1200/rsshub/transform/html/";
  const rules = "item=.card-news&itemTitle=.card-news__text--title&itemLink=a&itemImage=img";
  const fullUrl = `${rsshubBase}${encodeURIComponent(target.terra)}/${encodeURIComponent(rules)}`;

  try {
    const feed = await parser.parseURL(fullUrl);
    return feed.items.map((item, index) => {
      let pubDate = item.pubDate;
      if (!pubDate || pubDate === "Invalid Date" || isNaN(Date.parse(pubDate))) {
        const date = new Date();
        date.setSeconds(date.getSeconds() - index);
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
    console.log(`⚠️ RSSHub falhou para ${target.name}. Tentando Scraper Direto...`);
    return fetchTerraDirect(target, browser);
  }
}

export async function fetchTerraDirect(target: { name: string; terra: string }, browser?: any): Promise<NewsItem[]> {
  let internalBrowser = false;
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    internalBrowser = true;
  }

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.goto(target.terra, { waitUntil: "domcontentloaded", timeout: 20000 });

    const news = await page.evaluate((category: string) => {
      const items: any[] = [];
      const cards = document.querySelectorAll(".card-news, .card-news-horizontal");

      cards.forEach((card, index) => {
        const titleEl = card.querySelector(".card-news__text--title, .card-news-horizontal__text--title");
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

    await page.close();
    return news;
  } catch (e) {
    return [];
  } finally {
    if (internalBrowser) await browser.close();
  }
}

const FORBIDDEN_KEYWORDS = [
  "sub-20", "sub 20", "sub20",
  "sub-17", "sub 17", "sub17",
  "sub-15", "sub 15", "sub15",
  "feminino", "feminina",
  "aspirantes", "categorias de base",
  "copinha", "copa são paulo"
];

export function isAllowedTopic(title: string): boolean {
  const titleLower = title.toLowerCase();
  return !FORBIDDEN_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

export function isTrustedSource(url: string): boolean {
  try {
    const urlLower = url.toLowerCase();
    // Bloqueia parceiros conhecidos mesmo que estejam dentro do domínio terra
    if (urlLower.includes("meutimao") || urlLower.includes("nossofla") || urlLower.includes("jogada10") || urlLower.includes("gazetaesportiva")) {
      return false;
    }

    const domain = new URL(url).hostname.replace("www.", "");
    return TRUSTED_DOMAINS.some((trusted) => domain === trusted || domain.endsWith("." + trusted));
  } catch (e) {
    return false;
  }
}

export async function fetchFootballNews(trends: string[] = [], excludeIds: string[] = []): Promise<NewsItem[]> {
  const scraperBrowser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    console.log(`\n🚀 Iniciando Agregador de Notícias (RSSHub + Terra Scraper)...`);
    const terraTasks = FOOTBALL_TARGETS.map((target) => fetchRSSHubTerra(target, scraperBrowser));
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
      const itemIdentifier = item.id || item.link;
      if (!isTrustedSource(item.link) || !isAllowedTopic(item.title) || excludeIds.includes(itemIdentifier)) {
        if (!isTrustedSource(item.link) || !isAllowedTopic(item.title)) blockedSourcesCount++;
        continue;
      }

      const cleanTitle = item.title.split(" - ")[0].trim();
      const diff = (now - new Date(item.pubDate).getTime()) / (1000 * 60);
      const limitMinutes = item.category === "Mercado da Bola" ? 1440 : 240;
      if (diff > limitMinutes) continue;

      if (seenLinks.has(item.link) || seenTitles.has(cleanTitle.toLowerCase())) continue;

      uniqueNews.push({ ...item, title: cleanTitle });
      seenLinks.add(item.link);
      seenTitles.add(cleanTitle.toLowerCase());
    }

    const sortedNews = uniqueNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    console.log(`🔎 Filtradas ${sortedNews.length} notícias relevantes. (🚫 ${blockedSourcesCount} fontes não confiáveis ocultadas)`);
    
    const diverseNews: NewsItem[] = [];
    for (const target of FOOTBALL_TARGETS) {
      const latestForTarget = sortedNews.find((n) => n.category === target.name);
      if (latestForTarget) diverseNews.push(latestForTarget);
    }

    const remaining = sortedNews.filter((n) => !diverseNews.some((dn) => dn.link === n.link));
    const toProcess = [...diverseNews, ...remaining].slice(0, 40);

    const imageBrowser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const finalItems: NewsItem[] = [];

    try {
      console.log(`📸 Processando imagens para as top ${toProcess.length} notícias selecionadas...`);
      for (let i = 0; i < toProcess.length && finalItems.length < 15; i += 3) {
        const batch = toProcess.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            const { finalUrl, imageUrl, fullSnippet, exactDate } = await resolveAndScrapeImage(item.link, imageBrowser);
            const finalPubDate = exactDate || item.pubDate;
            
            // Re-verifica a data após extrair a real do HTML
            const diffFinal = (Date.now() - new Date(finalPubDate).getTime()) / (1000 * 60);
            const limitMinutesFinal = item.category === "Mercado da Bola" ? 1440 : 240;
            if (diffFinal > limitMinutesFinal) {
                console.log(`[REJEITADO] Notícia antiga detectada no scraper de imagem: ${item.title} (${diffFinal.toFixed(0)} mins atrás)`);
                return null;
            }

            return {
              ...item,
              link: finalUrl,
              imageUrl: imageUrl || undefined,
              pubDate: finalPubDate,
              contentSnippet: fullSnippet || item.contentSnippet,
            };
          })
        );
        for (const res of batchResults) if (res) finalItems.push(res);
        if (finalItems.filter(f => f.imageUrl).length >= 10) break;
      }
    } finally {
      await imageBrowser.close();
    }

    console.log(`✅ Agregação concluída: ${finalItems.length} itens prontos para processamento (Com imagem: ${finalItems.filter(f => f.imageUrl).length}).`);
    return finalItems;
  } catch (error: any) {
    console.error("❌ Erro fatal na agregação:", error.message);
    return [];
  } finally {
    await scraperBrowser.close();
  }
}
