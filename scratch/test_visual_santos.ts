import { generateImages } from "../src/lib/renderer";
import { ProcessedContent } from "../src/lib/gemini";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function testVisual() {
    const content: ProcessedContent = {
        headline: "SANTOS PREPARA RENOVAÇÃO DE CONTRATO COM JOÃO PAULO",
        summary: "O Peixe iniciou conversas com o goleiro João Paulo para estender seu vínculo com o clube da Vila Belmiro até o final de 2028, com reajuste salarial e bônus por metas atingidas no Brasileirão.",
        caption: "...",
        hashtags: [],
        category: "MERCADO",
        mainTeam: "Santos",
        isFocusedOnSingleTeam: true,
        shouldCreateStory: false,
        imageKeywords: "Santos FC João Paulo"
    };
    
    console.log("🎨 Testando renderização com headline longo...");
    // Forçamos o Layout 2
    const { feedPath } = await generateImages(content, "https://images.unsplash.com/photo-1574629810360-7efbbe195018", "Santos", 2);
    console.log(`✅ Imagem gerada: ${feedPath}`);
}

testVisual();
