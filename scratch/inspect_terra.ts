import puppeteer from "puppeteer";

async function inspectTerra() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("https://www.terra.com.br/esportes/flamengo/", {
    waitUntil: "domcontentloaded",
  });

  const cardHtml = await page.evaluate(() => {
    const card = document.querySelector(".card-news, .card-news-horizontal");
    return card ? card.innerHTML : "Not found";
  });

  console.log("--- CARD HTML SAMPLE ---");
  console.log(cardHtml);

  await browser.close();
}

inspectTerra();
