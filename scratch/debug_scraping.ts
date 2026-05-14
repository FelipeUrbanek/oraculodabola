import puppeteer from 'puppeteer';

async function debugScraping() {
  const url = 'https://soufortaleza.com/fortaleza/sem-espaco-com-carpini-atacante-encaminha-saida-do-fortaleza-antes-do-fim-da-temporada/';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  const text = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('article p, .article-content p, .content p'))
        .slice(0, 5)
        .map(p => p.textContent?.trim())
        .join('\n');
  });
  
  console.log('--- CONTENT ---');
  console.log(text);
  await browser.close();
}

debugScraping();
