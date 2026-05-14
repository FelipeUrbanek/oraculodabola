import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testConnectivity() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  
  // Lista de candidatos (Novos + Estáveis)
  const candidates = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-live-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash-native-audio-latest",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro"
  ];

  console.log('🧪 Iniciando Teste de Conectividade do Oráculo...\n');

  for (const name of candidates) {
    try {
      process.stdout.write(`📡 Testando ${name}... `);
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("Diga 'OK' se você está ativo.");
      const response = await result.response;
      const text = response.text().trim();
      console.log(`✅ ATIVO! Resposta: ${text}`);
    } catch (e: any) {
      console.log(`❌ FALHOU: ${e.message.split('\n')[0]}`);
    }
  }
}

testConnectivity();
