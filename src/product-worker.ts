import { chromium } from 'playwright';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import axios from 'axios';
import {
  insertProductIntoDb,
  insertCategoryIntoDb,
  initDatabase
} from './db-util';
import { getRandomUserAgent } from './random-ua-util';

const dataDir = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDir, 'products.db');

// API response interface
interface TikTokProduct {
  product_id: string;
  seller_info?: {
    seller_id: string;
    shop_name: string;
  };
}

interface TikTokProductListResponse {
  code: number;
  message: string;
  data: {
    productList: TikTokProduct[];
    hasMore: boolean;
  };
}

export async function scrapeCategoryLinks(): Promise<void> {
  let browser;
  let db: Database | undefined;

  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });
    await initDatabase(db);
    console.log('SQLite initialized at:', databasePath);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 390, height: 844 },
      isMobile: true,
      locale: 'id-ID'
    });
    const page = await context.newPage();

    const baseURL = 'https://shop-id.tokopedia.com/c';
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    const topLevelSelector = 'a.link-fGzyDw[href^="https://shop-id.tokopedia.com/c/"]';
    await page.waitForSelector(topLevelSelector, { timeout: 15000 });

    const topCategories = await page.$$eval(topLevelSelector, (anchors) =>
      Array.from(new Set(
        anchors
          .filter(a => a instanceof HTMLAnchorElement)
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => href.includes('/c/') && /\d+$/.test(href))
      )).map(link => {
        const match = link.match(/\/(\d+)$/);
        const categoryid = match ? match[1] : '';
        return { categoryid, link };
      })
    );

    console.log(`Found ${topCategories.length} top-level categories`);

    for (const cat of topCategories) {
      await insertCategoryIntoDb(db, { categoryId: cat.categoryid, link: cat.link });
      console.log(`Inserted category: ${cat.link}`);

      const headers = {
        'user-agent': getRandomUserAgent(),
        'content-type': 'application/json',
        'origin': 'https://shop-id.tokopedia.com',
        'referer': cat.link,
        'accept': 'application/json,*/*;q=0.8'
      };

      const excludeIds: string[] = [];
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        const payload = {
          category_id: parseInt(cat.categoryid),
          exclude_product_ids: excludeIds
        };

        try {
          const res = await axios.post<TikTokProductListResponse>(
            'https://shop-id.tokopedia.com/api/shop/id/home/product_list',
            payload,
            { headers }
          );

          const productList = res.data?.data?.productList ?? [];
          hasMore = res.data?.data?.hasMore ?? false;

          for (const p of productList) {
            const productId = p.product_id;
            const sellerId = p.seller_info?.seller_id;
            const shopName = p.seller_info?.shop_name;
            if (productId && sellerId && shopName) {
              await insertProductIntoDb(db, { productId, sellerId, shopName });
              excludeIds.push(productId);
            }
          }

          console.log(`🛒 Page ${++pageCount}: Inserted ${productList.length} products`);
          await new Promise(res => setTimeout(res, 1000)); // polite delay

        } catch (err) {
          console.warn(`⚠️ API request failed for category ${cat.categoryid}:`, err);
          break;
        }
      }
    }

    console.log(`Scraping finished. Data saved to ${databasePath}`);
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    if (browser) await browser.close();
    if (db) await db.close();
  }
}
