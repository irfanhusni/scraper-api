import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDir, 'products.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const insertedProductIds = new Set<string>();
const insertedCategoryIds = new Set<string>();

export async function getProductsBySellerIdFromDb(seller: string): Promise<string[]> {
  let db: Database | undefined;
  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });

    const products = await db.all<Array<{ productId: string }>>(
      `SELECT productId FROM products WHERE sellerId = ? OR lower(shopname) LIKE lower(?)`,
      seller,
      `%${seller}%`
    );

    return products.map(p => p.productId);
  } catch (error) {
    console.error(`❌ DB error (products by sellerId ${seller}):`, error);
    return [];
  } finally {
    if (db) await db.close();
  }
}

export async function getLinkCategoryByCategoryId(categoryId: string): Promise<string> {
  let db: Database | undefined;
  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });

    const result = await db.get<{ link: string }>(
      `SELECT link FROM categories WHERE categoryId = ?`,
      categoryId
    );

    return result?.link || "";
  } catch (error) {
    console.error(`❌ DB error (category link for ${categoryId}):`, error);
    return "";
  } finally {
    if (db) await db.close();
  }
}

export async function insertProductIntoDb(db: Database, item: { productId: string; sellerId: string; shopName: string }): Promise<void> {
  if (insertedProductIds.has(item.productId)) return;
  try {
    await db.run(
      `INSERT INTO products (productId, sellerId, shopName, createdAt, updatedAt)
       VALUES (?, ?, ?, DATETIME('now'), DATETIME('now'))
       ON CONFLICT(productId) DO UPDATE SET
         sellerId = excluded.sellerId,
         shopName = excluded.shopName,
         updatedAt = DATETIME('now')`,
      item.productId, item.sellerId, item.shopName
    );
    insertedProductIds.add(item.productId);
  } catch (error) {
    console.error(`❌ Failed to insert product ID ${item.productId}:`, error);
  }
}

export async function insertCategoryIntoDb(db: Database, item: { categoryId: string; link: string }): Promise<void> {
  if (insertedCategoryIds.has(item.categoryId)) return;
  try {
    await db.run(
      `INSERT INTO categories (categoryId, link, createdAt, updatedAt)
       VALUES (?, ?, DATETIME('now'), DATETIME('now'))
       ON CONFLICT(categoryId) DO UPDATE SET
         link = excluded.link,
         updatedAt = DATETIME('now')`,
      item.categoryId, item.link
    );
    insertedCategoryIds.add(item.categoryId);
  } catch (error) {
    console.error(`❌ Failed to insert category ID ${item.categoryId}:`, error);
  }
}

export async function initDatabase(db: Database): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      productId TEXT PRIMARY KEY,
      sellerId TEXT,
      shopName TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      categoryId TEXT PRIMARY KEY,
      link TEXT UNIQUE,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);
} 