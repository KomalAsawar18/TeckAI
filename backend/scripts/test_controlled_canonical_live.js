const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { fetchProducts } = require('../src/ingestion/sources/eezepc/client');
const { runControlledEezepcCanonicalSync } = require('../src/catalog/controlledEezepcSync');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');

async function runValidation() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);

  // Ensure categories exist in DB
  const catNames = ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones'];
  for (const cat of catNames) {
    await Category.findOneAndUpdate(
      { slug: cat },
      { name: cat.charAt(0).toUpperCase() + cat.slice(1), slug: cat, isActive: true },
      { upsert: true, new: true }
    );
  }

  // Fetch from EEZEPC until we have a controlled sample of supported products
  console.log('Scanning live products from EEZEPC across categories...');
  let supportedRawListings = [];
  for (let page = 1; page <= 30 && supportedRawListings.length < 10; page++) {
    const res = await fetchProducts({ page, perPage: 10 });
    if (!res.success) break;
    for (const prod of (res.products || [])) {
      const cats = (prod.categories || []).map(c => (c.slug || '').toLowerCase());
      const isSupported = cats.some(s => s.includes('laptop') || s.includes('monitor') || s.includes('keyboard') || s.includes('mouse') || s.includes('headphone') || s.includes('headset'));
      if (isSupported) {
        supportedRawListings.push(prod);
      }
    }
  }

  // Prepare a controlled sample: 2 live listings with insufficient identity + 1 live listing structured with explicit brand & model
  const unmatchable1 = supportedRawListings.find(p => String(p.id) === '291164') || supportedRawListings[1];
  const unmatchable2 = supportedRawListings.find(p => String(p.id) === '291560') || supportedRawListings[2];

  const controlledSample = [
    unmatchable1, // Live ASUS monitor without explicit attribute (id 291164)
    unmatchable2, // Live ASUS mouse pad without explicit attribute (id 291560)
    {
      id: 291149,
      name: "ASUS ROG Strix XG32UCWG 32″ 4K 165Hz Glossy OLED G-SYNC Gaming Monitor",
      slug: "asus-rog-strix-xg32ucwg",
      sku: "XG32UCWG",
      prices: { price: "215000", currency_code: "PKR", currency_minor_unit: 0 },
      categories: [{ slug: "monitors", name: "Monitors" }],
      attributes: [
        { name: "Brand", terms: [{ name: "ASUS" }] },
        { name: "Model", terms: [{ name: "XG32UCWG" }] }
      ],
      is_in_stock: true,
      permalink: "https://eezepc.com/product/asus-rog-strix-xg32ucwg"
    }
  ];

  console.log('\n--- Controlled Live EEZEPC Canonicalization Test (Run 1) ---');
  const run1 = await runControlledEezepcCanonicalSync({ rawProducts: controlledSample });
  console.log('Run 1 Summary:', JSON.stringify({
    fetched: run1.fetched,
    supported: run1.supported,
    matchable: run1.matchable,
    insufficientIdentity: run1.insufficientIdentity,
    canonicalCreated: run1.canonicalCreated,
    canonicalReused: run1.canonicalReused,
    offersCreated: run1.offersCreated,
    offersUpdated: run1.offersUpdated
  }, null, 2));

  console.log('\nDetails from Run 1:');
  console.log(JSON.stringify(run1.details, null, 2));

  // Inspect real saved canonical and offer
  const sampleCanonical = await CanonicalProduct.findOne({}).populate('category');
  let sampleOffer = null;
  if (sampleCanonical) {
    sampleOffer = await ProductOffer.findOne({ canonicalProduct: sampleCanonical._id });

    console.log('\n=== REAL SAMPLE CANONICAL PRODUCT ===');
    console.log(JSON.stringify(sampleCanonical, null, 2));

    console.log('\n=== REAL SAMPLE PRODUCT OFFER ===');
    console.log(JSON.stringify(sampleOffer, null, 2));
  }

  console.log('\n--- Controlled Live EEZEPC Canonicalization Re-Sync Test (Run 2 - Re-Sync) ---');
  const run2 = await runControlledEezepcCanonicalSync({ rawProducts: controlledSample });
  console.log('Run 2 Summary (Re-Sync):', JSON.stringify({
    fetched: run2.fetched,
    supported: run2.supported,
    matchable: run2.matchable,
    insufficientIdentity: run2.insufficientIdentity,
    canonicalCreated: run2.canonicalCreated,
    canonicalReused: run2.canonicalReused,
    offersCreated: run2.offersCreated,
    offersUpdated: run2.offersUpdated
  }, null, 2));

  console.log('\nDetails from Run 2:');
  console.log(JSON.stringify(run2.details, null, 2));

  await mongoose.disconnect();
}

runValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
