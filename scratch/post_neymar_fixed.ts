import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { generateImages } from "../src/lib/renderer";
import { postToInstagram } from "../src/lib/instagram";
import { logAudit } from "../src/lib/audit";
import fs from "fs";
import path from "path";

async function postNeymarFixed() {
  console.log("🚀 Iniciando publicação do post corrigido do Neymar...");

  const processed = {
    headline: "NEYMAR NA COPA DO MUNDO DE 2026!",
    summary: "Carlo Ancelotti oficializa Neymar na Seleção Brasileira. Craque do Santos retorna após quase 3 anos.",
    caption: `A espera acabou! Nesta segunda-feira (18), diretamente do Museu do Amanhã, no Rio de Janeiro, o técnico Carlo Ancelotti foi contundente ao divulgar a lista dos 26 convocados: Neymar está oficialmente de volta à Seleção Brasileira para a disputa da Copa do Mundo de 2026.

O craque do Santos retorna ao esquadrão nacional após quase três anos de ausência, deixando para trás o fantasma da grave lesão sofrida nas Eliminatórias em outubro de 2023. Nas últimas semanas, a pedido da própria CBF, o camisa 10 passou por exames de imagem preventivos rigorosos, os quais comprovaram suas totais condições físicas para liderar o grupo do treinador italiano rumo ao hexa.

O calendário detalhado até o torneio já está confirmado. O Brasil fará sua estreia no Mundial diante do Marrocos, no dia 13 de junho, em Nova Jersey (EUA). Como testes finais de preparação, a Seleção Brasileira entrará em campo para dois amistosos cruciais: encara o Panamá no dia 31 de maio, diante da torcida no Maracanã, e enfrenta o Egito no dia 6 de junho, em Cleveland.

O maior artilheiro da história da Seleção Brasileira tem a sua chance derradeira no maior palco do futebol mundial. Qual a sua leitura sobre a decisão de Ancelotti? Neymar ainda é a principal arma tática do Brasil? Deixe sua opinião!`,
    hashtags: ["Neymar", "CopaDoMundo2026", "SelecaoBrasileira", "CarloAncelotti", "SantosFC", "OraculoDaBola", "Futebol"],
    category: "URGENTE",
    mainTeam: "Santos",
    isFocusedOnSingleTeam: true,
    shouldCreateStory: true,
    imageKeywords: "Neymar Selecao Santos"
  };

  const imageUrl = "https://p2.trrsf.com/image/fget/cf/1200/630/middle/images.terra.com/2026/05/18/1516372065-brazil-v-bolivia-fifa-world-cup-2026-qualifier-2048x1366.jpg";

  try {
    // 1. Gerar Imagens (usando Layout 5 para fidelidade)
    console.log("🎨 Gerando imagem de feed com Layout 5...");
    const paths = await generateImages(processed, imageUrl, "Santos", 5);
    console.log("✅ Imagem de feed gerada:", paths.feedPath);

    // 2. Publicar no Instagram
    console.log("📤 Publicando no Instagram...");
    const formattedHashtags = processed.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    
    const postCaption = `${processed.caption}\n\n${formattedHashtags}`;
    const mediaId = await postToInstagram(paths.feedPath, postCaption);
    console.log("🎉 Postado no Instagram com sucesso! ID:", mediaId);

    // 3. Atualizar histórico (remover entrada anterior se necessário para manter limpo, mas como é o mesmo ID "neymar-convocacao-2026", o histórico já está com ela e apenas garantimos que está registrado)
    const HISTORY_FILE = path.join(process.cwd(), "src", "history.json");
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      } catch (e) {
        history = [];
      }
    }
    
    // Evita duplicados com o mesmo id
    history = history.filter((h: any) => h.id !== "neymar-convocacao-2026");
    history.push({
      id: "neymar-convocacao-2026",
      title: "NEYMAR DE VOLTA: CARLO ANCELOTTI CONVOCA CRAQUE DO SANTOS PARA A COPA DO MUNDO",
      date: new Date().toISOString()
    });
    if (history.length > 500) history = history.slice(-500);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log("💾 Histórico atualizado.");

    // 4. Registrar auditoria
    logAudit({
      headline: processed.headline,
      source_url: "https://www.terra.com.br/esportes/brasil/vai-ser-convocado-neymar-faz-exame-a-pedido-da-cbf,0b49d3633a3988e78668ea3170e98b91ialsc073.html",
      source_domain: "www.terra.com.br",
      category: "Santos",
      status: "SUCCESS"
    });
    console.log("📊 Auditoria registrada.");

    // 5. Atualizar arquivos de estado auxiliares
    const LAST_CATEGORY_FILE = path.join(process.cwd(), "src", "last_category.txt");
    const LAST_POST_FILE = path.join(process.cwd(), "src", "last_post.json");
    fs.writeFileSync(LAST_CATEGORY_FILE, "Santos");
    fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ timestamp: new Date().toISOString() }));
    console.log("⚙️ Arquivos de estado auxiliar atualizados.");

  } catch (error: any) {
    console.error("❌ Falha crítica ao postar:", error.message);
  }
}

postNeymarFixed();
