const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { SOURCE_CATEGORY_CONFIG, runTargetedCategoryCanonicalSync, ensureStandardCategories } = require('../src/catalog/targetedCategoryCanonicalSync');
const { fetchProducts: fetchEezepcProducts } = require('../src/ingestion/sources/eezepc/client');
const { fetchProducts: fetchInfinityProducts } = require('../src/ingestion/sources/infinity/client');
const { mapProduct: mapEezepcProduct, isAccessoryCategory: isEezepcAccessory } = require('../src/ingestion/sources/eezepc/mapper');
const { mapInfinityProduct, isAccessoryCategory: isInfinityAccessory } = require('../src/ingestion/sources/infinity/mapper');
const { runControlledEezepcCanonicalSync } = require('../src/catalog/controlledEezepcSync');
const { runControlledInfinityCanonicalSync } = require('../src/ingestion/sources/infinity/controlledSync');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');

describe('Step 3E.4 — Targeted Laptop & Headphone Canonical Expansion', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await ensureStandardCategories();
  });

  const TEST_KEYS = ['asus|rogdeltas', 'hp|omen16', 'dell|xps13'];

  afterAll(async () => {
    // Clean up test-specific records
    await CanonicalProduct.deleteMany({ canonicalKey: { $in: TEST_KEYS } });
    await ProductOffer.deleteMany({ 'source.listingId': { $regex: /^test-targeted-/ } });
    await ProductOffer.deleteMany({ 'source.listingId': '999111' });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await CanonicalProduct.deleteMany({ canonicalKey: { $in: TEST_KEYS } });
    await ProductOffer.deleteMany({ 'source.listingId': { $regex: /^test-targeted-/ } });
    await ProductOffer.deleteMany({ 'source.listingId': '999111' });
  });

  test('1. Source category metadata mapping is properly configured', () => {
    expect(SOURCE_CATEGORY_CONFIG.EEZEPC.laptops).toContain('laptops');
    expect(SOURCE_CATEGORY_CONFIG.EEZEPC.headphones).toContain('headphones');
    expect(SOURCE_CATEGORY_CONFIG.EEZEPC.headphones).toContain('headsets');
    expect(SOURCE_CATEGORY_CONFIG.INFINITY_STORE.headphones).toContain('headphones');
    expect(SOURCE_CATEGORY_CONFIG.INFINITY_STORE.laptops).toEqual([]); // Documented empty
  });

  test('2. Clients support category-targeted parameter in Store API requests', async () => {
    // Test that client accepts category parameter without throwing validation error
    const eezeRes = await fetchEezepcProducts({ page: 1, perPage: 1, category: 'laptops' });
    expect(eezeRes.success).toBe(true);

    const infRes = await fetchInfinityProducts({ page: 1, perPage: 1, category: 'headphones' });
    expect(infRes.success).toBe(true);
  });

  test('3. Laptop accessory categories and titles are strictly excluded', () => {
    const laptopAccessories = [
      { slug: 'laptop-bag', name: 'Leather Laptop Bag' },
      { slug: 'laptop-sleeves', name: '15-inch Protective Sleeve' },
      { slug: 'laptop-stands', name: 'Aluminium Laptop Stand' },
      { slug: 'cooling-pad', name: 'RGB Laptop Cooling Pad' },
      { slug: 'chargers', name: '65W USB-C Laptop Charger' }
    ];

    for (const item of laptopAccessories) {
      expect(isEezepcAccessory(item.slug, item.name)).toBe(true);
      expect(isInfinityAccessory(item.slug, item.name)).toBe(true);
    }
  });

  test('4. Headphone accessory categories and titles are strictly excluded', () => {
    const headphoneAccessories = [
      { slug: 'headphone-stand', name: 'RGB Headset Stand' },
      { slug: 'headphone-case', name: 'Hard Travel Case for Headphones' },
      { slug: 'earpads', name: 'Memory Foam Replacement Ear Cushions' },
      { slug: 'audio-cables', name: '3.5mm Braided Headset Cable' }
    ];

    for (const item of headphoneAccessories) {
      expect(isEezepcAccessory(item.slug, item.name)).toBe(true);
      expect(isInfinityAccessory(item.slug, item.name)).toBe(true);
    }
  });

  test('5. Cross-source convergence: same brand & model from EEZEPC and Infinity converge to 1 CanonicalProduct with 2 offers', async () => {
    const testListingEEZEPC = {
      id: 'test-targeted-eezepc-headset-1',
      name: 'ASUS ROG DELTA S Wireless Gaming Headset',
      sku: 'ROGDELTAS',
      prices: { price: '45000', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'headsets', name: 'Headsets' }],
      attributes: [
        { name: 'Brand', terms: [{ name: 'ASUS' }] },
        { name: 'Model', terms: [{ name: 'ROGDELTAS' }] }
      ],
      is_in_stock: true,
      permalink: 'https://eezepc.com/product/asus-rog-delta-s'
    };

    const testListingInfinity = {
      id: 999111,
      name: 'ASUS ROG DELTA S Wireless Gaming Headset',
      sku: 'ASUS-ROGDELTAS',
      prices: { price: '4650000', currency_code: 'PKR', currency_minor_unit: 2 },
      categories: [{ id: 267, slug: 'headphones', name: 'Headphones' }],
      attributes: [
        { name: 'Brand', terms: [{ name: 'ASUS' }] },
        { name: 'Model', terms: [{ name: 'ROGDELTAS' }] }
      ],
      is_in_stock: true,
      permalink: 'https://infinitystore.pk/product/asus-rog-delta-s'
    };

    // Run EEZEPC Sync with injected test item
    const eezeSync = await runControlledEezepcCanonicalSync({ rawProducts: [testListingEEZEPC] });
    expect(eezeSync.canonicalCreated).toBe(1);
    expect(eezeSync.offersCreated).toBe(1);

    // Run Infinity Sync with matching product
    const infSync = await runControlledInfinityCanonicalSync({ rawProducts: [testListingInfinity] });
    expect(infSync.canonicalCreated).toBe(0);
    expect(infSync.canonicalReused).toBe(1);
    expect(infSync.offersCreated).toBe(1);

    // Verify 1 Canonical Product with 2 Offers in DB
    const canonical = await CanonicalProduct.findOne({ canonicalKey: 'asus|rogdeltas' });
    expect(canonical).toBeTruthy();
    expect(canonical.brand).toBe('ASUS');
    expect(canonical.model).toBe('ROGDELTAS');

    const offers = await ProductOffer.find({ canonicalProduct: canonical._id });
    expect(offers.length).toBe(2);
    const sourceNames = offers.map(o => o.source.name);
    expect(sourceNames).toContain('EEZEPC');
    expect(sourceNames).toContain('INFINITY_STORE');
  });

  test('6. Idempotency: re-sync updates offers without creating duplicates or clearing affiliate data', async () => {
    const testListing = {
      id: 'test-targeted-eezepc-laptop-1',
      name: 'HP Omen 16 Gaming Laptop',
      sku: 'OMEN16',
      prices: { price: '320000', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'laptops', name: 'Laptops' }],
      attributes: [
        { name: 'Brand', terms: [{ name: 'HP' }] },
        { name: 'Model', terms: [{ name: 'OMEN16' }] }
      ],
      is_in_stock: true,
      permalink: 'https://eezepc.com/product/hp-omen-16'
    };

    // Run 1: Create
    const run1 = await runControlledEezepcCanonicalSync({ rawProducts: [testListing] });
    expect(run1.canonicalCreated).toBe(1);
    expect(run1.offersCreated).toBe(1);

    // Add affiliate metadata to the offer
    const offer = await ProductOffer.findOne({ 'source.listingId': 'test-targeted-eezepc-laptop-1' });
    offer.affiliate = {
      enabled: true,
      url: 'https://affiliate.example.com/click?offer=test-targeted-eezepc-laptop-1',
      campaign: 'laptop_launch_2026'
    };
    await offer.save();

    // Run 2: Re-Sync with updated price
    const updatedListing = {
      ...testListing,
      prices: { price: '315000', currency_code: 'PKR', currency_minor_unit: 0 }
    };
    const run2 = await runControlledEezepcCanonicalSync({ rawProducts: [updatedListing] });
    expect(run2.canonicalCreated).toBe(0);
    expect(run2.canonicalReused).toBe(1);
    expect(run2.offersCreated).toBe(0);
    expect(run2.offersUpdated).toBe(1);

    // Verify DB state: offer price updated, affiliate config preserved
    const refreshedOffer = await ProductOffer.findById(offer._id);
    expect(refreshedOffer.price).toBe(315000);
    expect(refreshedOffer.affiliate.enabled).toBe(true);
    expect(refreshedOffer.affiliate.campaign).toBe('laptop_launch_2026');
  });

  test('7. Failure isolation: unmatchable or error items are skipped without breaking the pipeline', async () => {
    const unmatchableItem = {
      id: 'test-targeted-unmatchable-laptop',
      name: 'Generic Laptop Bag Without Brand Or Model',
      sku: '',
      prices: { price: '5000', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'laptops', name: 'Laptops' }],
      attributes: [],
      is_in_stock: true
    };

    const validItem = {
      id: 'test-targeted-valid-laptop',
      name: 'Dell XPS 13 Laptop',
      sku: 'XPS13',
      prices: { price: '280000', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'laptops', name: 'Laptops' }],
      attributes: [
        { name: 'Brand', terms: [{ name: 'Dell' }] },
        { name: 'Model', terms: [{ name: 'XPS13' }] }
      ],
      is_in_stock: true
    };

    const res = await runControlledEezepcCanonicalSync({ rawProducts: [unmatchableItem, validItem] });
    expect(res.supported).toBe(2);
    expect(res.matchable).toBe(1);
    expect(res.insufficientIdentity).toBe(1);
    expect(res.canonicalCreated).toBe(1);
    expect(res.offersCreated).toBe(1);
  });
});
