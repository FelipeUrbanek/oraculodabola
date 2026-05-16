import { generateImages } from "../src/lib/renderer";
import { processNewsWithGemini } from "../src/lib/gemini";
import { fetchRSSHubTerra, resolveAndScrapeImage } from "../src/lib/news";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

async function testAllLayouts() {
    console.log("🎨 Iniciando Teste Visual Dinâmico com notícias de HOJE...");
    
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    
    try {
        const target = { name: "Santos", terra: "https://www.terra.com.br/esportes/santos/" };
        const news = await fetchRSSHubTerra(target, browser);
        
        if (news.length === 0) {
            console.error("❌ Nenhuma notícia de hoje encontrada.");
            return;
        }

        // Pegar a primeira notícia que não seja sobre Sub-20 ou Feminino (já filtrado pelo isAllowedTopic no news.ts se eu usasse fetchFootballNews, mas aqui pegamos direto)
        // Vamos usar a lógica de processamento real
        let content: any = null;
        let selectedItem: any = null;
        let scrapedInfo: any = null;

        for (let i = 0; i < Math.min(news.length, 8); i++) {
            selectedItem = news[i];
            console.log(`🧐 Analisando notícia [${i+1}/8]: ${selectedItem.title}`);
            scrapedInfo = await resolveAndScrapeImage(selectedItem.link, browser);
            content = await processNewsWithGemini(selectedItem.title, scrapedInfo.fullSnippet || "", "Santos");
            
            if (!content.headline.toUpperCase().includes("REJEITADO")) {
                console.log("✅ Notícia real de hoje aprovada para o teste visual!");
                break;
            }
            console.log(`⚠️ Rejeitada pelo filtro: ${content.caption}`);
            content = null;
        }

        if (!content) {
            console.error("❌ Nenhuma notícia de elite válida encontrada hoje para o teste.");
            return;
        }

        const layouts = [1, 2, 3, 4, 5];
        const outputDir = path.join(process.cwd(), "test_results_layouts");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        for (const layoutId of layouts) {
            console.log(`\n🖼️ Renderizando Layout [${layoutId}] com notícia real...`);
            try {
                const { feedPath } = await generateImages(content, scrapedInfo.imageUrl || selectedItem.imageUrl || null, "Santos", layoutId);
                const dest = path.join(outputDir, `layout_${layoutId}.jpg`);
                fs.copyFileSync(feedPath, dest);
                console.log(`✅ Gerado: ${dest}`);
            } catch (e: any) {
                console.error(`❌ Erro no Layout ${layoutId}:`, e.message);
            }
        }

    } catch (error) {
        console.error("❌ Erro no teste dinâmico:", error);
    } finally {
        await browser.close();
        console.log("\n🚀 Todos os layouts foram gerados na pasta 'test_results_layouts'!");
    }
}

testAllLayouts();
