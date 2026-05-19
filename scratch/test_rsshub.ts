import Parser from "rss-parser";

const parser = new Parser();

const FOOTBALL_TARGETS = [
  { name: "Santos", terra: "https://www.terra.com.br/esportes/santos/" }
];

async function testRSSHub() {
  const rsshubBase = "http://localhost:1200/rsshub/transform/html/";
  const rules = "item=.card-news&itemTitle=.card-news__text--title&itemLink=a&itemImage=img";

  const results: any = {};

  for (const target of FOOTBALL_TARGETS) {
    const fullUrl = `${rsshubBase}${encodeURIComponent(target.terra)}/${encodeURIComponent(rules)}`;
    console.log(`📡 Testando ${target.name}...`);
    try {
      const feed = await parser.parseURL(fullUrl);
      results[target.name] = {
        status: "OK",
        count: feed.items.length,
        sample: feed.items.slice(0, 2).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate
        }))
      };
    } catch (e: any) {
      results[target.name] = {
        status: "ERROR",
        message: e.message
      };
    }
  }

  console.log("\n--- RESULTADO FINAL ---");
  console.log(JSON.stringify(results, null, 2));
}

testRSSHub();
