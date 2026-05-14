import Parser from 'rss-parser';

const parser = new Parser();

/**
 * Busca as tendências atuais do Google Trends Brasil
 */
export async function fetchCurrentTrends(): Promise<string[]> {
  try {
    console.log('📈 Buscando tendências no Google Trends...');
    const feed = await parser.parseURL('https://trends.google.com/trending/rss?geo=BR');
    
    // Pegamos os 5 primeiros termos de tendência
    const trends = feed.items.slice(0, 5).map(item => item.title || '');
    console.log(`🔥 Tendências detectadas: ${trends.join(', ')}`);
    
    return trends;
  } catch (error) {
    console.error('❌ Erro ao buscar tendências:', error);
    return [];
  }
}
