import { GoogleGenerativeAI } from "@google/generative-ai";
import Parser from 'rss-parser';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const parser = new Parser();

async function debugSearch() {
  const query = encodeURIComponent(`Kayke Fortaleza futebol when:24h`);
  const searchUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;
  console.log(`Searching: ${searchUrl}`);
  const feed = await parser.parseURL(searchUrl);
  console.log(`Found ${feed.items.length} items.`);
  feed.items.slice(0, 1).forEach(item => {
    console.log(`- ${item.title}`);
    console.log(`- Content: ${item.contentSnippet}`);
  });
}

debugSearch();
