import { generateImages } from "./src/lib/renderer.js";
import fs from "fs";
import path from "path";

const dummyContent = {
    category: "ANÁLISE",
    headline: "ORÁCULO 2025: TESTE DE ALTA FIDELIDADE",
    summary: "Este é um post de teste para validar a renderização de todos os layouts disponíveis no Design System dinâmico.",
    caption: "Teste de sistema.",
    hashtags: ["#teste", "#oraculo"],
    shouldCreateStory: false
};

const bgUrl = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1080&h=1350";

async function testAll() {
    console.log("🚀 Iniciando renderização de todos os layouts...");
    const design = JSON.parse(fs.readFileSync("./src/lib/design-system.json", "utf-8"));
    const layouts = Object.keys(design.feedLayouts);

    for (const id of layouts) {
        console.log(`📸 Renderizando Layout ${id}...`);
        try {
            const result = await generateImages(dummyContent, bgUrl, "Brasil", Number(id));
            console.log(`✅ Layout ${id} concluído: ${result.feedPath}`);
        } catch (e: any) {
            console.error(`❌ Erro no Layout ${id}: ${e.message}`);
        }
    }
    console.log("🏁 Todos os testes concluídos!");
}

testAll();
