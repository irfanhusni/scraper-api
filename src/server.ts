import express, { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { scrapeSearchByCategory, scrapeSearchByShop, scrapeProductDetail } from './scrapper';
import { getProductsBySellerIdFromDb, getLinkCategoryByCategoryId } from './db-util';

const app = express();
const PORT = 3000;

const productDetailCache = new NodeCache({ stdTTL: 300 });
const productByShopIDCache = new NodeCache({ stdTTL: 300 });
const productByCategoryCache = new NodeCache({ stdTTL: 300 });

app.get('/tiktok/search-by-category', async (req: Request, res: Response) => {
  const categoryId = req.query.categoryid as string;
  if (!categoryId) {
    return res.status(400).json({ error: 'Missing categoryid in query' });
  }

  const cached = productByCategoryCache.get<{ data: any; scrapedAt: string }>(categoryId);
  if (cached) {
    return res.json({ source: 'cache', scrapedAt: cached.scrapedAt, data: cached.data });
  }

  try {
    const link = await getLinkCategoryByCategoryId(categoryId);
    if (!link) {
      return res.status(404).json({ error: `Category ID ${categoryId} not found` });
    }

    const result = await scrapeSearchByCategory(link);
    const scrapedAt = new Date().toISOString();
    productByCategoryCache.set(categoryId, { data: result, scrapedAt })

    return res.json({
      source: 'scraper',
      scrapedAt: new Date().toISOString(),
      data: result,
    });
  } catch (err) {
    console.error('❌ Scraping failed:', err);
    return res.status(500).json({ error: 'Scraper crashed' });
  }
});

app.get('/tiktok/search-by-shop', async (req: Request, res: Response) => {
  const seller = req.query.seller as string;
  if (!seller) {
    return res.status(400).json({ error: 'Missing seller' });
  }

  const cached = productByShopIDCache.get<{ data: any; scrapedAt: string }>(seller);
  if (cached) {
    return res.json({ source: 'cache', scrapedAt: cached.scrapedAt, data: cached.data });
  }

  try {
    const productIds = await getProductsBySellerIdFromDb(seller);
    if (productIds.length === 0) {
      return res.status(404).json({ message: `No products found for seller: ${seller}` });
    }

    const result = await scrapeSearchByShop(productIds);
    const scrapedAt = new Date().toISOString();
    productByShopIDCache.set(seller, { data: result, scrapedAt });

    return res.json({ source: 'scraper', scrapedAt, data: result });
  } catch (err) {
    console.error('❌ Scraping failed:', err);
    return res.status(500).json({ error: 'Scraper crashed' });
  }
});

app.get('/tiktok/product-detail', async (req: Request, res: Response) => {
  const productId = req.query.productId as string;
  if (!productId) {
    return res.status(400).json({ error: 'Missing productId' });
  }

  const cached = productDetailCache.get<{ data: any; scrapedAt: string }>(productId);
  if (cached) {
    return res.json({ source: 'cache', scrapedAt: cached.scrapedAt, data: cached.data });
  }

  try {
    const result = await scrapeProductDetail(productId);
    const scrapedAt = new Date().toISOString();
    productDetailCache.set(productId, { data: result, scrapedAt });

    return res.json({ source: 'scraper', scrapedAt, data: result });
  } catch (err) {
    console.error('❌ Scraper failed:', err);
    return res.status(500).json({ error: 'Scraper crashed' });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.send('OK');
});

app.listen(PORT, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`);
});
