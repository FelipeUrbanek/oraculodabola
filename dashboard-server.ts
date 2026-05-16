import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchFootballNews } from "./src/lib/news.js";
import { generateImages } from "./src/lib/renderer.js";
import { processNewsWithGemini } from "./src/lib/gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3030;

app.use(cors());
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/posts", express.static(path.join(__dirname, "posts")));

const WORLD_STATE_PATH = path.join(__dirname, "src", "world_state.json");
const HISTORY_PATH = path.join(__dirname, "src", "history.json");
const AUDIT_PATH = path.join(__dirname, "src", "audit_log.json");

// --- CACHE ENGINE (Performance Impeccable) ---
let newsCache: any[] = [];
let lastFetch = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minutos

async function getCachedNews() {
  const now = Date.now();
  if (newsCache.length > 0 && (now - lastFetch < CACHE_DURATION)) {
    return newsCache;
  }
  console.log("📡 Cache expirado ou vazio. Buscando novas notícias (Otimizado)...");
  newsCache = await fetchFootballNews();
  lastFetch = now;
  return newsCache;
}

// --- UI DASHBOARD COMPLETA (Estilo Impeccable) ---
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="pt-br" class="dark">
<head>
    <meta charset="UTF-8">
    <title>Oráculo | Command Center v5</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #e2e8f0; overflow-x: hidden; }
        .glass { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.03); }
        .tab-active { border-bottom: 2px solid #f97316; color: #f97316; }
        .card-hover:hover { border-color: rgba(249, 115, 22, 0.4); transform: translateY(-2px); }
        @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse-soft { animation: pulse-soft 2s infinite; }
    </style>
</head>
<body class="p-4 md:p-10">
    <div class="max-w-[1600px] mx-auto">
        <!-- Header Premium -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
                <h1 class="text-5xl font-black tracking-tighter italic">ORÁCULO <span class="text-orange-500">2025</span></h1>
                <div class="flex items-center gap-3 mt-2">
                    <span class="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <p class="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Autonomous Football Intelligence</p>
                </div>
            </div>
            
            <nav class="flex gap-8 border-b border-white/5 pb-2">
                <button onclick="switchTab('radar')" id="tab-radar" class="text-xs font-bold uppercase tracking-widest tab-active">📡 Radar</button>
                <button onclick="switchTab('studio')" id="tab-studio" class="text-xs font-bold uppercase tracking-widest text-slate-500">🎨 Studio</button>
                <button onclick="switchTab('state')" id="tab-state" class="text-xs font-bold uppercase tracking-widest text-slate-500">🧠 State</button>
                <button onclick="switchTab('audit')" id="tab-audit" class="text-xs font-bold uppercase tracking-widest text-slate-500">📜 Audit</button>
            </nav>
        </header>

        <!-- SEÇÃO RADAR -->
        <div id="view-radar" class="view-content grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div class="lg:col-span-3 space-y-6">
                <div class="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl">
                    <h2 class="text-sm font-bold uppercase tracking-widest text-orange-400">Live News Radar</h2>
                    <div class="flex items-center gap-4">
                        <span id="cache-status" class="text-[10px] text-slate-500">Cache: Ativo (15m)</span>
                        <button onclick="loadNews(false)" class="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full text-[10px] font-bold transition-all">Sync Radar</button>
                        <button onclick="loadNews(true)" class="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-full text-[10px] font-bold transition-all shadow-lg shadow-orange-900/20">Force Refresh</button>
                    </div>
                </div>
                <div id="news-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
            </div>
            <aside class="space-y-6">
                <div class="glass p-6 rounded-3xl">
                    <h3 class="text-xs font-black uppercase tracking-[0.2em] mb-4 text-slate-500">System Activity</h3>
                    <div id="history-list" class="space-y-4"></div>
                </div>
            </aside>
        </div>

        <!-- SEÇÃO STUDIO (MODAL INTEGRADO) -->
        <div id="view-studio" class="view-content hidden">
            <div class="glass p-10 rounded-[3rem] border-white/5">
                <div id="studio-placeholder" class="text-center py-40">
                    <p class="text-slate-500 italic">Selecione uma notícia no Radar para renderizar no Studio.</p>
                    <button onclick="switchTab('radar')" class="mt-4 text-orange-500 font-bold text-sm underline">Ir para o Radar</button>
                </div>
                <div id="studio-content" class="hidden grid grid-cols-1 lg:grid-cols-2 gap-12">
                </div>
            </div>
        </div>

        <!-- SEÇÃO STATE -->
        <div id="view-state" class="view-content hidden max-w-4xl mx-auto">
            <div class="glass p-8 rounded-3xl">
                <h3 class="text-xl font-bold mb-6">World State Editor</h3>
                <textarea id="state-editor" class="w-full h-[500px] bg-slate-950/50 border border-white/5 rounded-2xl p-6 text-xs font-mono text-orange-200/70 focus:outline-none focus:border-orange-500/50"></textarea>
                <div class="flex justify-end mt-6">
                    <button onclick="saveState()" class="bg-orange-600 px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs">Update System Memory</button>
                </div>
            </div>
        </div>

        <!-- SEÇÃO AUDIT -->
        <div id="view-audit" class="view-content hidden">
            <div class="glass p-8 rounded-3xl overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="text-slate-500 uppercase tracking-widest border-b border-white/5">
                        <tr><th class="py-4">Headline</th><th class="py-4">Category</th><th class="py-4">Status</th></tr>
                    </thead>
                    <tbody id="audit-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        function switchTab(tab) {
            document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active', 'text-orange-500'));
            document.getElementById('view-' + tab).classList.remove('hidden');
            document.getElementById('tab-' + tab).classList.add('tab-active');
        }

        async function loadNews(force = false) {
            const grid = document.getElementById('news-grid');
            grid.innerHTML = Array(6).fill(0).map(() => '<div class="glass h-40 rounded-2xl animate-pulse-soft"></div>').join('');
            const url = force ? '/api/news?force=true' : '/api/news';
            const res = await fetch(url);
            const news = await res.json();
            grid.innerHTML = news.map(n => \`
                <div class="glass p-6 rounded-3xl border-white/5 transition-all card-hover group">
                    <span class="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md mb-4 inline-block">\${n.category}</span>
                    <h4 class="font-bold text-sm leading-snug mb-6 line-clamp-3">\${n.title}</h4>
                    <button onclick='openInStudio("\${btoa(unescape(encodeURIComponent(JSON.stringify(n))))}")' class="w-full py-3 bg-white/5 hover:bg-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Studio Render</button>
                </div>
            \`).join('');
            if (force) alert('Cache limpo e notícias atualizadas!');
        }

        async function openInStudio(b64) {
            const item = JSON.parse(decodeURIComponent(escape(atob(b64))));
            switchTab('studio');
            document.getElementById('studio-placeholder').classList.add('hidden');
            const studio = document.getElementById('studio-content');
            studio.classList.remove('hidden');
            studio.innerHTML = '<div class="col-span-2 text-center py-20 text-orange-500 font-bold animate-pulse">INVOCANDO GEMINI & RENDER ENGINE...</div>';
            
            const res = await fetch('/api/render', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item) });
            const data = await res.json();
            
            studio.innerHTML = \`
                <div class="space-y-6">
                    <div class="aspect-square glass rounded-[2.5rem] overflow-hidden border-white/10 shadow-2xl">
                        <img src="\${data.images.feed}" class="w-full h-full object-contain">
                    </div>
                    <p class="text-[10px] font-black uppercase tracking-[0.4em] text-center text-slate-500">High Fidelity Feed Output</p>
                </div>
                <div class="space-y-8 py-6">
                    <div>
                        <h3 class="text-3xl font-black tracking-tighter text-orange-500 mb-4">\${data.processed.headline}</h3>
                        <p class="text-slate-400 leading-relaxed font-medium">\${data.processed.summary}</p>
                    </div>
                    <div class="bg-slate-950 p-6 rounded-2xl border border-white/5">
                        <p class="text-xs font-mono text-slate-500 mb-4 uppercase tracking-widest">Instagram Copy</p>
                        <p class="text-sm whitespace-pre-wrap">\${data.processed.caption}</p>
                        <p class="mt-4 text-orange-500 font-bold">\${data.processed.hashtags.join(' ')}</p>
                    </div>
                </div>
            \`;
        }

        async function loadState() { 
            const res = await fetch('/api/state'); 
            const data = await res.json(); 
            document.getElementById('state-editor').value = JSON.stringify(data, null, 2); 
        }

        async function saveState() { 
            await fetch('/api/state', { method:'POST', headers:{'Content-Type':'application/json'}, body: document.getElementById('state-editor').value }); 
            alert('Memory Updated');
        }

        async function loadHistory() {
            const res = await fetch('/api/history');
            const data = await res.json();
            document.getElementById('history-list').innerHTML = data.slice(-8).reverse().map(h => \`
                <div class="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p class="font-bold text-slate-400 truncate text-[11px]">\${h.title || h.id}</p>
                    <p class="text-[9px] text-slate-600 mt-1 uppercase tracking-tighter">\${new Date(h.date).toLocaleString()}</p>
                </div>
            \`).join('');
        }

        async function loadAudit() {
            const res = await fetch('/api/audit');
            const data = await res.json();
            document.getElementById('audit-body').innerHTML = data.slice(-20).reverse().map(a => \`
                <tr class="border-b border-white/5">
                    <td class="py-4 pr-4 font-medium">\${a.headline}</td>
                    <td class="py-4 text-slate-500 font-bold">\${a.category}</td>
                    <td class="py-4"><span class="px-2 py-1 rounded text-[10px] font-bold \${a.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}">\${a.status}</span></td>
                </tr>
            \`).join('');
        }

        loadNews(); loadState(); loadHistory(); loadAudit();
    </script>
</body>
</html>
`;

app.get("/", (req, res) => { res.send(HTML_CONTENT); });

app.get("/api/state", (req, res) => {
  if (!fs.existsSync(WORLD_STATE_PATH)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(WORLD_STATE_PATH, "utf-8")));
});

app.post("/api/state", (req, res) => {
  fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.get("/api/news", async (req, res) => {
  try {
    const force = req.query.force === 'true';
    if (force) {
      console.log("♻️ Force Refresh solicitado. Limpando cache...");
      lastFetch = 0; // Reseta o tempo para forçar nova busca
    }
    const news = await getCachedNews();
    res.json(news);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/render", async (req, res) => {
  try {
    const { title, contentSnippet, category, imageUrl } = req.body;
    const processed = await processNewsWithGemini(title, contentSnippet, category);
    const result = await generateImages(processed, imageUrl, processed.mainTeam || category);
    const normalizePath = (p: string) => {
      const cleanPath = p.replace(/\\/g, '/');
      const index = cleanPath.lastIndexOf('posts/');
      if (index === -1) return `/posts/${path.basename(p)}`;
      return `/${cleanPath.substring(index)}`;
    };

    res.json({
      success: true,
      processed,
      images: {
        feed: result.feedPath ? normalizePath(result.feedPath) : null,
        story: result.storyPath ? normalizePath(result.storyPath) : null
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/history", (req, res) => {
  if (!fs.existsSync(HISTORY_PATH)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8")));
});

app.get("/api/audit", (req, res) => {
  if (!fs.existsSync(AUDIT_PATH)) return res.json([]);
  const lines = fs.readFileSync(AUDIT_PATH, "utf-8").trim().split("\n");
  const data = lines.filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch(e) { return null; }
  }).filter(Boolean);
  res.json(data);
});

app.listen(PORT, () => {
  console.log("🚀 Dashboard Impeccable rodando em http://localhost:" + PORT);
});
