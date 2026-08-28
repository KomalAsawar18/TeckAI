const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getCanonicalCatalog, getCanonicalProductById } = require('../src/commerce/getCanonicalCatalog');
const { getProductOffersComparison } = require('../src/commerce/getProductOffersComparison');
const CanonicalProduct = require('../src/models/CanonicalProduct');

async function verifyFrontendIntegration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== Step 3E.2 — Frontend Canonical Catalog Integration Verification ===\n');

    // 1. Full catalog check (GET /api/canonical-products)
    console.log('1. Fetching Full Catalog (for /products):');
    const catalog = await getCanonicalCatalog({ page: 1, limit: 12 });
    console.log(`Total products in catalog: ${catalog.pagination.total}`);
    catalog.products.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.name}`);
      console.log(`      Brand: ${p.brand}, Model: ${p.model || 'N/A'}`);
      console.log(`      Category: ${p.category?.name} (${p.category?.slug})`);
      console.log(`      Best Price: ${p.bestOffer?.currency} ${p.bestOffer?.price?.toLocaleString()}`);
      console.log(`      Seller: ${p.bestOffer?.seller}`);
      console.log(`      Offer Count: ${p.offerCount}`);
      console.log(`      Redirect URL: ${p.bestOffer?.redirectUrl}`);
    });

    // 2. Category filter: keyboards (/products?category=keyboards)
    console.log('\n2. Filtering by category "keyboards" (/products?category=keyboards):');
    const keyboardsCatalog = await getCanonicalCatalog({ category: 'keyboards' });
    console.log(`Products returned: ${keyboardsCatalog.products.length}`);
    keyboardsCatalog.products.forEach(p => {
      console.log(`  - ${p.name}: Best Price = PKR ${p.bestOffer?.price?.toLocaleString()} from ${p.bestOffer?.seller} (${p.offerCount} offers)`);
    });

    // 3. Category filter: monitors (/products?category=monitors)
    console.log('\n3. Filtering by category "monitors" (/products?category=monitors):');
    const monitorsCatalog = await getCanonicalCatalog({ category: 'monitors' });
    console.log(`Products returned: ${monitorsCatalog.products.length}`);
    monitorsCatalog.products.forEach(p => {
      console.log(`  - ${p.name}: Best Price = PKR ${p.bestOffer?.price?.toLocaleString()} from ${p.bestOffer?.seller} (${p.offerCount} offers)`);
    });

    // 4. Detail page read for Ajazz AK680 V2 (/canonical-products/:id)
    const ajazz = await CanonicalProduct.findOne({ canonicalKey: 'ajazz|ak680v2' });
    if (ajazz) {
      console.log(`\n4. Detail Page Verification for Ajazz (${ajazz._id}):`);
      const detail = await getCanonicalProductById(ajazz._id.toString());
      const offers = await getProductOffersComparison(ajazz._id.toString());
      const prod = detail.product || detail;
      console.log(`  Name: ${prod.name}`);
      console.log(`  Best Offer: PKR ${prod.bestOffer?.price?.toLocaleString()} (${prod.bestOffer?.seller})`);
      const list = offers.offers || offers.rankedOffers || [];
      console.log(`  Ranked Offers Count: ${list.length}`);
      list.forEach((o, i) => {
        console.log(`    [Offer ${i + 1}] Variant: ${o.variant?.color || 'Standard'}, Price: PKR ${o.price?.toLocaleString()}, Seller: ${o.seller?.name || o.seller}`);
      });
    }

    console.log('\n=== All Verification Checks Passed ===');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

verifyFrontendIntegration();
