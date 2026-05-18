import axios from "axios";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function deletePost() {
  const token = process.env.FB_ACCESS_TOKEN;
  const mediaId = "17937287061218225";
  console.log(`🗑️ Deletando post do Instagram com ID ${mediaId}...`);
  try {
    const res = await axios.delete(`https://graph.facebook.com/v21.0/${mediaId}`, {
      params: { access_token: token }
    });
    console.log("✅ Deletado com sucesso:", res.data);
  } catch (err: any) {
    console.error("❌ Falha ao deletar:", err.response?.data || err.message);
  }
}
deletePost();
