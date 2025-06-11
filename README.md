# 🕵️ Scapper API

A lightweight API and background worker to scrape product details, categories, and seller listings. Built with TypeScript, Express, Playwright, and SQLite.

---

## 📦 Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Playwright](https://playwright.dev/docs/intro)
- SQLite3 (for local data storage)

---

## 🚀 Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd scapper-api

# Install dependencies
npm install

# Install Playwright browsers (first-time only)
npx playwright install
```

---

## API Endpoints

### GET `/tiktok/search-by-category`

Scrape products by category ID.

**Query Parameters:**
- `categoryid` (required)

**Example:**
```bash
curl 'http://localhost:3000/tiktok/search-by-category?categoryid=842888'
```

### GET `/tiktok/search-by-shop`

Scrape products by seller name or ID (matches sellerId or shopName).

**Query Parameters:**
- `seller` (required)

**Example:**
```bash
curl 'http://localhost:3000/tiktok/search-by-shop?seller=7494922665450703600'
curl 'http://localhost:3000/tiktok/search-by-shop?seller='1000 BUKU''
```


### GET `/tiktok/product-detail`

Fetch product detail by product ID.

**Query Parameters:**
- `productId` (required)

**Example:**
```bash
curl 'http://localhost:3000/tiktok/product-detail?productId=1729715253716093680'
```

---

## 🗃️ Database Schema

The project uses a local SQLite database (`products.db`) to persist scraped category and product information.

---

### 📦 `products` Table

Stores metadata about products for detail enrichment.

| Column      | Type  | Description                          |
|-------------|-------|--------------------------------------|
| `productId` | TEXT  | **Primary key** – Unique product ID  |
| `sellerId`  | TEXT  | Internal seller identifier           |
| `shopName`  | TEXT  | Display name of the shop             |
| `createdAt` | TEXT  | First time this product was stored   |
| `updatedAt` | TEXT  | Last updated time (upserted)         |

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS products (
  productId TEXT PRIMARY KEY,
  sellerId TEXT,
  shopName TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
```

### 🗂️ `categories` Table

Stores all top-level and subcategory links discovered by the scraper.

| Column       | Type  | Constraints        | Description                                      |
|--------------|-------|--------------------|--------------------------------------------------|
| `categoryId` | TEXT  | PRIMARY KEY        | Numeric ID extracted from the category URL       |
| `link`       | TEXT  | UNIQUE             | Full URL to the category page                    |
| `createdAt`  | TEXT  | DEFAULT: now (UTC) | Timestamp when the category was first inserted   |
| `updatedAt`  | TEXT  | DEFAULT: now (UTC) | Timestamp when the category was last upserted    |

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS categories (
  categoryId TEXT PRIMARY KEY,
  link TEXT UNIQUE,
  createdAt TEXT,
  updatedAt TEXT
);
```

## 🚀 How to Run

This project contains two main parts:

1. **Product Worker** — Scrapes category and product data and stores it into a local SQLite database.
2. **API Server** — Serves endpoints that retrieve and return product data, which depends on the worker's output.

> ⚠️ **Important:** You must run the worker first before accessing any API endpoint, because the database must be populated with category/product data.

---

### 📦 Step 1: Install Dependencies

Make sure you're using Node.js 18+ and run:

```bash
npm install
```

Install Playwright browsers (only needed once):

```bash
npx playwright install
```

---

### 🛠️ Step 2: Run the Worker

The worker scrapes all category and product data from Tokopedia and saves it into `data/products.db`.

```bash
npx ts-node src/worker.ts
```
---

### 🌐 Step 3: Start the API Server

Once the database is populated by the worker, you can start the API server:

```bash
npm run dev
```

This runs the API on:

```
http://localhost:3000
```


