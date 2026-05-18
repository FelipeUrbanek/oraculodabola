import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { processNewsWithGemini } from "../src/lib/gemini";
import { generateImages } from "../src/lib/renderer";
import { postToInstagram } from "../src/lib/instagram";
import { logAudit } from "../src/lib/audit";
import fs from "fs";
import path from "path";

async function postNeymar() {
  console.log("🚀 Iniciando processamento do post da convocação do Neymar...");

  const title = "NEYMAR DE VOLTA: CARLO ANCELOTTI CONVOCA CRAQUE DO SANTOS PARA A COPA DO MUNDO";
  const snippet = "O técnico Carlo Ancelotti anunciou nesta segunda-feira (18 de maio de 2026) a lista oficial dos 26 convocados da Seleção Brasileira para a Copa do Mundo de 2026. A principal novidade e grande destaque da lista é o retorno do atacante Neymar, atualmente no Santos, convocado após quase três anos de ausência (desde outubro de 2023, devido a uma grave lesão sofrida nas Eliminatórias). A Seleção Brasileira estreia no dia 13 de junho contra o Marrocos, em Nova Jersey (EUA). Antes do Mundial, o Brasil fará amistosos contra o Panamá (31 de maio, no Maracanã) e Egito (6 de junho, em Cleveland).";

  try {
    // 1. Processar com Gemini
    // Nota: passamos "Santos" como o terceiro parâmetro para que a IA foque no time principal do jogador (Santos)
    const processed = await processNewsWithGemini(title, snippet, "Santos");
    console.log("🔮 Manchete gerada pelo Gemini:", processed.headline);
    console.log("📝 Legenda gerada pelo Gemini:\n", processed.caption);

    // 2. Definir a imagem de fundo. Usamos uma imagem de alta qualidade de futebol/estádio.
    const imageUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080&h=1350";

    // 3. Gerar Imagem
    console.log("🎨 Gerando imagem de feed...");
    const paths = await generateImages(processed, imageUrl, "Santos");
    console.log("✅ Imagem de feed gerada:", paths.feedPath);

    // 4. Publicar no Instagram
    console.log("📤 Publicando no Instagram...");
    const formattedHashtags = processed.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    
    const postCaption = `${processed.caption}\n\n${formattedHashtags}`;
    const mediaId = await postToInstagram(paths.feedPath, postCaption);
    console.log("🎉 Postado no Instagram com sucesso! ID:", mediaId);

    // 5. Salvar no histórico
    const HISTORY_FILE = path.join(process.cwd(), "src", "history.json");
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      } catch (e) {
        history = [];
      }
    }
    history.push({
      id: "neymar-convocacao-2026",
      title: title,
      date: new Date().toISOString()
    });
    if (history.length > 500) history = history.slice(-500);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log("💾 Histórico atualizado.");

    // 6. Registrar auditoria
    logAudit({
      headline: processed.headline,
      source_url: "https://www.terra.com.br/esportes/brasil/vai-ser-convocado-neymar-faz-exame-a-pedido-da-cbf,0b49d3633a3988e78668ea3170e98b91ialsc073.html",
      source_domain: "www.terra.com.br",
      category: "Santos",
      status: "SUCCESS"
    });
    console.log("📊 Auditoria registrada.");

    // 7. Atualizar arquivos auxiliares de status
    const LAST_CATEGORY_FILE = path.join(process.cwd(), "src", "last_category.txt");
    const LAST_POST_FILE = path.join(process.cwd(), "src", "last_post.json");
    fs.writeFileSync(LAST_CATEGORY_FILE, "Santos");
    fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ timestamp: new Date().toISOString() }));
    console.log("⚙️ Arquivos de estado auxiliar atualizados.");

  } catch (error: any) {
    console.error("❌ Falha crítica ao postar:", error.message);
  }
}

postNeymar();
