import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { fetchFootballNews } from "./src/lib/news";
import {
  processNewsWithGemini,
  rankBestNews,
  filterDuplicateThemes,
} from "./src/lib/gemini";
import { generateImages } from "./src/lib/renderer";
import { archiveOldPosts } from "./src/lib/archiver";
import { getFollowersCount, postToInstagram } from "./src/lib/instagram";
import { milestones, generateCelebrationImage } from "./src/lib/celebration";
import { logAudit } from "./src/lib/audit";
import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "src", "history.json");

async function runOráculo() {
  console.log("🚀 Iniciando Validação de Ambiente...");
  try {
    const { execSync } = await import("child_process");
    execSync("pnpx tsx validate-setup.ts", { stdio: "inherit", cwd: process.cwd() });
  } catch (e) {
    console.error("🛑 Abortando: Ambiente inválido ou instável.");
    process.exit(1);
  }

  console.log("🔮 O Oráculo está despertando...");

  let history: { id: string; title?: string; date: string }[] = [];
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
  const newsList = await fetchFootballNews([], postedIds);
  const LAST_CATEGORY_FILE = path.join(
    process.cwd(),
    "src",
    "last_category.txt",
  );
  let lastCategory = fs.existsSync(LAST_CATEGORY_FILE)
    ? fs.readFileSync(LAST_CATEGORY_FILE, "utf-8").trim()
    : "";

  // 1. Filtrar por categorias básicas e rodízio
  let candidates = newsList.filter((item: any) => {
    const hasImage = !!item.imageUrl;
    const isDifferentCategory = item.category !== lastCategory;
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));

    return hasImage && !isServiceNews && isDifferentCategory;
  });

  // Se o rodízio falhar (ex: só tem notícia do mesmo time), aceita a melhor nova disponível
  if (candidates.length === 0) {
    console.log("🔄 Rodízio de categorias sem opções novas. Relaxando filtro para garantir postagem...");
    candidates = newsList.filter((item: any) => {
      const hasImage = !!item.imageUrl;
      const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
      const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));
      return hasImage && !isServiceNews;
    });
  }

  if (candidates.length === 0) {
    console.log(`💤 Nenhuma novidade real encontrada após filtrar ${newsList.length} itens.`);
    return;
  }

  const uniqueItems = candidates;

  // 2. DE-DUPLICAÇÃO SEMÂNTICA (Evitar vários posts sobre o mesmo tema)
  console.log("🧠 Verificando duplicidade de temas com Gemini...");
  const recentHistoryTitles = history
    .filter(
      (h) =>
        h.title &&
        Date.now() - new Date(h.date).getTime() < 48 * 60 * 60 * 1000,
    )
    .map((h) => h.title!);

  const validIndices = await filterDuplicateThemes(
    uniqueItems,
    recentHistoryTitles,
  );
  let newItems = validIndices.map((i) => uniqueItems[i]);

  if (newItems.length === 0 && uniqueItems.length > 0) {
    console.log(
      "♻️ Todas as novidades eram temas repetidos. Usando a melhor disponível para garantir postagem.",
    );
    newItems = [uniqueItems[0]];
  }

  if (newItems.length === 0) {
    console.log("💤 Nenhuma notícia disponível após todos os filtros.");
    return;
  }

  // 3. Lógica de Compensação
  const LAST_POST_FILE = path.join(process.cwd(), "src", "last_post.json");
  let lastPostTime = Date.now() - 60 * 60 * 1000;
  if (fs.existsSync(LAST_POST_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LAST_POST_FILE, "utf-8"));
      lastPostTime = new Date(data.timestamp).getTime();
    } catch (e) {
      /* ignore */
    }
  }

  const hoursSinceLastPost = (Date.now() - lastPostTime) / (1000 * 60 * 60);
  let postsToMake = 1;
  if (hoursSinceLastPost > 4) postsToMake = 3;
  else if (hoursSinceLastPost > 2) postsToMake = 2;

  console.log(
    `⏱️ Último post há ${hoursSinceLastPost.toFixed(1)}h. Planejando ${postsToMake} post(s).`,
  );

  // 4. Seleção dos Melhores Itens (Rankeados)
  const finalItems: any[] = [];
  let candidatesPool = [...newItems];

  for (let p = 0; p < Math.min(postsToMake, newItems.length); p++) {
    const bestItem = await rankBestNews(candidatesPool);
    if (bestItem) {
      finalItems.push(bestItem);
      candidatesPool = candidatesPool.filter((c) => c.link !== bestItem.link);
    }
  }

  // 5. Processamento e Postagem
  let successfulPosts = 0;
  let attempts = 0;
  const maxAttempts = candidatesPool.length + finalItems.length;

  while (
    successfulPosts < postsToMake &&
    candidatesPool.length + finalItems.length > 0 &&
    attempts < maxAttempts
  ) {
    attempts++;
    const item = finalItems.shift() || candidatesPool.shift();
    if (!item) break;

    console.log(
      `🧐 [${successfulPosts + 1}/${postsToMake}] Processando [${item.category}]: ${item.title}`,
    );

    try {
      const processed = await processNewsWithGemini(
        item.title,
        item.contentSnippet,
        item.category,
      );
      const paths = await generateImages(processed, item.imageUrl || null, processed.mainTeam || item.category);

      const formattedHashtags = processed.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");

      await postToInstagram(
        paths.feedPath,
        `${processed.caption}\n\n${formattedHashtags}`,
      );

      // Atualizar Histórico (NOVO FORMATO)
      history.push({
        id: item.id || item.link,
        title: item.title,
        date: new Date().toISOString(),
      });
      if (history.length > 500) history = history.slice(-500);

      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
      fs.writeFileSync(LAST_CATEGORY_FILE, item.category);
      fs.writeFileSync(
        LAST_POST_FILE,
        JSON.stringify({ timestamp: new Date().toISOString() }),
      );

      logAudit({
        headline: processed.headline,
        source_url: item.link,
        source_domain: new URL(item.link).hostname,
        category: item.category,
        status: "SUCCESS",
      });

      console.log(
        `✅ Postagem confirmada [${item.category}]: ${processed.headline}`,
      );
      successfulPosts++;

      if (successfulPosts < postsToMake) {
        console.log("⏳ Aguardando 30 segundos para a próxima postagem...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    } catch (error: any) {
      console.error(`❌ Erro no processamento:`, error.message);
      logAudit({
        headline: item.title,
        source_url: item.link,
        source_domain: new URL(item.link).hostname,
        category: item.category,
        status: "REJECTED",
        reason: error.message,
      });
      console.log(`🔄 Tentando buscar uma notícia substituta...`);
    }
  }

  await archiveOldPosts();

  try {
    const followers = await getFollowersCount();
    const { autoReplyToComments } = await import("./src/lib/instagram");

    // Marcos de Seguidores
    const MILESTONES_FILE = path.join(process.cwd(), "src", "milestones.json");
    let milestoneHistory: string[] = fs.existsSync(MILESTONES_FILE)
      ? JSON.parse(fs.readFileSync(MILESTONES_FILE, "utf-8"))
      : [];
    const currentMilestone = milestones.find(
      (m) =>
        parseInt(m.value.replace(".", "")) <= followers &&
        !milestoneHistory.includes(m.value),
    );
    if (currentMilestone) {
      const celebrationPath = await generateCelebrationImage(currentMilestone);
      await postToInstagram(
        celebrationPath,
        `SOMOS ${currentMilestone.value}! ${currentMilestone.sub} #OraculoDaBola`,
      );
      milestoneHistory.push(currentMilestone.value);
      fs.writeFileSync(
        MILESTONES_FILE,
        JSON.stringify(milestoneHistory, null, 2),
      );
    }

    // Engajamento: Responder Comentários (API Oficial)
    await autoReplyToComments();
  } catch (mError) {
    console.error("Erro no engajamento final:", mError);
  }

  process.exit(0);
}

runOráculo();
