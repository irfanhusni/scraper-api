import cron from 'node-cron';
import { scrapeCategoryLinks } from './product-worker';

console.log('⏳ TiktokShop scraper worker started...');

// ✅ Run immediately once at startup for testing
(async () => {
  console.log('🧪 Running test scrape now...');
  const links = await scrapeCategoryLinks();
  console.log('🧪 Test run completed and saved to NDJSON');
})();
