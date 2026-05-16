import puppeteer from "puppeteer";
import { ProcessedContent } from "./gemini";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateImages(
  content: ProcessedContent,
  newsImageUrl: string | null,
  teamName: string = "",
  forceLayout?: number,
): Promise<{ feedPath: string; storyPath: string | null }> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    const page = await browser.newPage();


    // 0. Carregar Design System
    const designPath = path.join(__dirname, "design-system.json");
    const design = JSON.parse(fs.readFileSync(designPath, "utf-8"));

    // 1. Carregar escudo do time se disponível E se for focado em um único time
    let teamShieldHtml = "";
    if (content.isFocusedOnSingleTeam) {
      const normalizedTeamName = teamName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/ /g, "_");

      const logoFileName = `${normalizedTeamName}.png`;
      const logosDir = path.resolve(__dirname, "..", "..", "assets", "logos");
      const logoPath = path.join(logosDir, logoFileName);

      if (fs.existsSync(logoPath)) {
        const base64 = fs.readFileSync(logoPath, "base64");
        teamShieldHtml = `<div class="w-16 h-16 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 border-l border-white/10">
          <img src="data:image/png;base64,${base64}" class="w-full h-full object-contain">
        </div>`;
      }
    }

    // 2. Lógica de sorteio de Layout
    const LAST_LAYOUT_PATH = path.join(process.cwd(), "src", "last_layout.json");
    let lastLayouts = { feed: 0, story: 0 };
    if (fs.existsSync(LAST_LAYOUT_PATH)) {
      try { lastLayouts = JSON.parse(fs.readFileSync(LAST_LAYOUT_PATH, "utf-8")); } catch (e) {}
    }

    const availableFeedLayouts = Object.keys(design.feedLayouts).map(Number);
    let feedDiag = forceLayout || availableFeedLayouts.filter(l => l !== lastLayouts.feed)[0] || availableFeedLayouts[0];
    
    const availableStoryLayouts = Object.keys(design.storyLayouts).map(Number);
    let storyDiag = forceLayout || availableStoryLayouts.filter(l => l !== lastLayouts.story)[0] || availableStoryLayouts[0];

    fs.writeFileSync(LAST_LAYOUT_PATH, JSON.stringify({ feed: feedDiag, story: storyDiag }));

    // 3. Preparar Variáveis
    const badgeColor = design.colors[content.category] || "#475569";
    const bgUrl = newsImageUrl && newsImageUrl.includes("http") ? newsImageUrl : `https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1080&h=1350`;

    const officialLogoPath = path.resolve(process.cwd(), "posts", "logo", "logo.svg");
    let logoSvg = '<div class="w-10 h-10 border-2 border-white flex items-center justify-center font-black text-white text-xl bg-black">Ω</div>';
    if (fs.existsSync(officialLogoPath)) {
      logoSvg = fs.readFileSync(officialLogoPath, "utf-8").replace(/width=".*?"/, "").replace(/height=".*?"/, "").replace(/<svg/, '<svg style="width:75%; height:75%;"');
    }

    // 4. Montar Layouts com Substituições
    const replaceVars = (html: string) => {
      return html
        .replace(/{{BADGE_COLOR}}/g, badgeColor)
        .replace(/{{CATEGORY}}/g, content.category)
        .replace(/{{HEADLINE}}/g, content.headline)
        .replace(/{{SUMMARY}}/g, content.summary)
        .replace(/{{HANDLE}}/g, design.branding.handle)
        .replace(/{{LOGO_SVG}}/g, logoSvg)
        .replace(/{{TEAM_SHIELD}}/g, teamShieldHtml);
    };

    const handleTag = replaceVars(design.branding.tagHtml);
    const feedContentHtml = replaceVars(design.feedLayouts[feedDiag] || design.feedLayouts["1"]);
    const storyContentHtml = replaceVars(design.storyLayouts[storyDiag] || design.storyLayouts["1"]);

    // --- RENDER FEED ---
    await page.setViewport({ width: 1080, height: 1350 });
    const feedHtml = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>${design.globalStyles} .background-img { background-image: url('${bgUrl}'); }</style>
        </head>
        <body>
          <div style="width:1080px;height:1350px;" class="relative overflow-hidden bg-black">
            <div class="absolute inset-0 background-img"></div>
            <div class="relative z-10 w-full h-full flex flex-col">
              ${feedContentHtml}
              ${handleTag}
            </div>
          </div>
        </body>
      </html>`;

    // --- RENDER FEED ---
    await page.setViewport({ width: 1080, height: 1350 });
    await page.setContent(feedHtml, { waitUntil: "load", timeout: 60000 });
    await page.evaluateHandle("document.fonts.ready");
    
    // Proteção contra estouro de texto (Auto-resize balanceado v2)
    await page.evaluate(`(() => {
      const headline = document.querySelector('h1');
      const container = headline?.parentElement;
      const summary = container?.querySelector('p');
      
      if (headline && container) {
        let hFontSize = parseFloat(window.getComputedStyle(headline).fontSize);
        let sFontSize = summary ? parseFloat(window.getComputedStyle(summary).fontSize) : 0;
        
        const hasOverflow = () => {
          return container.scrollHeight > container.offsetHeight || 
                 headline.scrollHeight > headline.offsetHeight;
        };

        let attempts = 0;
        while (hasOverflow() && attempts < 40) {
          attempts++;
          // Prioriza manter o título GIGANTE (acima de 110px)
          if (hFontSize > 120) {
            hFontSize -= 2;
            headline.style.fontSize = hFontSize + 'px';
          } 
          // Tenta diminuir o resumo primeiro se o título já estiver num patamar aceitável
          else if (summary && sFontSize > 30) {
            sFontSize -= 1;
            summary.style.fontSize = sFontSize + 'px';
          }
          // Diminui o título até o novo mínimo de 100px (impacto total)
          else if (hFontSize > 100) {
            hFontSize -= 2;
            headline.style.fontSize = hFontSize + 'px';
          }
          // Último recurso: diminui o resumo até o mínimo absoluto
          else if (summary && sFontSize > 22) {
            sFontSize -= 1;
            summary.style.fontSize = sFontSize + 'px';
          }
          else {
            break;
          }
        }
        headline.style.lineHeight = '0.85';
      }
    })()`);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = `${dateStr}-${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")}`;
    const outputDir = path.join(process.cwd(), "posts", dateStr);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const feedPath = path.join(outputDir, `${timeStr}_feed.jpg`);
    await page.screenshot({ path: feedPath, type: "jpeg", quality: 100 });

    // --- RENDER STORY (SOMENTE SE A IA DECIDIR) ---
    let storyPath = null;
    if (content.shouldCreateStory) {
      console.log("📱 Gerando arte para Story...");
      await page.setViewport({ width: 1080, height: 1920 });
      const storyHtml = `
        <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              ${design.globalStyles}
              .background-img { position: absolute; inset: 0; background-image: url('${bgUrl}'); filter: brightness(0.2) blur(10px); }
            </style>
          </head>
          <body>
            <div style="width:1080px;height:1920px;" class="relative overflow-hidden flex flex-col items-center justify-center text-center p-16">
              <div class="absolute inset-0 background-img"></div>
              <div class="absolute inset-0 bg-gradient-to-b from-black/90 via-transparent to-black z-10"></div>
              <div class="relative z-[500] flex flex-col items-center justify-center w-full h-full">
                ${storyContentHtml}
              </div>
              <div class="absolute bottom-24 flex flex-col items-center gap-10 z-[1000]">
                <span class="font-bebas text-5xl tracking-[0.5em] text-white opacity-80">${design.branding.handle}</span>
              </div>
            </div>
          </body>
        </html>`;
      await page.setContent(storyHtml, { waitUntil: "load", timeout: 60000 });
      await page.evaluateHandle("document.fonts.ready");
      
      // Proteção contra estouro de texto em Stories
      await page.evaluate(`(() => {
        const headline = document.querySelector('h1');
        if (headline) {
          let fontSize = parseFloat(window.getComputedStyle(headline).fontSize);
          while (headline.scrollHeight > headline.offsetHeight && fontSize > 40) {
            fontSize -= 5;
            headline.style.fontSize = fontSize + 'px';
          }
        }
      })()`);
      storyPath = path.join(outputDir, `${timeStr}_story.jpg`);
      await page.screenshot({ path: storyPath, type: "jpeg", quality: 100 });
    }

    await browser.close();
    return { feedPath, storyPath };
  } catch (e) {
    await browser.close();
    throw e;
  }
}
