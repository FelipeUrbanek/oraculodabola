import { fetchRSSHubTerra } from "../src/lib/news";

async function testDates() {
  const targets = [
    { name: "Flamengo", terra: "https://www.terra.com.br/esportes/flamengo/" }
  ];

  for (const target of targets) {
    const news = await fetchRSSHubTerra(target);
    news.slice(0, 3).forEach((item) => {
      console.log(`URL: ${item.link}`);
    });
  }
}

testDates();
