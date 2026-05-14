import { processNewsWithGemini } from '../src/lib/gemini.js';

async function test() {
    console.log('🧪 Testando Lógica de Prompt...');
    
    const title = "Botafogo contratou atacante";
    const snippet = "Visando se fortalecer em todas as frentes, o Fogão se antecipou e renovou contrato de uma grande promessa do sub-17. Bernardo Germano assinou seu primeiro contrato profissional, antes era apenas de iniciação. Firmou vínculo até 2029.";

    try {
        const result = await processNewsWithGemini(title, snippet);
        console.log('\n✅ Resultado do Gemini:');
        console.log(JSON.stringify(result, null, 2));
        
        const hasName = (str: string) => str.toLowerCase().includes('bernardo');
        
        if (hasName(result.headline) && hasName(result.summary) && hasName(result.caption)) {
            console.log('\n🎯 SUCESSO: Nome encontrado em todos os campos!');
        } else {
            console.log('\n❌ FALHA: Nome ausente em um ou mais campos.');
        }

        if (result.caption.length <= 550) {
            console.log('📏 Comprimento da legenda OK.');
        } else {
            console.log('⚠️ Legenda ainda muito longa:', result.caption.length);
        }

    } catch (e) {
        console.error('❌ Erro no teste:', e);
    }
}

test();
