import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const FOOTBALL_TARGETS = [
  { name: 'Flamengo', terra: 'https://www.terra.com.br/esportes/flamengo/' },
  { name: 'Palmeiras', terra: 'https://www.terra.com.br/esportes/palmeiras/' },
  { name: 'Corinthians', terra: 'https://www.terra.com.br/esportes/corinthians/' },
  { name: 'São Paulo', terra: 'https://www.terra.com.br/esportes/sao-paulo/' },
  { name: 'Santos', terra: 'https://www.terra.com.br/esportes/santos/' },
  { name: 'Atlético-MG', terra: 'https://www.terra.com.br/esportes/atletico-mg/' },
  { name: 'Cruzeiro', terra: 'https://www.terra.com.br/esportes/cruzeiro/' },
  { name: 'Grêmio', terra: 'https://www.terra.com.br/esportes/gremio/' },
  { name: 'Internacional', terra: 'https://www.terra.com.br/esportes/internacional/' },
  { name: 'Vasco', terra: 'https://www.terra.com.br/esportes/vasco/' },
  { name: 'Botafogo', terra: 'https://www.terra.com.br/esportes/botafogo/' },
  { name: 'Fluminense', terra: 'https://www.terra.com.br/esportes/fluminense/' },
  { name: 'Bahia', terra: 'https://www.terra.com.br/esportes/bahia/' },
  { name: 'Fortaleza', terra: 'https://www.terra.com.br/esportes/fortaleza/' }
];

async function downloadLogo(url: string, teamName: string) {
  const logosDir = path.join(process.cwd(), 'assets', 'logos');
  if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
  
  const filePath = path.join(logosDir, `${teamName.toLowerCase().replace(/ /g, '_')}.png`);
  
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function scrapeLogos() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  console.log('🚀 Iniciando captura de escudos...');

  for (const target of FOOTBALL_TARGETS) {
    try {
      const page = await browser.newPage();
      await page.goto(target.terra, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const logoUrl = await page.evaluate(() => {
        const img = document.querySelector('.header-team__logo img');
        return img ? img.getAttribute('src') : null;
      });

      if (logoUrl) {
        console.log(`✅ Capturado: ${target.name} -> ${logoUrl}`);
        await downloadLogo(logoUrl, target.name);
      } else {
        console.log(`⚠️ Não encontrado: ${target.name}`);
      }
      await page.close();
    } catch (e) {
      console.log(`❌ Erro em ${target.name}: ${e}`);
    }
  }

  await browser.close();
  console.log('✨ Captura concluída!');
}

scrapeLogos();
