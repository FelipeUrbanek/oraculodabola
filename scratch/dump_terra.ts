import puppeteer from "puppeteer";

async function dumpHtml() {
  const url = "https://www.terra.com.br/esportes/flamengo/athletico-x-flamengo-onde-assistir-escalacoes-e-arbitragem,a34a85cb6d6939247526a1cadbcdd054yv80ofaa.html";
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 2000));

  const data = await page.evaluate(() => {
    const meta = Array.from(document.querySelectorAll('meta')).map(m => ({
      property: m.getAttribute('property'),
      name: m.getAttribute('name'),
      content: m.getAttribute('content')
    })).filter(m => m.property?.includes('image') || m.name?.includes('image') || m.property?.includes('date') || m.name?.includes('date'));

    const imgs = Array.from(document.querySelectorAll('img')).slice(0, 10).map(i => i.src);
    const bodyClasses = document.body.className;
    
    return { meta, imgs, bodyClasses };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

dumpHtml();
