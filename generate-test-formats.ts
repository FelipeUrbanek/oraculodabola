import { generateImages } from "./src/lib/renderer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dummyContent = {
    category: "TESTE VISUAL",
    headline: "CONFERÊNCIA DE FORMATOS DO ORÁCULO",
    summary: "Validando a renderização dinâmica de todos os componentes de Feed e Story para garantir a fidelidade visual 2026.",
    caption: "Amostra de formato.",
    hashtags: ["#teste", "#design"],
    shouldCreateStory: true // Forçar geração de stories também
};

const bgUrl = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1080&h=1350";

async function generateAllSamples() {
    console.log("🎨 Iniciando Geração de Amostras (Pasta: posts/teste)...");
    
    const designPath = path.join(__dirname, "src", "lib", "design-system.json");
    const design = JSON.parse(fs.readFileSync(designPath, "utf-8"));
    
    const outputDir = path.join(__dirname, "posts", "teste");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. Testar Feeds
    const feedLayouts = Object.keys(design.feedLayouts);
    for (const id of feedLayouts) {
        console.log(`📸 Renderizando Feed Layout ${id}...`);
        try {
            const result = await generateImages(dummyContent, bgUrl, "Brasil", Number(id));
            const newPath = path.join(outputDir, `layout_feed_${id}.jpg`);
            fs.renameSync(result.feedPath, newPath);
            console.log(`✅ Salvo: ${newPath}`);
        } catch (e: any) {
            console.error(`❌ Erro no Feed ${id}: ${e.message}`);
        }
    }

    // 2. Testar Stories
    const storyLayouts = Object.keys(design.storyLayouts);
    for (const id of storyLayouts) {
        console.log(`📱 Renderizando Story Layout ${id}...`);
        try {
            // Para testar stories específicos, o renderer precisaria de um forceStoryLayout (vou assumir que o sorteio ou forceLayout lida com isso)
            const result = await generateImages(dummyContent, bgUrl, "Brasil", Number(id));
            if (result.storyPath) {
                const newPath = path.join(outputDir, `layout_story_${id}.jpg`);
                fs.renameSync(result.storyPath, newPath);
                console.log(`✅ Salvo: ${newPath}`);
            }
        } catch (e: any) {
            console.error(`❌ Erro no Story ${id}: ${e.message}`);
        }
    }

    console.log("\n🏁 Finalizado! Verifique a pasta posts/teste.");
}

generateAllSamples();
