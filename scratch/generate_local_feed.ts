import { fetchFootballNews } from "../src/lib/news";
import fs from "fs";

async function generateLocalFeed() {
  console.log("📥 Iniciando agregação completa para feed local...");
  
  try {
    const news = await fetchFootballNews();
    
    const feedData = news.map(item => ({
      title: item.title,
      category: item.category,
      hasImage: !!item.imageUrl,
      imageUrl: item.imageUrl,
      link: item.link,
      pubDate: item.pubDate,
      snippetLength: item.contentSnippet?.length || 0
    }));

    fs.writeFileSync("local_feed.json", JSON.stringify(feedData, null, 2));
    
    console.log(`\n✅ Feed local gerado com ${feedData.length} notícias.`);
    console.log(`🖼️  Notícias com imagem: ${feedData.filter(f => f.hasImage).length}`);
    console.log("📄 Arquivo 'local_feed.json' criado.");
    
  } catch (e: any) {
    console.error("❌ Erro ao gerar feed:", e.message);
  }
}

generateLocalFeed();
