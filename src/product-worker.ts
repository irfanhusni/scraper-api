import { chromium, Page } from 'playwright';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import {
  insertProductIntoDb,
  insertCategoryIntoDb,
  initDatabase
} from './db-util';

const dataDir = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDir, 'products.db');

export async function scrapeCategoryLinks(): Promise<void> {
  let browser;
  let page: Page | undefined;
  let db: Database | undefined;

  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });
    await initDatabase(db);
    console.log('📊 SQLite initialized at:', databasePath);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    const baseURL = 'https://shop-id.tokopedia.com/c';

    console.log('🌐 Navigating to', baseURL);
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
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

    console.log(`🔍 Found ${topCategories.length} top-level categories`);

    for (const cat of topCategories) {
      await insertCategoryIntoDb(db, { categoryId: cat.categoryid, link: cat.link });
      console.log(`📥 Inserted category: ${cat.link}`);

      try {
        await page.goto(cat.link, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(2000);

        const scripts = await page.$$('script[data-fn-args]');
        if (scripts.length >= 2) {
          const content = await scripts[1].getAttribute('data-fn-args');
          if (content) {
            try {
              const parsed = JSON.parse(content);
              const productList = Array.isArray(parsed) && parsed[2]?.currentProductsInfo?.productList;
              if (Array.isArray(productList)) {
                for (const p of productList) {
                  const productId = p.product_id;
                  const sellerId = p.seller_info?.seller_id;
                  const shopName = p.seller_info?.shop_name;
                  if (productId && sellerId && shopName) {
                    await insertProductIntoDb(db, { productId, sellerId, shopName });
                  }
                }
                console.log(`✅ Inserted ${productList.length} products for ${cat.link}`);
              }
            } catch (err) {
              console.warn(`⚠️ Failed to parse data-fn-args for ${cat.link}:`, err);
            }
          }
        }

        const subSelector = 'a.category-item-Y9CQFP[href^="https://shop-id.tokopedia.com/c/"]';
        const subExists = await page.$(subSelector);

        if (subExists) {
          const subCategories = await page.$$eval(subSelector, (anchors) =>
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

          for (const sub of subCategories) {
            await insertCategoryIntoDb(db, { categoryId: sub.categoryid, link: sub.link });
            console.log(`   ↳ Subcategory inserted: ${sub.link}`);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to process ${cat.link}:`, err);
      }
    }

    console.log(`🎉 Scraping finished. Data saved to ${databasePath}`);
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    if (browser) await browser.close();
    if (db) await db.close();
  }
}
