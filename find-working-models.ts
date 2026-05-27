import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testKey(keyName: string, keyVal: string) {
  if (!keyVal) {
    console.log(`\n⚠️ ${keyName} não está configurada.`);
    return;
  }
  
  console.log(`\n🔍 Testando ${keyName}...`);
  const genAI = new GoogleGenerativeAI(keyVal);
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyVal}`);
    const data = await response.json();
    
    if (data.error) {
      console.error(`❌ Erro da API para ${keyName}:`, data.error.message || data.error);
      return;
    }

    const candidates = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));

    console.log(`📊 ${keyName}: Encontrados ${candidates.length} candidatos. Testando alguns principais...`);
    const testModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];

    for (const modelName of testModels) {
      if (!candidates.includes(modelName)) continue;
      process.stdout.write(`Testing ${modelName} with ${keyName}... `);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi, respond with only the word 'OK' if you are working.");
        const text = result.response.text().trim();
        if (text.includes('OK')) {
          console.log('✅ FUNCIONAL');
        } else {
          console.log(`❓ Resposta inesperada: ${text}`);
        }
      } catch (e: any) {
        console.log(`❌ FALHOU (${e.message.split('\n')[0].substring(0, 120)})`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Erro crítico ao testar ${keyName}: ${e.message}`);
  }
}

async function testGroq() {
  const keyVal = process.env.GROQ_API_KEY || '';
  if (!keyVal) {
    console.log('\n⚠️ GROQ_API_KEY não está configurada.');
    return;
  }
  console.log('\n🔍 Testando GROQ...');
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keyVal}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Hi, respond with only the word 'OK' if you are working." }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data: any = await response.json();
      console.log(`✅ GROQ FUNCIONAL: ${data.choices[0].message.content.trim()}`);
    } else {
      console.log(`❌ GROQ FALHOU: ${response.statusText} (${response.status})`);
    }
  } catch (e: any) {
    console.log(`❌ GROQ FALHOU: ${e.message}`);
  }
}

async function run() {
  const keys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()) : [];
  if (keys.length === 0) {
    console.log('\n⚠️ Nenhuma chave GEMINI_API_KEYS configurada.');
  } else {
    for (let i = 0; i < keys.length; i++) {
      await testKey(`GEMINI_API_KEYS[${i}]`, keys[i]);
    }
  }
  
  await testGroq();
}

run();

