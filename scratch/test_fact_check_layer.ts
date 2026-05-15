import { processNewsWithGemini } from '../src/lib/gemini.js';

async function test() {
  const title = "Fortaleza se prepara para o Clássico-Rei";
  const snippet = "O Leão do Pici realizou treino tático nesta tarde. O treinador comandou uma atividade focada na saída de bola e posicionamento defensivo para o clássico de domingo.";
  
  console.log("--- TESTANDO CAMADA DE REVISÃO COM WORLD STATE ---");
  console.log("(Esperamos que ele NÃO cite Vojvoda e use Carpini se for citar o técnico)");
  
  try {
    const result = await processNewsWithGemini(title, snippet);
    console.log("HEADLINE:", result.headline);
    console.log("CAPTION:\n", result.caption);
    
    if (result.caption.toLowerCase().includes("vojvoda")) {
      console.error("❌ FALHA: Vojvoda ainda apareceu mesmo com o World State indicando Carpini!");
    } else if (result.caption.toLowerCase().includes("carpini")) {
      console.log("✅ SUCESSO: Usou o World State (Carpini) corretamente.");
    } else {
      console.log("✅ OK: Não citou nenhum dos dois (o que é seguro).");
    }
  } catch (e) {
    console.error("Erro no teste:", e);
  }
}

test();
