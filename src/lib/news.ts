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

    const { imageUrl, fullSnippet } = await page.evaluate(() => {
      const og = document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content");
      const twitter = document
        .querySelector('meta[name="twitter:image"]')
        ?.getAttribute("content");

      // Tenta pegar o texto principal da notícia em vários seletores comuns
      const selectors = [
        "article p",
        ".article-content p",
        ".content p",
        ".post-content p",
        ".entry-content p",
        ".news-content p",
        ".texto-noticia p",
        ".m-news-body p",
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

      const metaDesc =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";
      const metaKeywords =
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute("content") || "";
      const articleTags = Array.from(
        document.querySelectorAll('meta[property="article:tag"]'),
      )
        .map((m) => m.getAttribute("content"))
        .join(", ");

      return {
        imageUrl: og || twitter || null,
        fullSnippet:
          `${paragraphs} | Tags: ${articleTags} | Keywords: ${metaKeywords} | Desc: ${metaDesc}`.substring(
            0,
            2000,
          ),
      };
    });

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
  const rules = "item=.card-news&itemTitle=.card-news__text--title&itemLink=a";
  const fullUrl = `${rsshubBase}${encodeURIComponent(target.terra)}/${encodeURIComponent(rules)}`;

  try {
    const feed = await parser.parseURL(fullUrl);
    return feed.items.map((item) => ({
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || new Date().toISOString(),
      contentSnippet: item.contentSnippet || "",
      id: item.guid || item.link || "",
      category: target.name,
    }));
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

      cards.forEach((card) => {
        const titleEl = card.querySelector(
          ".card-news__text--title, .card-news-horizontal__text--title",
        );
        const linkEl = card.querySelector("a");
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent?.trim() || "",
            link: linkEl.href,
            pubDate: new Date().toISOString(),
            contentSnippet: "",
            id: linkEl.href,
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

/**
 * Busca notícias via Google News
 */
export async function fetchGoogleNews(
  queryStr: string,
  category: string,
): Promise<NewsItem[]> {
  try {
    // Janela de 24h para garantir cobertura total do dia em todos os temas
    const query = encodeURIComponent(
      `${queryStr} futebol 2026 -site:ge.globo.com when:24h`,
    );
    const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
    const feed = await parser.parseURL(searchUrl);

    // Filtro rigoroso para garantir que o título tenha palavras relacionadas a futebol
    const footballKeywords = [
      "futebol",
      "gol",
      "clube",
      "treinador",
      "técnico",
      "jogador",
      "atleta",
      "atacante",
      "zagueiro",
      "goleiro",
      "meia",
      "volante",
      "lateral",
      "partida",
      "jogo",
      "campeonato",
      "contratação",
      "reforço",
      "elenco",
      "campo",
      "estádio",
      "torcida",
      "venda",
      "compra",
      "mercado",
      "bola",
      "copa",
      "seleção",
      "saída",
      "chegada",
      "contrato",
      "renovação",
      "rescisão",
      "brasileirão",
      "série a",
      "libertadores",
      "copa do brasil",
    ];

    return feed.items
      .filter((item) => {
        const title = (item.title || "").toLowerCase();
        // Bloqueia divisões inferiores e categorias irrelevantes
        const lowerDivs = ["série b", "série c", "série d", "quarta divisão", "sub-17", "sub-15"];
        if (lowerDivs.some(div => title.includes(div))) return false;
        
        return footballKeywords.some((kw) => title.includes(kw));
      })
      .map((item) => ({
        title: item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || new Date().toISOString(),
        contentSnippet: item.contentSnippet || "",
        id: item.guid || item.link || "",
        category: category,
      }));
  } catch (e) {
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
      `\n🚀 Iniciando Agregador de Notícias (RSSHub + Google News)...`,
    );

    // Busca em paralelo, mas separando por tipo para priorizar o Terra
    const terraTasks = FOOTBALL_TARGETS.map((target) =>
      fetchRSSHubTerra(target),
    );
    const googleTasks = FOOTBALL_TARGETS.map((target) =>
      fetchGoogleNews(target.name, target.name),
    );

    // Inclui tendências específicas se fornecidas
    const trendsTasks = trends.map((t) => fetchGoogleNews(t, "TREND"));

    const [terraResults, googleResults, trendsResults] = await Promise.all([
      Promise.all(terraTasks),
      Promise.all(googleTasks),
      Promise.all(trendsTasks),
    ]);

    // PRIORIDADE: RSSHub (Terra) é a fonte principal.
    // Só usamos Google News/Trends se o Terra não retornar nada ou para complementar temas muito específicos.
    const terraFlat = terraResults.flat();
    const allItems = terraFlat.length > 0 ? terraFlat : [...googleResults.flat(), ...trendsResults.flat()];
    
    console.log(`📊 Total bruto de itens encontrados: ${allItems.length} (Fonte Principal: ${terraFlat.length > 0 ? 'RSSHub/Terra' : 'Google/Trends'})`);

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
        continue;
      }

      // Limpeza de título (remove o nome do portal se houver)
      const cleanTitle = item.title.split(" - ")[0].trim();

      // Filtro de frescor rigoroso: 4 horas para geral, 24h para Mercado da Bola
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
      console.log(`📸 Processando imagens para as top 25 notícias selecionadas...`);
      const scrapeResults = await Promise.all(
        toProcess.slice(0, 25).map(async (item) => {
          const { finalUrl, imageUrl, fullSnippet } =
            await resolveAndScrapeImage(item.link, browser);

          if (!imageUrl) return null;
          return {
            ...item,
            link: finalUrl,
            imageUrl,
            contentSnippet: fullSnippet || item.contentSnippet,
          };
        }),
      );

      for (const res of scrapeResults) {
        if (res) finalItems.push(res);
      }
    } finally {
      await browser.close();
    }

    return finalItems;
  } catch (error: any) {
    console.error("Erro fatal ao buscar notícias:", error);
    return [];
  }
}
