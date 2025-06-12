import cron from 'node-cron';
import { scrapeCategoryLinks } from './product-worker';

console.log('⏳ TiktokShop scraper worker started...');

// ✅ Run immediately once at startup for testing
(async () => {
  console.log('🧪 Running test scrape now...');
  const start = Date.now();

  const links = await scrapeCategoryLinks();

  const end = Date.now();
  const durationInSec = ((end - start) / 1000).toFixed(2);
  console.log(`🧪 Test run completed and saved to Database in ${durationInSec} seconds`);
})();
