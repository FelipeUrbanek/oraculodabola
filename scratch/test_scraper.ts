import puppeteer from "puppeteer";

const FOOTBALL_TARGETS = [
  { name: "Santos", terra: "https://www.terra.com.br/esportes/santos/" }
];

export async function fetchTerraDirect(target: any): Promise<any[]> {
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
        const imgEl = card.querySelector("img");
        
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent?.trim() || "",
            link: linkEl.href,
            pubDate: new Date().toISOString(),
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

async function runTest() {
  const results: any = {};
  for (const target of FOOTBALL_TARGETS) {
    console.log(`📡 Testando Scraper Direto para ${target.name}...`);
    const news = await fetchTerraDirect(target);
    results[target.name] = {
      status: news.length > 0 ? "OK" : "EMPTY",
      count: news.length,
      sample: news.slice(0, 2)
    };
  }
  console.log("\n--- RESULTADO SCRAPER DIRETO (FALLBACK) ---");
  console.log(JSON.stringify(results, null, 2));
}

runTest();
