const mongoose = require('mongoose');
const { syncProducts, syncPages } = require('./src/ingestion/sources/eezepc/sync');
const Product = require('./src/models/Product');
const Category = require('./src/models/Category');
require('dotenv').config();

async function run() {
  let uri = process.env.MONGODB_URI;
  if (uri && uri.includes('?')) {
    const parts = uri.split('?');
    if (parts[0].endsWith('/')) parts[0] += 'teckai_test';
    else {
      const lastSlash = parts[0].lastIndexOf('/');
      parts[0] = parts[0].substring(0, lastSlash + 1) + 'teckai_test';
    }
    uri = parts.join('?');
  }
  await mongoose.connect(uri);
  
  await Product.deleteMany({});
  await Category.deleteMany({});
  
  await Category.create([
    { name: 'Laptops', slug: 'laptops', isActive: true },
    { name: 'Mouse', slug: 'mouse', isActive: true }
  ]);
  
  // mock fetch
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ([
      {
        id: 111,
        name: 'HP Victus 15',
        slug: 'hp-victus-15',
        sku: 'SKU-111',
        description: 'desc',
        prices: { price: '150000', currency_code: 'PKR', currency_minor_unit: 0 },
        is_in_stock: true,
        categories: [{ name: 'laptops', slug: 'laptops' }],
        images: [],
        attributes: []
      }
    ])
  });

  const summary = await syncProducts({ page: 1, perPage: 1 });
  console.log("Summary:", summary);

  const docs = await Product.find({});
  console.log("Docs in DB:", docs.length);
  
  await mongoose.disconnect();
}
run().catch(console.error);
