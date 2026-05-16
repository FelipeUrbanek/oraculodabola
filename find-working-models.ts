import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function findWorkingModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  console.log('🔍 Iniciando Varredura de Modelos Disponíveis...');
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Erro da API:', data.error);
      return;
    }

    const candidates = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));

    console.log(`📊 Encontrados ${candidates.length} candidatos que suportam texto. Testando...`);

    const workingModels = [];

    for (const modelName of candidates) {
      process.stdout.write(`Testing ${modelName}... `);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi, respond with only the word 'OK' if you are working.");
        const text = result.response.text().trim();
        if (text.includes('OK')) {
          console.log('✅ FUNCIONAL');
          workingModels.push(modelName);
        } else {
          console.log('❓ Resposta inesperada');
        }
      } catch (e: any) {
        console.log(`❌ FALHOU (${e.message.split('\n')[0]})`);
      }
    }

    console.log('\n🏆 LISTA FINAL DE MODELOS FUNCIONAIS:');
    console.log(JSON.stringify(workingModels, null, 2));

    // Priorização: Pro > Flash > O resto
    const prioritized = [
      ...workingModels.filter(m => m.includes('pro')).sort().reverse(),
      ...workingModels.filter(m => m.includes('flash')).sort().reverse(),
      ...workingModels.filter(m => !m.includes('pro') && !m.includes('flash')).sort().reverse()
    ];

    console.log('\n🔝 ORDEM DE PRIORIDADE SUGERIDA:');
    console.log(JSON.stringify(prioritized, null, 2));

  } catch (error) {
    console.error('❌ Falha na varredura:', error);
  }
}

findWorkingModels();
