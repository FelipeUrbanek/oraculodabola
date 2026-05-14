import { fetchCurrentTrends } from '../src/lib/trends.js';
import { fetchFootballNews } from '../src/lib/news.js';

async function diagnose() {
  console.log('🧪 Iniciando Diagnóstico de Trends e Notícias...\n');
  
  const trends = await fetchCurrentTrends();
  console.log('\n---');
  
  const news = await fetchFootballNews(trends);
  console.log('\n---');
  
  if (news.length > 0) {
    console.log(`✅ Foram encontradas ${news.length} notícias na última hora:`);
    news.forEach((item: any, index: number) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   🔗 ${item.link}`);
      console.log('   ---');
    });
  } else {
    console.log('❌ Nenhuma notícia encontrada com os termos atuais na última hora.');
  }
}

diagnose();
