import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const REMAINING_TARGETS = [
  { name: 'Athletico-PR', terra: 'https://www.terra.com.br/esportes/athletico-pr/' },
  { name: 'Bragantino', terra: 'https://www.terra.com.br/esportes/bragantino/' },
  { name: 'Real Madrid', terra: 'https://www.terra.com.br/esportes/futebol/internacional/equipes/real-madrid/' },
  { name: 'Barcelona', terra: 'https://www.terra.com.br/esportes/futebol/internacional/equipes/barcelona/' }
];

async function downloadLogo(url: string, teamName: string) {
  const logosDir = path.join(process.cwd(), 'assets', 'logos');
  const filePath = path.join(logosDir, `${teamName.toLowerCase().replace(/ /g, '_')}.png`);
  
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function scrapeRemaining() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  console.log('🚀 Capturando logos remanescentes...');

  for (const target of REMAINING_TARGETS) {
    try {
      const page = await browser.newPage();
      await page.goto(target.terra, { waitUntil: 'networkidle2', timeout: 60000 });
      
      const logoUrl = await page.evaluate(() => {
        // Tenta vários seletores possíveis no Terra
        const selectors = [
          '.header-team__logo img',
          '.team-header__logo img',
          'img[alt*="Logo"]',
          'img[title*="Logo"]',
          'img[src*="logo"]'
        ];
        for (const s of selectors) {
          const img = document.querySelector(s);
          if (img && img.getAttribute('src')?.includes('.png')) return img.getAttribute('src');
        }
        return null;
      });

      if (logoUrl) {
        console.log(`✅ Sucesso: ${target.name}`);
        await downloadLogo(logoUrl, target.name);
      } else {
        console.log(`❌ Falha: ${target.name} (seletor não encontrado)`);
      }
      await page.close();
    } catch (e) {
      console.log(`❌ Erro em ${target.name}: ${e}`);
    }
  }
  await browser.close();
}

scrapeRemaining();
