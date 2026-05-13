import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  try {
    // No SDK v1.x do Gemini, usamos o método listModels do objeto genAI
    // Mas o SDK JS às vezes tem variações. Vamos tentar via fetch direto se falhar.
    console.log('🔍 Buscando modelos disponíveis com sua chave...');
    
    // Tentativa via REST API para ser mais preciso no erro
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
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
