import { generateImages } from "../src/lib/renderer";
import { ProcessedContent } from "../src/lib/gemini";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config({ path: ".env.local" });

async function testRender() {
  const content: ProcessedContent = {
    headline: "NEYMAR NA COPA DO MUNDO DE 2026!",
    summary: "Carlo Ancelotti oficializa Neymar na Seleção Brasileira. Craque do Santos retorna após quase 3 anos.",
    caption: "A espera acabou! Neymar está oficialmente de volta à Seleção...",
    hashtags: [],
    category: "URGENTE",
    mainTeam: "Santos",
    isFocusedOnSingleTeam: true,
    shouldCreateStory: true,
    imageKeywords: "Neymar Selecao Santos"
  };

  const imageUrl = "https://p2.trrsf.com/image/fget/cf/1200/630/middle/images.terra.com/2026/05/18/1516372065-brazil-v-bolivia-fifa-world-cup-2026-qualifier-2048x1366.jpg";

  console.log("🎨 Gerando imagem com imagem real do Neymar...");
  // Forçamos o Layout 5 para combinar com o layout do post anterior (ou deixe sortear/forçar)
  const paths = await generateImages(content, imageUrl, "Santos", 5);
  console.log("✅ Imagem gerada com sucesso!");
  console.log(`Feed: ${paths.feedPath}`);
  console.log(`Story: ${paths.storyPath}`);

  if (paths.feedPath && fs.existsSync(paths.feedPath)) {
    const stats = fs.statSync(paths.feedPath);
    console.log(`Feed file size: ${stats.size} bytes`);
  }
}

testRender();
