import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

console.log("🚀 Iniciando Validação de Ambiente (Senior Mode)...");

const requiredEnvVars = [
  'GEMINI_API_KEY',
  'FB_ACCESS_TOKEN',
  'IG_USER_ID',
  'FB_APP_ID',
  'FB_APP_SECRET'
];

let errors = 0;

// 1. Verificar Variáveis de Ambiente
console.log("\n📁 Verificando Configurações...");
// Tenta carregar o .env.local se ele existir, mas não obriga
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

requiredEnvVars.forEach(v => {
  if (!process.env[v]) {
    console.error(`❌ Variável ausente: ${v}`);
    errors++;
  } else {
    console.log(`✅ ${v} presente.`);
  }
});

// 2. Verificar Git Status
console.log("\n🌿 Verificando Estado do Git...");
try {
  const gitStatus = execSync('git status', { encoding: 'utf-8' });
  if (gitStatus.includes('rebase in progress')) {
    console.warn("⚠️ ALERTA: Rebase em progresso detectado. Isso pode causar problemas em automações de CI/CD.");
  } else if (gitStatus.includes('Unmerged paths')) {
    console.error("❌ Conflitos de merge detectados!");
    errors++;
  } else {
    console.log("✅ Git está limpo.");
  }
} catch (e) {
  console.error("❌ Falha ao executar comando git.");
  errors++;
}

// 3. Verificar Arquivos Críticos
console.log("\n📄 Verificando Arquivos Críticos...");
const criticalFiles = [
  'src/world_state.json',
  'src/history.json',
  'package.json'
];

criticalFiles.forEach(f => {
  if (fs.existsSync(f)) {
    try {
      JSON.parse(fs.readFileSync(f, 'utf-8'));
      console.log(`✅ ${f} existe e é um JSON válido.`);
    } catch (e) {
      console.error(`❌ ${f} está corrompido!`);
      errors++;
    }
  } else {
    console.warn(`⚠️ ${f} não encontrado (pode ser criado na primeira execução).`);
  }
});

// 4. Verificando World State por Erros Fatuais Óbvios
console.log("\n🧠 Auditando World State...");
if (fs.existsSync('src/world_state.json')) {
  const state = JSON.parse(fs.readFileSync('src/world_state.json', 'utf-8'));
  const teams = state.teams || {};
  
  if (teams['Fortaleza'] && teams['Fortaleza'].coach !== 'Thiago Carpini') {
    console.error(`❌ ERRO FACTUAL DETECTADO: Esperado Thiago Carpini para o Fortaleza em 2026, mas encontrou ${teams['Fortaleza'].coach}.`);
    errors++;
  }
  
  // Verificar se há placeholders no world state
  const stateStr = JSON.stringify(state);
  if (stateStr.includes('[') && stateStr.includes(']')) {
    console.warn("⚠️ Aviso: Possíveis placeholders detectados no World State.");
  }
}

console.log("\n-----------------------------------------");
if (errors === 0) {
  console.log("💎 AMBIENTE VALIDADO. Tudo pronto para o Oráculo.");
  process.exit(0);
} else {
  console.error(`🚨 AMBIENTE COMPROMETIDO. ${errors} erro(s) encontrados.`);
  process.exit(1);
}
