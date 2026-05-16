import { fetchRSSHubTerra, resolveAndScrapeImage } from "../src/lib/news";
import { processNewsWithGemini } from "../src/lib/gemini";
import { generateImages } from "../src/lib/renderer";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runTestSantos() {
  console.log("🐳 Buscando as últimas notícias do Santos via RSSHub...");
  
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  
  try {
    const target = { name: "Santos", terra: "https://www.terra.com.br/esportes/santos/" };
    const news = await fetchRSSHubTerra(target, browser);
    
    if (news.length === 0) {
      console.log("❌ Nenhuma notícia encontrada para o Santos.");
      return;
    }

    const itemsToProcess = news.slice(0, 5);
    console.log(`✅ Encontradas ${news.length} notícias. Processando as top 5...`);

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      console.log(`\n[${i + 1}/5] 📝 Processando: ${item.title}`);
      
      // Scrape full info and image
      const scraped = await resolveAndScrapeImage(item.link, browser);
      
      console.log("🧠 Gerando conteúdo com Gemini...");
      const processed = await processNewsWithGemini(item.title, scraped.fullSnippet || "", "Santos");

      if (processed.headline.toUpperCase().includes("REJEITADO")) {
        console.log(`⚠️ Notícia rejeitada: ${processed.caption}`);
        continue;
      }

      console.log("🎨 Renderizando imagem...");
      const { feedPath } = await generateImages(processed, scraped.imageUrl || item.imageUrl || null, "Santos");
      
      console.log(`📸 Feed gerado: ${feedPath}`);
    }

  } catch (error) {
    console.error("❌ Erro no teste:", error);
  } finally {
    await browser.close();
    console.log("\n🏁 Teste concluído!");
  }
}

runTestSantos();
