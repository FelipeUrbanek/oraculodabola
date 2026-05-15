import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function downloadManual(url: string, fileName: string) {
  const logosDir = path.join(process.cwd(), 'assets', 'logos');
  if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
  const filePath = path.join(logosDir, fileName);
  
  console.log(`⏳ Baixando: ${fileName} de ${url}...`);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function fixMissing() {
  const missing = [
    { name: 'athletico-pr.png', url: 'https://p2.trrsf.com/image/fget/cf/76/76/filters:quality(100)/images.terra.com/2018/12/12/athletico-pr.png' },
    { name: 'bragantino.png', url: 'https://p2.trrsf.com/image/fget/cf/76/76/filters:quality(100)/images.terra.com/2015/05/21/bragantino.png' },
    { name: 'juventude.png', url: 'https://p2.trrsf.com/image/fget/cf/76/76/filters:quality(100)/images.terra.com/2015/05/26/juventude.png' },
    { name: 'criciúma.png', url: 'https://p2.trrsf.com/image/fget/cf/76/76/filters:quality(100)/images.terra.com/2015/05/26/criciuma.png' },
    { name: 'atlético-go.png', url: 'https://p2.trrsf.com/image/fget/cf/76/76/filters:quality(100)/images.terra.com/2015/05/21/atletico-go.png' }
  ];

  for (const item of missing) {
    try {
      await downloadManual(item.url, item.name);
      console.log(`✅ Sucesso: ${item.name}`);
    } catch (e) {
      console.log(`❌ Falha em ${item.name}`);
    }
  }
}

fixMissing();
