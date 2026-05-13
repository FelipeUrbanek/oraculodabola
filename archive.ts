import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');

async function archivePosts() {
  const postsDir = path.join(process.cwd(), 'posts');
  const archivesDir = path.join(process.cwd(), 'archives');
  
  if (!fs.existsSync(postsDir)) return;
  if (!fs.existsSync(archivesDir)) fs.mkdirSync(archivesDir);

  const now = new Date();
  const zipName = `backup_${now.toISOString().split('T')[0]}.zip`;
  const output = fs.createWriteStream(path.join(archivesDir, zipName));
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`📦 Arquivamento concluído: ${archive.pointer()} total bytes`);
    // Limpar pastas de posts após zipar (opcional, para economizar espaço no Git)
    // fs.rmSync(postsDir, { recursive: true, force: true });
  });

  archive.pipe(output);
  archive.directory(postsDir, false);
  await archive.finalize();
}

// Lógica de 10 dias pode ser controlada pelo GitHub Actions ou por um arquivo de controle
archivePosts();
