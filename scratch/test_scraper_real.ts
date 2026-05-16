import { resolveAndScrapeImage } from "../src/lib/news";
import puppeteer from "puppeteer";

async function testScraper() {
  const url = "https://www.terra.com.br/esportes/flamengo/athletico-x-flamengo-onde-assistir-escalacoes-e-arbitragem,a34a85cb6d6939247526a1cadbcdd054yv80ofaa.html";
  
  console.log("🔍 Testando captura de imagem e data...");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  
  try {
    const result = await resolveAndScrapeImage(url, browser);
    console.log("✅ Resultado:", JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error("❌ Erro:", e.message);
  } finally {
    await browser.close();
  }
}

testScraper();
