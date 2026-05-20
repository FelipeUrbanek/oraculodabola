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
  const isScheduled = process.env.IS_SCHEDULED === "true";
  let currentWindow: "morning" | "midday" | "evening" | "night" | null = null;
  let brtDayString = "";

  if (isScheduled) {
    const now = new Date();
    // Converter para Hora de Brasília (UTC-3)
    const brtDate = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const brtHour = brtDate.getUTCHours();
    const brtMinute = brtDate.getUTCMinutes();
    brtDayString = brtDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (brtHour === 9 || (brtHour === 10 && brtMinute <= 30)) {
      currentWindow = "morning";
    } else if (brtHour === 12 || (brtHour === 13 && brtMinute <= 30)) {
      currentWindow = "midday";
    } else if (brtHour === 18 || (brtHour === 19 && brtMinute <= 30)) {
      currentWindow = "evening";
    } else if (brtHour === 21 || (brtHour === 22 && brtMinute <= 30)) {
      currentWindow = "night";
    }

    if (!currentWindow) {
      console.log(`⏱️ Fora das janelas de postagem do Brasil (Hora BRT atual: ${brtHour.toString().padStart(2, '0')}:${brtMinute.toString().padStart(2, '0')}). Encerrando.`);
      process.exit(0);
    }

    const WINDOWS_STATE_FILE = path.join(process.cwd(), "src", "last_posted_windows.json");
    let postedWindows: Record<string, Record<string, boolean>> = {};
    if (fs.existsSync(WINDOWS_STATE_FILE)) {
      try {
        postedWindows = JSON.parse(fs.readFileSync(WINDOWS_STATE_FILE, "utf-8"));
      } catch (e) {
        postedWindows = {};
      }
    }

    if (postedWindows[brtDayString]?.[currentWindow]) {
      console.log(`✅ Já foi feita uma postagem para a janela '${currentWindow}' no dia ${brtDayString}. Encerrando.`);
      process.exit(0);
    }

    console.log(`⏱️ Executando postagem para a janela '${currentWindow}' (Hora BRT atual: ${brtHour.toString().padStart(2, '0')}:${brtMinute.toString().padStart(2, '0')}).`);
  }

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

  console.log("🚀 Iniciando Validação de Ambiente...");
  try {
    const { execSync } = await import("child_process");
    execSync("pnpx tsx validate-setup.ts", { stdio: "inherit", cwd: process.cwd() });
  } catch (e) {
    console.error("🛑 Abortando: Ambiente inválido ou instável.");
    process.exit(1);
  }

  console.log("🔮 O Oráculo está despertando...");

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
  let newsList = await fetchFootballNews([], postedIds, 4);

  let hasValidImage = newsList.some((item: any) => item.imageUrl && item.imageUrl.startsWith("http"));
  if (!hasValidImage) {
    console.log("⚠️ Nenhuma notícia de futebol com imagem válida nas últimas 4 horas. Buscando últimas 24 horas...");
    newsList = await fetchFootballNews([], postedIds, 24);
    hasValidImage = newsList.some((item: any) => item.imageUrl && item.imageUrl.startsWith("http"));

    if (!hasValidImage) {
      console.log("⚠️ Nenhuma notícia de futebol com imagem válida nas últimas 24 horas. Expandindo busca para as últimas 48 horas...");
      newsList = await fetchFootballNews([], postedIds, 48);
    }
  }

  // Regra da Copa 2026:
  // - A Copa do Mundo de 2026 começa em 11 de Junho de 2026.
  // - Período de alta prioridade começa 3 dias antes (8 de Junho de 2026).
  // - Antes de 8 de Junho de 2026, limitamos a no máximo 1 notícia de Copa por dia.
  const priorityStart = new Date("2026-06-08T00:00:00Z").getTime();
  const isPriorityPeriod = Date.now() >= priorityStart;
  
  if (!isPriorityPeriod) {
    const hasPostedCopaInLast24h = history.some(h => {
      const diffHours = (Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) return false;
      const isCopaCat = h.category === "Copa 2026";
      const isCopaUrl = typeof h.id === "string" && (h.id.includes("copa-2026") || h.id.includes("copa-do-mundo"));
      return isCopaCat || isCopaUrl;
    });

    if (hasPostedCopaInLast24h) {
      const rawCount = newsList.length;
      newsList = newsList.filter((item: any) => item.category !== "Copa 2026");
      const filteredCount = rawCount - newsList.length;
      if (filteredCount > 0) {
        console.log(`⏳ [REGRA DA COPA] Filtradas ${filteredCount} notícias de 'Copa 2026' (Limite de 1 por dia ativo antes de 08/06/2026).`);
      }
    }
  }

  runReport.candidatesFound = newsList.length;
  const LAST_CATEGORY_FILE = path.join(
    process.cwd(),
    "src",
    "last_category.txt",
  );
  let lastCategory = fs.existsSync(LAST_CATEGORY_FILE)
    ? fs.readFileSync(LAST_CATEGORY_FILE, "utf-8").trim()
    : "";

  // 1. Filtrar por categorias básicas e rodízio de forma inteligente
  const uniqueCategories = new Set(newsList.map((item: any) => item.category));
  const isRodízioEnabled = uniqueCategories.size > 1;

  // Extrator de palavras-chave de assunto para evitar posts repetidos sobre a mesma pessoa/tema
  const getSubjectKeywords = (title: string): string[] => {
    const stopWords = new Set([
      "santos", "peixe", "alvinegro", "vila", "belmiro", "brasileirão", "série", "copa", "libertadores",
      "futebol", "jogo", "partida", "treino", "contratação", "reforço", "venda", "mercado", "bola",
      "escalação", "lesão", "desfalque", "vitória", "derrota", "empate", "clássico", "torcida", "estádio"
    ]);
    return title
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/)
      .filter(word => word.length >= 4 && !stopWords.has(word));
  };

  const recentHistoryForRepetition = history.slice(-6); // Aumentado para 6 posts para evitar repetição geral de assuntos
  const recentHistoryForNeymar = history.slice(-10);     // Aumentado para 10 posts para garantir espaçamento estrito para o Neymar

  let candidates = newsList.filter((item: any) => {
    const hasImage = !!item.imageUrl && item.imageUrl.startsWith("http");
    const isDifferentCategory = !isRodízioEnabled || item.category !== lastCategory;
    const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
    const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));

    // Bloqueio de repetição consecutiva de assunto/pessoa (ex: "Carille", "Teixeira", etc.)
    const itemKeywords = getSubjectKeywords(item.title);
    const isRepeatedSubject = recentHistoryForRepetition.some(h => {
      if (!h.title) return false;
      const historyKeywords = getSubjectKeywords(h.title);
      return itemKeywords.some(keyword => historyKeywords.includes(keyword));
    });

    // Bloqueio estrito de Neymar se já falamos dele nos últimos 10 posts
    const isNeymarNews = item.title.toLowerCase().includes("neymar");
    const hasRecentNeymar = recentHistoryForNeymar.some(h => h.title && h.title.toLowerCase().includes("neymar"));
    const isBlockedNeymar = isNeymarNews && hasRecentNeymar;

    return hasImage && !isServiceNews && isDifferentCategory && !isRepeatedSubject && !isBlockedNeymar;
  });

  // Se o filtro estrito de assunto resultar em 0 candidatos, relaxamos a de-duplicação de assunto
  if (candidates.length === 0) {
    console.log("🔄 Poucos candidatos após filtro de assunto/categoria. Relaxando de-duplicação de temas recentes...");
    candidates = newsList.filter((item: any) => {
      const hasImage = !!item.imageUrl && item.imageUrl.startsWith("http");
      const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
      const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));

      // Mantém apenas o bloqueio estrito do Neymar recente
      const isNeymarNews = item.title.toLowerCase().includes("neymar");
      const hasRecentNeymar = recentHistoryForNeymar.some(h => h.title && h.title.toLowerCase().includes("neymar"));
      const isBlockedNeymar = isNeymarNews && hasRecentNeymar;

      return hasImage && !isServiceNews && !isBlockedNeymar;
    });
  }

  // Se ainda for 0 (caso extremo), relaxamos tudo para garantir postagem, mas NUNCA postamos Neymar repetido
  if (candidates.length === 0) {
    console.log("🔄 Rodízio de categorias e filtros totalmente relaxados para garantir postagem (Mantendo trava estrita do Neymar)...");
    candidates = newsList.filter((item: any) => {
      const hasImage = !!item.imageUrl && item.imageUrl.startsWith("http");
      const forbidden = ["onde assistir", "ao vivo", "transmissão", "tempo real", "como assistir", "escalação", "palpite"];
      const isServiceNews = forbidden.some((word) => item.title.toLowerCase().includes(word));

      // Mantém apenas o bloqueio estrito do Neymar recente
      const isNeymarNews = item.title.toLowerCase().includes("neymar");
      const hasRecentNeymar = recentHistoryForNeymar.some(h => h.title && h.title.toLowerCase().includes("neymar"));
      const isBlockedNeymar = isNeymarNews && hasRecentNeymar;

      return hasImage && !isServiceNews && !isBlockedNeymar;
    });
  }

  if (candidates.length === 0) {
    console.log(`⚠️ Nenhuma notícia com imagem de background válida (OG Image) encontrada para postar. Encerrando execução.`);
    return;
  }

  const uniqueItems = candidates;

  // 2. DE-DUPLICAÇÃO SEMÂNTICA (Evitar vários posts sobre o mesmo tema)
  console.log("🧠 Verificando duplicidade de temas com Gemini...");
  const recentHistoryTitles = history
    .filter(
      (h) =>
        h.title &&
        Date.now() - new Date(h.date).getTime() < 96 * 60 * 60 * 1000,
    )
    .map((h) => h.title!);

  const validIndices = await filterDuplicateThemes(
    uniqueItems,
    recentHistoryTitles,
  );
  let newItems = validIndices.map((i) => uniqueItems[i]);

  if (newItems.length === 0) {
    console.log("💤 Nenhuma notícia inédita disponível após todos os filtros. Encerrando execução para evitar posts repetidos.");
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
  let postsToMake = 1; // Sempre limitar a exatamente 1 post por rodada para comportamento 100% orgânico e evitar shadowban

  console.log(
    `⏱️ Último post há ${hoursSinceLastPost.toFixed(1)}h. Planejando ${postsToMake} post(s).`,
  );
  runReport.postsPlanned = postsToMake;

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

      if (processed.headline.toUpperCase().includes("REJEITADO")) {
        throw new Error(processed.caption || "Conteúdo rejeitado pelo filtro editorial.");
      }

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
        category: item.category,
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
        source_domain: (item.link && item.link.startsWith("http")) ? new URL(item.link).hostname : "backup_news",
        category: item.category,
        status: "SUCCESS",
      });

      console.log(
        `✅ Postagem confirmada [${item.category}]: ${processed.headline}`,
      );
      successfulPosts++;

      // Se postou com sucesso, marcar a janela como postada se for agendado
      if (isScheduled && currentWindow) {
        const WINDOWS_STATE_FILE = path.join(process.cwd(), "src", "last_posted_windows.json");
        let postedWindows: Record<string, Record<string, boolean>> = {};
        if (fs.existsSync(WINDOWS_STATE_FILE)) {
          try {
            postedWindows = JSON.parse(fs.readFileSync(WINDOWS_STATE_FILE, "utf-8"));
          } catch (e) {}
        }
        if (!postedWindows[brtDayString]) postedWindows[brtDayString] = {};
        postedWindows[brtDayString][currentWindow] = true;
        
        // Limpar chaves antigas (> 7 dias) do state file para manter limpo
        const keys = Object.keys(postedWindows);
        if (keys.length > 7) {
          keys.sort();
          while (keys.length > 7) {
            const oldKey = keys.shift();
            if (oldKey) delete postedWindows[oldKey];
          }
        }
        fs.writeFileSync(WINDOWS_STATE_FILE, JSON.stringify(postedWindows, null, 2));
        console.log(`💾 Janela '${currentWindow}' marcada como postada no dia ${brtDayString}.`);
      }
      runReport.successfulPosts.push({
        category: item.category,
        headline: processed.headline,
        source_url: item.link
      });

      if (successfulPosts < postsToMake) {
        console.log("⏳ Aguardando 30 segundos para a próxima postagem...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    } catch (error: any) {
      console.error(`❌ Erro no processamento:`, error.message);
      runReport.failedPosts.push({
        category: item.category,
        title: item.title,
        error: error.message
      });
      logAudit({
        headline: item.title,
        source_url: item.link,
        source_domain: (item.link && item.link.startsWith("http")) ? new URL(item.link).hostname : "backup_news",
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

  runReport.status = "COMPLETED";
  const runFile = path.join(RUNS_DIR, `run_${new Date().getTime()}.json`);
  fs.writeFileSync(runFile, JSON.stringify(runReport, null, 2));
  fs.writeFileSync(path.join(RUNS_DIR, "latest_run.json"), JSON.stringify(runReport, null, 2));

  process.exit(0);
}

runOráculo();
