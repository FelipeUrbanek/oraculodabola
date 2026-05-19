import { resolveAndScrapeImage } from "../src/lib/news";
import puppeteer from "puppeteer";

async function testScraper() {
  const url = "https://www.terra.com.br/esportes/flamengo/athletico-x-flamengo-onde-assistir-escalacoes-e-arbitragem,a34a85cb6d6939247526a1cadbcdd054yv80ofaa.html";
  
  console.log("🔍 Testando captura de imagem e data...");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate(`(() => {
      const getMeta = (name) => {
        const el = document.querySelector('meta[property="' + name + '"]') ||
                   document.querySelector('meta[name="' + name + '"]') ||
                   document.querySelector('[itemprop="' + name + '"]');
        return el ? el.getAttribute("content") : "NOT_FOUND";
      };

      return {
        ogImage: getMeta("og:image"),
        publishDate: getMeta("publish-date"),
        datePublished: getMeta("datePublished")
      };
    })()`);

    console.log("✅ Resultado Direto no Teste:", JSON.stringify(result, null, 2));
    
    const finalResult = await resolveAndScrapeImage(url, browser);
    console.log("✅ Resultado via news.ts:", JSON.stringify(finalResult, null, 2));

  } catch (e: any) {
    console.error("❌ Erro:", e.message);
  } finally {
    await browser.close();
  }
}

testScraper();
