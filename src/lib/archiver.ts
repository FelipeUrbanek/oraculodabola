import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');

/**
 * Verifica se existem pastas de posts com mais de 20 dias e as zipa
 */
export async function archiveOldPosts() {
  console.log("🧹 Iniciando limpeza de arquivos antigos...");
  const postsDir = path.join(process.cwd(), 'posts');
  if (!fs.existsSync(postsDir)) return;

  const folders = fs.readdirSync(postsDir).filter(f => {
    const fullPath = path.join(postsDir, f);
    return fs.lstatSync(fullPath).isDirectory();
  });

  const now = new Date();
  const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;

  for (const folder of folders) {
    const folderDate = new Date(folder);
    if (isNaN(folderDate.getTime())) continue;

    if (now.getTime() - folderDate.getTime() > TWENTY_DAYS_MS) {
      console.log(`📦 Arquivando pasta antiga: ${folder}...`);
      await zipFolder(folder, postsDir);
      
      // Remover a pasta após zipar
      fs.rmSync(path.join(postsDir, folder), { recursive: true, force: true });
      console.log(`✅ Pasta ${folder} arquivada e removida.`);
    }
  }
}

function zipFolder(folderName: string, parentDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path.join(parentDir, `${folderName}.zip`));
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);
    archive.directory(path.join(parentDir, folderName), false);
    archive.finalize();
  });
}
