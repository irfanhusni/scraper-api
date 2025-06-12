import axios from 'axios';
import { chromium, Page } from 'playwright';
import { getRandomUserAgent } from './random-ua-util';

interface TikTokProduct {
  product_id: string;
  title: string;
  image: {
    height: number;
    width: number;
    uri: string;
    url_list: string[];
  };
  product_price_info: {
    sku_id: string;
    symbol_position: number;
    show_currency_space: boolean;
    currency_show_mode: number;
    currency_name: string;
    currency_symbol: string;
    sale_price_decimal: string;
    origin_price_decimal: string;
    sale_price_format: string;
    origin_price_format: string;
    discount_format: string;
    discount_decimal: string;
    reduce_price_format: string;
    single_product_price_format: string;
    single_product_price_decimal: string;
    promotion_deduction_details: {
      seller_subtotal_deduction: string;
      seller_subtotal_deduction_decimal: string;
    };
  };
  rate_info: {
    score: number;
    review_count: string;
  };
  sold_info: {
    sold_count: number;
  };
  seller_info: {
    seller_id: string;
    shop_name: string;
    shop_logo: {
      height: number;
      width: number;
      uri: string;
      url_list: string[];
    };
  };
  seo_url: {
    updated_at: string;
    canonical_url: string;
    slug: string;
    type: number;
    version: number;
  };
  seo_pdp_url: string;
}

interface TikTokProductListResponse {
  code: number;
  message: string;
  data: {
    productList: TikTokProduct[];
    hasMore: boolean;
  };
}

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

export async function scrapeSearchByCategoryWithoutUI(categoryLink: string): Promise<TikTokProduct[]> {
  const userAgent = getRandomUserAgent();

  // Extract numeric category ID from the link
  const match = categoryLink.match(/\/c\/[a-zA-Z0-9-]+\/(\d+)/);
  const categoryId = match ? parseInt(match[1]) : null;

  if (!categoryId) {
    throw new Error(`Invalid category link: ${categoryLink}`);
  }

  const headers = {
    'user-agent': userAgent,
    'content-type': 'application/json',
    'origin': 'https://shop-id.tokopedia.com',
    'referer': categoryLink,
    'accept': 'application/json,*/*;q=0.8'
  };

  const allProducts: TikTokProduct[] = [];
  const excludeIds: string[] = [];
  let hasMore = true;

  while (hasMore) {
    const payload = {
      category_id: categoryId,
      exclude_product_ids: excludeIds
    };

    const res = await axios.post<TikTokProductListResponse>(
      'https://shop-id.tokopedia.com/api/shop/id/home/product_list',
      payload,
      { headers }
    );

    const productList = res.data?.data?.productList ?? [];
    hasMore = res.data?.data?.hasMore ?? false;

    for (const product of productList) {
      if (product.product_id) {
        allProducts.push(product);
        excludeIds.push(product.product_id);
      }
    }

    await new Promise(res => setTimeout(res, 1000)); // polite delay
  }

  return allProducts;
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
