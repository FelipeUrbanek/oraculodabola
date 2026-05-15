import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function deleteSpecificPosts() {
  const idsToDelete = ["18319197661287480", "18196245598322061"];
  
  console.log(`🗑️ Iniciando remoção de ${idsToDelete.length} duplicatas confirmadas...`);

  for (const id of idsToDelete) {
    try {
      console.log(`⏳ Apagando post ID: ${id}...`);
      await axios.delete(`https://graph.facebook.com/v21.0/${id}`, {
        params: { access_token: ACCESS_TOKEN }
      });
      console.log(`✅ Post ${id} removido com sucesso.`);
    } catch (err: any) {
      console.error(`❌ Erro ao apagar post ${id}:`, err.response?.data?.error?.message || err.message);
    }
  }
}

deleteSpecificPosts();
