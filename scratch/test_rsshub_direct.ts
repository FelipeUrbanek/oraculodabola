import axios from 'axios';

async function testRSSHubDirect() {
  const terraUrl = 'https://www.terra.com.br/esportes/futebol/copa-2026/';
  const rsshubUrl = `http://localhost:1200/rsshub/transform/html/${encodeURIComponent(terraUrl)}?routeParams=item=.card-news%26title=.card-news__text--title`;

  console.log(`📡 Testando RSSHub direto para: ${terraUrl}`);
  try {
    const res = await axios.get(rsshubUrl);
    console.log('✅ RSSHub respondeu!');
    console.log('--- CONTEÚDO (Primeiros 500 chars) ---');
    console.log(res.data.substring(0, 500));
  } catch (e: any) {
    console.error(`❌ Erro no RSSHub: Status ${e.response?.status}`);
    console.error(`Mensagem: ${e.message}`);
  }
}

testRSSHubDirect();
