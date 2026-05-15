import { processNewsWithGemini } from '../src/lib/gemini.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLD_STATE_PATH = path.join(__dirname, '..', 'src', 'world_state.json');

async function test() {
  const title = "BOMBA NO PICI: Fortaleza demite Carpini e anuncia Tite";
  const snippet = "Fim da era Carpini. O Fortaleza anunciou nesta tarde a demissão do técnico Thiago Carpini após a derrota no clássico. Em seguida, o clube confirmou a contratação de Tite para tentar o acesso na Série B.";
  
  console.log("--- TESTANDO TROCA DE TÉCNICO (SOBREPOSIÇÃO E ATUALIZAÇÃO) ---");
  
  try {
    // Verificando estado inicial
    const initialState = JSON.parse(fs.readFileSync(WORLD_STATE_PATH, 'utf-8'));
    console.log("Estado Inicial (Técnico):", initialState.teams.Fortaleza.coach);

    const result = await processNewsWithGemini(title, snippet);
    console.log("HEADLINE:", result.headline);
    console.log("CAPTION:\n", result.caption);
    
    if (result.caption.toLowerCase().includes("tite")) {
      console.log("✅ SUCESSO: Identificou o NOVO técnico (Tite) ignorando a memória antiga.");
    } else {
      console.error("❌ FALHA: Não identificou Tite ou se prendeu a Carpini.");
    }

    // Aguardar um pouco para garantir a escrita do arquivo
    await new Promise(r => setTimeout(r, 2000));
    
    const finalState = JSON.parse(fs.readFileSync(WORLD_STATE_PATH, 'utf-8'));
    console.log("Estado Final (Técnico):", finalState.teams.Fortaleza.coach);
    
    if (finalState.teams.Fortaleza.coach === "Tite") {
      console.log("✅ SUCESSO: Memória do Mundo atualizada para Tite.");
    } else {
      console.error("❌ FALHA: A memória não foi atualizada.");
    }
    
  } catch (e) {
    console.error("Erro no teste:", e);
  }
}

test();
