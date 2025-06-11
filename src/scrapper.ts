import axios from 'axios';
import { chromium, Page } from 'playwright';
import { getRandomUserAgent } from './random-ua-util';

function randomDelay(min = 300, max = 1000) {
  return new Promise(res => setTimeout(res, Math.random() * (max - min) + min));
}

async function autoScroll(page: Page, maxScrolls = 5, delay = 1000) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(delay);
  }
}

export async function scrapeSearchByCategory(categoryLink: string): Promise<any[]> {
  const userAgent = getRandomUserAgent();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    locale: 'id-ID'
  });

  const page = await context.newPage();
  await page.goto(categoryLink, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await autoScroll(page);

  const products = await page.$$eval('div.product-wrapper', (cards) =>
    cards.map(card => {
      const img = card.querySelector('img')?.getAttribute('src') ?? null;
      const name = card.querySelector('h3')?.textContent?.trim() ?? null;
      const score = card.querySelector('.score span')?.textContent?.trim() ?? null;
      const sold = card.querySelector('.sold span')?.textContent?.trim() ?? null;
      const salePrice = card.querySelector('.sale-price .price')?.textContent?.trim() ?? null;
      const spans = card.querySelectorAll('.origin-price span');
      const originalPrice = spans.length > 1 ? spans[1].textContent?.trim() ?? null : null;
      const href = card.querySelector('a[href]')?.getAttribute('href') ?? null;

      return { productName: name, score, sold, salePrice, originalPrice, image: img, href };
    })
  );

  await browser.close();
  return products;
}

export async function scrapeSearchByShop(productIds: string[]): Promise<any[]> {
  const results: any[] = [];

  for (const productId of productIds) {
    const detail = await scrapeProductDetail(productId);
    if (detail) {
      results.push(detail);
    }
  }

  return results;
}

export async function scrapeProductDetail(productId: string): Promise<any> {
  const userAgent = getRandomUserAgent();
  const url = 'https://shop-id.tokopedia.com/api/shop/product/pdp_data';

  const headers = {
    'user-agent': userAgent,
    'content-type': 'application/json',
    origin: 'https://shop-id.tokopedia.com',
    referer: `https://shop-id.tokopedia.com/pdp/produk/${productId}`
  };

  const data = {
    getProductCategoryInfoSchema: {
      categoryIdList: []
    },
    getPdpRelatedKwSchema: {
      product_id: productId,
      traffic_type: 0
    },
    getProductsForComponentListSchema: [],
    getProductDetailSchema: {
      productId,
      region: 'ID',
      userId: '0',
      securityParams: ''
    }
  };

  const response = await axios.post(url, data, { headers });
  return response.data;
}
