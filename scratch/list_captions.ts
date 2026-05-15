import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function listCaptions() {
  const listResponse = await axios.get(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    params: { 
      access_token: ACCESS_TOKEN,
      fields: 'id,caption,timestamp'
    }
  });
  console.log(JSON.stringify(listResponse.data.data.slice(0, 10), null, 2));
}

listCaptions();
