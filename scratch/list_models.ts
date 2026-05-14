import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  try {
    // Nota: O SDK do Google não tem um método direto 'listModels', 
    // mas podemos usar o fetch direto com a chave do env
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log('🤖 Modelos Disponíveis:');
    if (data.models) {
      data.models.forEach((m: any) => {
        console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
      });
    } else {
      console.log('Nenhum modelo encontrado ou erro na resposta:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Erro ao listar modelos:', e);
  }
}

listModels();
