import puppeteer from 'puppeteer';
import { ProcessedContent } from './gemini';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateImages(content: ProcessedContent, newsImageUrl: string | null, teamName: string = '', forceLayout?: number): Promise<{ feedPath: string; storyPath: string | null }> {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  
  try {
    const page = await browser.newPage();
    
    // Carregar escudo do time se disponível
    let teamShieldHtml = '';
    const normalizedTeamName = teamName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/ /g, '_');
    
    const logoFileName = `${normalizedTeamName}.png`;
    const logosDir = path.resolve(__dirname, '..', '..', 'assets', 'logos');
    const logoPath = path.join(logosDir, logoFileName);
    
    if (fs.existsSync(logoPath)) {
      const base64 = fs.readFileSync(logoPath, 'base64');
      teamShieldHtml = `<div class="w-16 h-16 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 border-r border-white/10">
        <img src="data:image/png;base64,${base64}" class="w-full h-full object-contain">
      </div>`;
    } else {
      console.log(`⚠️ Escudo não encontrado para ${teamName} em ${logoPath}`);
      // Tentar sem normalizar se falhou
      const originalPath = path.join(logosDir, `${teamName.toLowerCase().replace(/ /g, '_')}.png`);
      if (fs.existsSync(originalPath)) {
        const base64 = fs.readFileSync(originalPath, 'base64');
        teamShieldHtml = `<div class="w-16 h-16 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 border-r border-white/10">
          <img src="data:image/png;base64,${base64}" class="w-full h-full object-contain">
        </div>`;
      }
    }

    // Lógica de sorteio com memória para evitar repetição consecutiva
    const LAST_LAYOUT_PATH = path.join(process.cwd(), 'src', 'last_layout.json');
    let lastLayouts = { feed: 0, story: 0 };
    
    if (fs.existsSync(LAST_LAYOUT_PATH)) {
      try {
        lastLayouts = JSON.parse(fs.readFileSync(LAST_LAYOUT_PATH, 'utf-8'));
      } catch (e) { /* ignore error */ }
    }

    let feedDiag = forceLayout;
    if (!feedDiag) {
      // Filtrar o último layout usado das opções
      const feedChoices = [1, 1, 2, 2, 3, 3, 5, 5, 4].filter(l => l !== lastLayouts.feed);
      feedDiag = feedChoices[Math.floor(Math.random() * feedChoices.length)];
    }

    let storyDiag = forceLayout;
    if (!storyDiag) {
      const storyChoices = [1, 1, 2, 2, 4].filter(l => l !== lastLayouts.story);
      storyDiag = storyChoices[Math.floor(Math.random() * storyChoices.length)];
    }

    // Salvar os novos layouts escolhidos na memória
    fs.writeFileSync(LAST_LAYOUT_PATH, JSON.stringify({ feed: feedDiag, story: storyDiag }));

    const catColors: Record<string, string> = {
      'URGENTE': '#ef4444',   // Vermelho vivo
      'PLANTÃO': '#dc2626',   // Vermelho escuro
      'MERCADO': '#059669',   // Verde esmeralda
      'BASTIDORES': '#b45309', // Âmbar escuro / dourado
      'TÁTICA': '#ea580c',    // Laranja intenso
      'EXCLUSIVO': '#7c3aed', // Violeta escuro
      'ANÁLISE': '#9333ea',   // Roxo
      'OPINIÃO': '#db2777',   // Rosa choque
      'NÚMEROS': '#0f766e',   // Teal escuro
      'FATO': '#475569',      // Slate escuro
      'HISTÓRIA': '#92400e'   // Marrom dourado
    };
    const badgeColor = catColors[content.category] || '#475569';
    const bgUrl = (newsImageUrl && newsImageUrl.includes('http')) ? newsImageUrl : `https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1080&h=1350`;

    const officialLogoPath = path.resolve(process.cwd(), 'posts', 'logo', 'logo.svg');
    let logoSvg = '<div class="w-10 h-10 border-2 border-white flex items-center justify-center font-black text-white text-xl bg-black">Ω</div>';
    
    if (fs.existsSync(officialLogoPath)) {
      const rawSvg = fs.readFileSync(officialLogoPath, 'utf-8');
      logoSvg = rawSvg
        .replace(/width=".*?"/, '')
        .replace(/height=".*?"/, '')
        .replace(/<svg/, '<svg style="width:75%; height:75%;"');
    }

    const handleTag = `<div class="absolute top-12 left-12 z-[1000] flex items-center gap-0">
      ${teamShieldHtml}
      <span class="font-bebas text-3xl tracking-[0.2em] text-white px-6 h-16 flex items-center bg-black/90 backdrop-blur-md">@OORACULODABOLA</span>
      <div class="w-16 h-16 flex items-center justify-center bg-black border-l border-white/20">
        ${logoSvg}
      </div>
    </div>`;

    const feedLayouts: Record<number, string> = {
      1: `<div class="absolute inset-0 background-img z-0"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent h-full z-10"></div>
          <div class="z-[500] flex flex-col justify-end h-full p-16 pt-32 pb-32 relative">
            <div class="px-6 py-2 font-bebas text-5xl inline-block mb-8 w-fit uppercase text-white shadow-xl" style="background-color: ${badgeColor};">${content.category}</div>
            <h1 class="font-bebas text-[6.5rem] leading-[0.95] text-white uppercase mb-8 drop-shadow-2xl tracking-tight">${content.headline}</h1>
            <p class="text-3xl font-medium text-white/90 leading-snug mb-10 max-w-[90%]">${content.summary}</p>
          </div>`,
      2: `<div class="h-[60%] w-full relative background-img z-0"></div>
          <div class="h-[40%] w-full p-20 pt-16 pb-24 flex flex-col justify-center relative z-[500] bg-black">
            <div class="absolute top-0 left-0 w-full h-2" style="background-color: ${badgeColor}"></div>
            <div class="px-6 py-2 font-bebas text-4xl mb-6 uppercase text-white w-fit" style="background-color: ${badgeColor}">${content.category}</div>
            <h1 class="font-bebas text-[7.5rem] leading-[0.9] text-white uppercase mb-6">${content.headline}</h1>
            <p class="text-3xl font-medium text-white/70 leading-snug">${content.summary}</p>
          </div>`,
      3: `<div class="absolute inset-0 background-img z-0"></div>
          <div class="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10"></div>
          <div class="z-[500] h-full flex flex-col justify-center p-20 relative max-w-[85%]">
            <div class="font-bebas text-6xl text-white px-8 py-2 mb-8 w-fit shadow-2xl" style="background-color: ${badgeColor}">${content.category}</div>
            <div class="border-l-[12px] pl-12 py-4" style="border-color: ${badgeColor}">
              <h1 class="font-bebas text-[8rem] leading-[1.0] text-white uppercase mb-10 drop-shadow-2xl">${content.headline}</h1>
              <p class="text-4xl font-bold text-white/90 leading-tight italic">${content.summary}</p>
            </div>
          </div>`,
      4: `<div class="absolute inset-0 background-img z-0"></div>
          <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10"></div>
          <div class="z-[500] h-full flex flex-col justify-center items-center text-center p-24 relative">
            <div class="px-10 py-3 font-bebas text-6xl uppercase mb-12 text-white shadow-2xl" style="background-color: ${badgeColor}">${content.category}</div>
            <h1 class="font-bebas text-[8.5rem] leading-[0.9] text-white uppercase mb-12 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">${content.headline}</h1>
            <div class="w-32 h-2 mb-12" style="background-color: ${badgeColor}"></div>
            <p class="text-3xl font-black text-white italic leading-snug uppercase tracking-tight">${content.summary}</p>
          </div>`,
      5: `<div class="absolute inset-0 background-img z-0"></div>
          <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black z-10"></div>
          <div class="z-[500] h-full flex flex-col justify-end items-start p-20 pb-32 relative">
            <div class="px-8 py-3 font-bebas text-6xl uppercase mb-10 text-white" style="background-color: ${badgeColor}">${content.category}</div>
            <h1 class="font-bebas text-[9rem] leading-[0.85] text-white uppercase mb-16 drop-shadow-2xl">${content.headline}</h1>
            <p class="text-4xl font-black text-white/90 leading-tight border-l-4 pl-10" style="border-color: ${badgeColor}">${content.summary}</p>
          </div>`,
    };

    const baseHtml = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: 'Outfit', sans-serif; background: #000; margin: 0; overflow: hidden; color: white; }
            .font-bebas { font-family: 'Bebas Neue', cursive; }
            .background-img { 
              position: absolute; 
              inset: 0; 
              background-image: url('${bgUrl}'); 
              background-size: cover; 
              background-position: center; 
              z-index: 0;
              filter: brightness(0.8);
            }
            h1 { text-shadow: 0 2px 8px rgba(0,0,0,0.55); }
            p  { text-shadow: 0 1px 4px rgba(0,0,0,0.45); }
            span { text-shadow: 0 1px 3px rgba(0,0,0,0.35); }
          </style>
        </head>
        <body>
          <div style="width:1080px;height:1350px;" class="relative overflow-hidden flex flex-col items-center justify-center text-center">
            ${handleTag}
            ${feedLayouts[feedDiag] || feedLayouts[1]}
          </div>
        </body>
      </html>
    `;

    const storyLayouts: Record<number, string> = {
      1: `<div class="mb-20"><div class="font-bebas text-5xl mb-10 p-5 text-white inline-block border-4 border-white" style="background:${badgeColor}; font-weight: 900;">${content.category}</div><h1 class="font-bebas text-[10rem] leading-[0.95] mb-12 drop-shadow-2xl">${content.headline}</h1><p class="text-[3.5rem] font-bold leading-tight px-10 text-white italic drop-shadow-lg">${content.summary}</p></div>`,
      2: `<div class="mt-24 border-l-[35px] pl-10 text-left relative z-[500]" style="border-color:${badgeColor}"><h1 class="font-bebas text-[11rem] leading-[0.9] mb-12 text-white drop-shadow-2xl">${content.headline}</h1><div class="bg-white text-black p-4 inline-block font-bebas text-6xl" style="background:${badgeColor}; color:white">${content.category}</div></div><div class="mt-auto mb-48 text-left px-16 relative z-[500]"><p class="text-5xl font-black text-white italic bg-black/80 p-10 drop-shadow-2xl leading-snug">${content.summary}</p></div>`,
      4: `<div class="bg-black/95 border-[15px] p-16 w-full relative z-[500] shadow-2xl" style="border-color:${badgeColor}"><h1 class="font-bebas text-[10.5rem] leading-[0.95] mb-16 text-white">${content.headline}</h1><p class="text-5xl font-black text-white italic border-t-8 pt-12 border-white/10 leading-snug">${content.summary}</p></div>`
    };

    // --- RENDER FEED ---
    await page.setViewport({ width: 1080, height: 1350 });
    const feedHtml = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet"><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: 'Outfit', sans-serif; background: #000; margin: 0; overflow: hidden; color: white; }.font-bebas { font-family: 'Bebas Neue', cursive; }.background-img { background-image: url('${bgUrl}'); background-size: cover; background-position: center; } h1 { text-shadow: 0 2px 8px rgba(0,0,0,0.55); } p { text-shadow: 0 1px 4px rgba(0,0,0,0.45); } span { text-shadow: 0 1px 3px rgba(0,0,0,0.35); }</style></head><body><div style="width:1080px;height:1350px;" class="relative overflow-hidden background-img">${feedLayouts[feedDiag] || feedLayouts[1]}${handleTag}</div></body></html>`;
    await page.setContent(feedHtml, { waitUntil: 'load', timeout: 60000 });
    await page.evaluateHandle('document.fonts.ready');
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${dateStr}-${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    const outputDir = path.join(process.cwd(), 'posts', dateStr);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const feedPath = path.join(outputDir, `${timeStr}_feed.jpg`);
    await page.screenshot({ path: feedPath, type: 'jpeg', quality: 100 });

    // --- RENDER STORY (SOMENTE SE A IA DECIDIR) ---
    let storyPath = null;
    if (content.shouldCreateStory) {
      console.log("📱 Gerando arte para Story...");
      await page.setViewport({ width: 1080, height: 1920 });
      // ... (restante da lógica de StoryHtml igual)
      const storyHtml = `<html><head><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet"><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: 'Outfit', sans-serif; background: #000; margin: 0; overflow: hidden; color: white; }.font-bebas { font-family: 'Bebas Neue', cursive; }.background-img { position: absolute; inset: 0; background-image: url('${bgUrl}'); background-size: cover; background-position: center; filter: brightness(0.2) blur(10px); } h1 { text-shadow: 0 2px 8px rgba(0,0,0,0.55); } p { text-shadow: 0 1px 4px rgba(0,0,0,0.45); } span { text-shadow: 0 1px 3px rgba(0,0,0,0.35); }</style></head><body><div style="width:1080px;height:1920px;" class="relative overflow-hidden flex flex-col items-center justify-center text-center p-16"><div class="absolute inset-0 background-img"></div><div class="absolute inset-0 bg-gradient-to-b from-black/90 via-transparent to-black z-10"></div><div class="relative z-[500] flex flex-col items-center justify-center w-full h-full">${storyLayouts[storyDiag] || storyLayouts[1]}</div><div class="absolute bottom-24 flex flex-col items-center gap-10 z-[1000]"><span class="font-bebas text-5xl tracking-[0.5em] text-white opacity-80">@OORACULODABOLA</span></div></div></body></html>`;
      await page.setContent(storyHtml, { waitUntil: 'load', timeout: 60000 });
      await page.evaluateHandle('document.fonts.ready');
      storyPath = path.join(outputDir, `${timeStr}_story.jpg`);
      await page.screenshot({ path: storyPath, type: 'jpeg', quality: 100 });
    }

    await browser.close();
    return { feedPath, storyPath };
  } catch (e) {
    await browser.close();
    throw e;
  }
}
