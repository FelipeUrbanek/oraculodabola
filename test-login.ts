import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { IgApiClient } from 'instagram-private-api';
import * as readline from 'readline';

async function testLogin() {
  const ig = new IgApiClient();
  const username = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;

  if (!username || !password) {
    console.error("❌ Erro: Usuário ou senha não encontrados no .env.local");
    return;
  }

  ig.state.generateDevice(username);

  console.log(`🔐 Tentando login em @${username}...`);
  
  try {
    const loginAttempt = await ig.account.login(username, password).catch(async (error) => {
      if (error.message.includes('checkpoint_required')) {
        console.log("⚠️ VERIFICAÇÃO NECESSÁRIA!");
        
        // Pegar o desafio
        await ig.challenge.auto(true);
        console.log("📩 O Instagram enviou um código para o seu e-mail/SMS.");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const code = await new Promise<string>(resolve => rl.question('Digite o código de 6 dígitos: ', answer => {
          rl.close();
          resolve(answer);
        }));

        // Enviar o código
        await (ig.challenge as any).sendIt(code);
        console.log("✅ Código enviado! Tentando finalizar login...");
        return await ig.account.login(username, password);
      }
      throw error;
    });

    console.log("✅ SUCESSO ABSOLUTO! O Oráculo está dentro.");
    console.log(`👤 Nome: ${loginAttempt.full_name}`);
  } catch (error: any) {
    console.error("❌ FALHA NO LOGIN:", error.message);
    console.log("\n💡 Dica: Se o erro for '400 Bad Request', tente abrir o Instagram no navegador do PC uma vez antes de rodar este script.");
  }
}

testLogin();
