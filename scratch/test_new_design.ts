import { generateImages } from '../src/lib/renderer.js';
import { ProcessedContent } from '../src/lib/gemini.js';
import fs from 'fs';
import path from 'path';

async function test() {
  const content: ProcessedContent = {
    headline: "TESTE DE ESCUDO: FORTALEZA",
    summary: "Verificando se o escudo do Leão aparece no canto esquerdo e a logo no direito.",
    caption: "Teste de design premium.",
    hashtags: ["fortaleza", "teste"],
    category: "URGENTE",
    shouldCreateStory: false,
    imageKeywords: "soccer stadium"
  };

  console.log("🎨 Gerando imagem de teste com escudo do Fortaleza...");
  try {
    const { feedPath } = await generateImages(content, null, "Fortaleza");
    console.log(`✅ Imagem gerada em: ${feedPath}`);
    // O usuário poderá ver a imagem se eu informar o caminho
  } catch (e) {
    console.error("Erro no teste de render:", e);
  }
}

test();
