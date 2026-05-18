import { resolveAndScrapeImage } from "../src/lib/news";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const url = "https://www.terra.com.br/esportes/brasil/vai-ser-convocado-neymar-faz-exame-a-pedido-da-cbf,0b49d3633a3988e78668ea3170e98b91ialsc073.html";
  console.log("Scraping image from:", url);
  const result = await resolveAndScrapeImage(url);
  console.log("Result:", result);
}

run();
