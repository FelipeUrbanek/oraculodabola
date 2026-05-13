import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const milestones = [
  { value: "100", label: "SEGUIDORES", style: "minimalist", color: "#22c55e", sub: "O COMEÇO DE TUDO." },
  { value: "1.000", label: "SEGUIDORES", style: "dynamic", color: "#3b82f6", sub: "OBRIGADO POR ESTAREM AQUI." },
  { value: "10.000", label: "SEGUIDORES", style: "mosaic", color: "#eab308", sub: "NOSSA FAMÍLIA CRESCEU." },
  { value: "100.000", label: "SEGUIDORES", style: "premium", color: "#94a3b8", sub: "A MAIOR COMUNIDADE." },
  { value: "1.000.000", label: "SEGUIDORES", style: "legendary", color: "#f97316", sub: "HISTÓRIA ESCRITA." }
];

async function generateCelebration(m: typeof milestones[0]) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });

  const logoPath = path.join(process.cwd(), 'posts', 'logo', 'logo.svg');
  const logoSvg = fs.existsSync(logoPath) ? fs.readFileSync(logoPath, 'utf-8') : 'Ω';

  // Gerador de Nomes para o Background
  const names = Array.from({ length: 150 }, (_, i) => `@user_${Math.floor(Math.random() * 9999)}`);
  const namesHtml = names.map(n => {
    const top = Math.random() * 100;
    const left = Math.random() * 100;
    const size = Math.random() * 1.5 + 0.8;
    const rotation = Math.random() * 60 - 30;
    const opacity = Math.random() * 0.15 + 0.05;
    return `<span class="absolute whitespace-nowrap font-bold" style="top:${top}%; left:${left}%; font-size:${size}rem; color:white; opacity:${opacity}; transform: rotate(${rotation}deg); z-index: 1;">${n}</span>`;
  }).join('');
  
  const getStyleOverlay = (style: string) => {
    switch(style) {
      case "minimalist": return `<div class="absolute inset-0 bg-gradient-to-br from-green-600/10 to-black z-10"></div>`;
      case "dynamic": return `<div class="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-black z-10"></div>`;
      case "mosaic": return `<div class="absolute inset-0 bg-black/60 z-10"></div>`;
      case "premium": return `<div class="absolute inset-0 bg-slate-900/40 z-10"></div>`;
      case "legendary": return `<div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-600/20 via-black/80 to-black z-10"></div>`;
      default: return "";
    }
  };

  const html = `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;900&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { background: #000; margin: 0; overflow: hidden; font-family: 'Outfit', sans-serif; color: white; }
          .font-bebas { font-family: 'Bebas Neue', cursive; }
          .glow { text-shadow: 0 10px 40px ${m.color}80; }
          .milestone-text { font-size: 20rem; line-height: 0.75; }
        </style>
      </head>
      <body>
        <div style="width:1080px;height:1350px;" class="relative overflow-hidden flex flex-col items-center justify-center">
          
          <!-- Background de Nomes (Para todos) -->
          <div class="absolute inset-0 z-0">
            ${namesHtml}
          </div>

          ${getStyleOverlay(m.style)}

          <!-- Header -->
          <div class="absolute top-24 z-50 flex flex-col items-center gap-4">
             <div class="w-20 h-20 flex items-center justify-center bg-black border-[1px] border-white/30 p-4">
                ${logoSvg.replace(/<svg/, '<svg style="width:100%;height:100%;"')}
             </div>
             <span class="font-bebas text-3xl tracking-[0.6em] opacity-80 uppercase">Oráculo da Bola</span>
          </div>

          <!-- Main Content Wrapper -->
          <div class="relative z-50 flex flex-col items-center">
            <div class="px-6 py-1 text-xl font-black mb-8 uppercase tracking-[0.8em] border-[1px] border-white/20" style="color: ${m.color};">${m.style === 'legendary' ? 'LENDÁRIO' : 'CONQUISTA'}</div>
            
            <div class="flex flex-col items-center">
              <h1 class="font-bebas milestone-text glow uppercase tracking-tighter">${m.value}</h1>
              <h2 class="font-bebas text-[7rem] leading-none tracking-[0.2em] -mt-4 text-white">${m.label}</h2>
            </div>

            <div class="w-16 h-[2px] mt-12 mb-10 opacity-50" style="background: ${m.color}"></div>
            
            <p class="text-3xl font-light tracking-[0.4em] uppercase text-center max-w-[80%] opacity-70">
              ${m.sub}
            </p>
          </div>

          <!-- Footer Branding -->
          <div class="absolute bottom-20 z-50">
            <div class="flex items-center gap-4 opacity-30">
              <div class="w-8 h-[1px] bg-white"></div>
              <span class="text-sm tracking-[1em] uppercase font-light">Somos Um Só Oráculo</span>
              <div class="w-8 h-[1px] bg-white"></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'load' });
  const outputDir = path.join(process.cwd(), 'posts', 'celebrations');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const fileName = `milestone_${m.value.replace('.', '')}.jpg`;
  await page.screenshot({ path: path.join(outputDir, fileName), type: 'jpeg', quality: 100 });
  console.log(`✅ [${m.style.toUpperCase()}] Gerada com nuvem de nomes: ${fileName}`);
  await browser.close();
}

async function runAll() {
  console.log("👥 Integrando Seguidores no Coração do Design...");
  for (const m of milestones) {
    await generateCelebration(m);
  }
  console.log("\n🏁 Coleção Finalizada: Nomes no fundo e frases simplificadas!");
}

runAll();
