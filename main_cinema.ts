import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Override dinâmico de credenciais caso haja chaves exclusivas de Cinema no .env.local
if (process.env.IG_USER_ID_CINEMA) {
  process.env.IG_USER_ID = process.env.IG_USER_ID_CINEMA;
}
if (process.env.FB_ACCESS_TOKEN_CINEMA) {
  process.env.FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN_CINEMA;
}

import { fetchCinemaNews } from "./src/lib/news";
import {
  processCinemaNewsWithGemini,
  rankBestCinemaNews,
  filterDuplicateThemes,
} from "./src/lib/gemini";
import { generateImages } from "./src/lib/renderer";
import { archiveOldPosts } from "./src/lib/archiver";
import { postToInstagram } from "./src/lib/instagram";
import { logAudit } from "./src/lib/audit";
import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "src", "history_cinema.json");

async function runOráculoCinema() {
  const runReport: any = {
    timestamp: new Date().toISOString(),
    status: "STARTED",
    postsPlanned: 0,
    candidatesFound: 0,
    successfulPosts: [],
    failedPosts: []
  };
  const RUNS_DIR = path.join(process.cwd(), "src", "runs");
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  console.log("🚀 Iniciando Validação de Ambiente para Cinema...");
  try {
    const { execSync } = await import("child_process");
    execSync("pnpx tsx validate-setup.ts", { stdio: "inherit", cwd: process.cwd() });
  } catch (e) {
    console.error("🛑 Abortando: Ambiente de cinema inválido ou instável.");
    process.exit(1);
  }

  console.log("🔮 O Espectador Comum está despertando...");

  let history: { id: string; title?: string; date: string; category?: string }[] = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      history = parsed.map((item: any) =>
        typeof item === "string"
          ? { id: item, date: new Date(0).toISOString() }
          : item,
      );
    } catch (e) {
      history = [];
    }
  }

  const postedIds = history.map((h) => h.id);

  console.log("⏱️ Buscando notícias estritamente das últimas 4 horas...");
  let newsList = await fetchCinemaNews(postedIds, 4);
  let candidatesCount = newsList.filter(n => n.imageUrl).length;
  
  if (candidatesCount < 3) {
    console.log(`⚠️ Poucas notícias nas últimas 4 horas (${candidatesCount} com imagem). Buscando últimas 24 horas...`);
    newsList = await fetchCinemaNews(postedIds, 24);
    candidatesCount = newsList.filter(n => n.imageUrl).length;
    
    if (candidatesCount < 3) {
      console.log(`⚠️ Ainda insuficiente nas últimas 24 horas (${candidatesCount} com imagem). Expandindo busca para as últimas 48 horas...`);
      newsList = await fetchCinemaNews(postedIds, 48);
      candidatesCount = newsList.filter(n => n.imageUrl).length;
      
      if (candidatesCount === 0) {
        console.log(`⚠️ Ainda insuficiente nas últimas 48 horas. Expandindo busca para as últimas 120 horas (5 dias)...`);
        newsList = await fetchCinemaNews(postedIds, 120);
      }
    }
  }

  runReport.candidatesFound = newsList.length;
  const LAST_CATEGORY_FILE = path.join(
    process.cwd(),
    "src",
    "last_category_cinema.txt",
  );
  let lastCategory = fs.existsSync(LAST_CATEGORY_FILE)
    ? fs.readFileSync(LAST_CATEGORY_FILE, "utf-8").trim()
    : "";

  // 1. Filtrar candidatos com imagens válidas e sem termos de serviço
  let candidates = newsList.filter((item: any) => {
    const hasImage = !!item.imageUrl && item.imageUrl.startsWith("http");
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));
    return hasImage && !isServiceNews;
  });

  // 2. DE-DUPLICAÇÃO SEMÂNTICA (Verificação estendida para 4 dias)
  console.log("🧠 Verificando duplicidade de temas com Gemini...");
  const recentHistoryTitles = history
    .filter(
      (h) =>
        h.title &&
        Date.now() - new Date(h.date).getTime() < 96 * 60 * 60 * 1000,
    )
    .map((h) => h.title!);

  let newItems: any[] = [];
  if (candidates.length > 0) {
    try {
      const validIndices = await filterDuplicateThemes(
        candidates,
        recentHistoryTitles,
      );
      newItems = validIndices.map((i) => candidates[i]);
    } catch (e) {
      console.warn("⚠️ Falha na de-duplicação semântica. Usando candidatos brutos.");
      newItems = candidates;
    }
  }

  if (newItems.length === 0 && candidates.length > 0) {
    console.log("♻️ Todas as novidades eram temas repetidos. Usando candidatos disponíveis.");
    newItems = candidates;
  }

  // Ordena para garantir que pegamos sempre a notícia mais jovem (recente) com imagem
  newItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Seleciona a notícia mais jovem disponível (de séries ou filmes misturados)
  let selectedItem: any = newItems[0] || null;

  // Se não houver nenhum candidato em newItems, mesclar com backup de cinema correspondente à categoria desejada
  if (!selectedItem) {
    console.log("⚠️ Nenhuma novidade disponível nos canais de notícia. Usando backup cinemático qualificado...");
    const nextIsSeries = lastCategory !== "Séries";
    const BACKUP_TRENDING_NEWS = [
      {
        title: "Gladiador II: Ridley Scott entrega sequência histórica e avassaladora",
        contentSnippet: "Ridley Scott retorna ao Coliseu com Paul Mescal e Denzel Washington em um espetáculo épico de ação e traição que já desponta para o Oscar.",
        category: "Crítica",
        imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1080&auto=format&fit=crop&q=80"
      },
      {
        title: "House of the Dragon: Terceira temporada inicia gravações no Reino Unido",
        contentSnippet: "HBO confirma o início das filmagens del próximo ano del spin-off de Game of Thrones, com foco na sangrenta Dança dos Dragões e novas alianças.",
        category: "Séries",
        imageUrl: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=1080&auto=format&fit=crop&q=80"
      },
      {
        title: "Duna: Parte 3 é confirmado oficialmente por Denis Villeneuve",
        contentSnippet: "A Legendary Pictures deu sinal verde para a adaptação do livro O Messias de Duna, que encerrará a aclamada trilogia de ficção científica nos cinemas.",
        category: "Filmes",
        imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&auto=format&fit=crop&q=80"
      },
      {
        title: "Superman: James Gunn revela primeiro visual oficial de David Corenswet",
        contentSnippet: "Novo uniforme do Homem de Aço traz referências clássicas dos quadrinhos e abre oficialmente o novo universo cinematográfico compartilhado da DC.",
        category: "Bastidores",
        imageUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1080&auto=format&fit=crop&q=80"
      },
      {
        title: "Stranger Things: Quinta e última temporada promete desfecho épico",
        contentSnippet: "Os criadores revelaram detalhes das filmagens finais que encerrarão a saga de Hawkins na Netflix com episódios com duração de longa-metragem.",
        category: "Séries",
        imageUrl: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=1080&auto=format&fit=crop&q=80"
      },
      {
        title: "O Diabo Veste Prada 2: Sequência com Meryl Streep é confirmada",
        contentSnippet: "A Disney deu início ao desenvolvimento da sequência com o retorno de Meryl Streep, Anne Hathaway e Emily Blunt nos bastidores da alta moda.",
        category: "Filmes",
        imageUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080&auto=format&fit=crop&q=80"
      }
    ];

    const targetCategory = nextIsSeries ? "Séries" : "Filmes";
    let backup = BACKUP_TRENDING_NEWS.find(b => {
      const isTarget = targetCategory === "Séries" ? b.category === "Séries" : b.category !== "Séries";
      return isTarget && !recentHistoryTitles.some(h => h.toLowerCase() === b.title.toLowerCase());
    });

    if (!backup) {
      backup = BACKUP_TRENDING_NEWS.find(b => !recentHistoryTitles.some(h => h.toLowerCase() === b.title.toLowerCase()));
    }

    if (backup) {
      selectedItem = {
        ...backup,
        link: `backup_cinema_${Date.now()}`,
        pubDate: new Date().toISOString()
      };
    }
  }

  if (!selectedItem) {
    console.log("💤 Nenhuma notícia ou backup de cinema disponível para postagem neste ciclo.");
    return;
  }

  runReport.postsPlanned = 1;

  // 4. Processamento, Renderização e Publicação Imediata
  let successfulPosts = 0;
  
  console.log(`\n🧐 [1/1] Processando e postando [${selectedItem.category}]: ${selectedItem.title}`);

  try {
    const processed = await processCinemaNewsWithGemini(
      selectedItem.title,
      selectedItem.contentSnippet,
    );

    if (processed.headline.toUpperCase().includes("REJEITADO")) {
      throw new Error(processed.caption || "Conteúdo rejeitado pelo filtro editorial.");
    }

    console.log(`🎨 Renderizando imagem para layout de Cinema...`);
    const selectedLayout = Math.floor(Math.random() * 10) + 1;
    const { feedPath, storyPath } = await generateImages(
      processed,
      selectedItem.imageUrl || null,
      "",
      selectedLayout,
      true
    );

    console.log(`🚀 Publicando post imediato no Instagram...`);
    const response = await postToInstagram(
      feedPath,
      `${processed.caption}\n\n${processed.hashtags.map((h) => `#${h}`).join(" ")}`
    );

    console.log(`✅ Publicado com Sucesso! Post ID: ${response}`);
    successfulPosts++;

    // Registrar no Histórico
    history.push({
      id: selectedItem.id || selectedItem.link,
      title: selectedItem.title,
      category: processed.category,
      date: new Date().toISOString(),
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Registrar a última categoria postada
    fs.writeFileSync(LAST_CATEGORY_FILE, processed.category);

    runReport.successfulPosts.push({
      title: selectedItem.title,
      headline: processed.headline,
      category: processed.category,
      instagramId: response,
      feedPath,
      storyPath
    });

    // Auditoria de Sucesso
    logAudit({
      headline: processed.headline,
      source_url: selectedItem.link || "backup_news",
      source_domain: (selectedItem.link && selectedItem.link.startsWith("http")) ? new URL(selectedItem.link).hostname : "backup_news",
      category: processed.category,
      status: "SUCCESS",
    });

  } catch (e: any) {
    console.error(`❌ Falha no processamento do post de cinema: ${e.message}`);
    runReport.failedPosts.push({
      title: selectedItem.title,
      error: e.message
    });

    // Auditoria de Falha
    logAudit({
      headline: selectedItem.title,
      source_url: selectedItem.link || "backup_news",
      source_domain: (selectedItem.link && selectedItem.link.startsWith("http")) ? new URL(selectedItem.link).hostname : "backup_news",
      category: selectedItem.category,
      status: "FAILED",
      reason: e.message,
    });
  }

  // 5. Arquivamento e Limpeza
  console.log("🧹 Arquivando posts antigos de cinema...");
  await archiveOldPosts();

  runReport.status = successfulPosts > 0 ? "SUCCESS" : "COMPLETED_WITHOUT_POSTS";
  const reportPath = path.join(RUNS_DIR, "latest_cinema_run.json");
  fs.writeFileSync(reportPath, JSON.stringify(runReport, null, 2));
  console.log(`🏁 Execução do Espectador Comum finalizada. Relatório salvo em: ${reportPath}`);
}

runOráculoCinema().catch((e) => {
  console.error("❌ Falha crítica na execução do Espectador Comum:", e);
  process.exit(1);
});
