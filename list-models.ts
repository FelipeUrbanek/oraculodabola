import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listModels() {
  const keys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()) : [];
  const keyToUse = process.env.GEMINI_API_KEY || keys[0] || '';
  
  const genAI = new GoogleGenerativeAI(keyToUse);
  
  try {
    // No SDK v1.x do Gemini, usamos o método listModels do objeto genAI
    // Mas o SDK JS às vezes tem variações. Vamos tentar via fetch direto se falhar.
    console.log('🔍 Buscando modelos disponíveis com sua chave...');
    
    // Tentativa via REST API para ser mais preciso no erro
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Erro da API:', data.error);
    } else {
      console.log('✅ Modelos encontrados:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Falha ao listar modelos:', error);
  }
}

listModels();
