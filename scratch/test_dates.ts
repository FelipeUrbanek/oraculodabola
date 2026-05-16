import { fetchRSSHubTerra } from "../src/lib/news";

async function testDates() {
  const targets = [
    { name: "Flamengo", terra: "https://www.terra.com.br/esportes/flamengo/" },
    { name: "Palmeiras", terra: "https://www.terra.com.br/esportes/palmeiras/" }
  ];

  console.log("📡 Buscando notícias do RSSHub...");
  
  for (const target of targets) {
    console.log(`\n--- ${target.name} ---`);
    const news = await fetchRSSHubTerra(target);
    news.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. [${item.pubDate}] ${item.title}`);
    });
  }
}

testDates();
