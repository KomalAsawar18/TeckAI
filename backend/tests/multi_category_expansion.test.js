const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');
const { runControlledEezepcCanonicalSync } = require('../src/catalog/controlledEezepcSync');
const { runControlledInfinityCanonicalSync } = require('../src/ingestion/sources/infinity/controlledSync');
const { runMultiSourceCanonicalSync } = require('../src/catalog/multiSourceCanonicalSync');
const { getCanonicalCatalog } = require('../src/commerce/getCanonicalCatalog');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

describe('Step 3E.3 — Multi-Category Canonical Expansion & Cross-Source Convergence Tests', () => {
  let categories = {};

  beforeAll(async () => {
    await connectTestDB();

    // Ensure 5 supported category documents exist
    const slugs = ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones'];
    for (const slug of slugs) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      let cat = await Category.findOne({ slug });
      if (!cat) {
        cat = await Category.create({ name, slug, isActive: true });
      }
      categories[slug] = cat;
    }
  });

  afterAll(async () => {
    // Clean up test data
    await CanonicalProduct.deleteMany({ canonicalKey: { $regex: /^test/ } });
    await ProductOffer.deleteMany({ 'source.listingId': { $regex: /^test-expansion-/ } });
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await CanonicalProduct.deleteMany({ canonicalKey: { $regex: /^test/ } });
    await ProductOffer.deleteMany({ 'source.listingId': { $regex: /^test-expansion-/ } });
  });

  describe('1. Bounded Multi-Page & Category Metrics', () => {
    test('accurately processes multi-category fixtures and produces category-level metrics', async () => {
      const multiCategoryFixtures = [
        // Keyboard (Matchable)
        {
          id: 'test-expansion-kb-1',
          name: 'TestAjazz AK680 V2 Gaming Keyboard',
          slug: 'testajazz-ak680-v2',
          brand: 'TestAjazz',
          categories: [{ slug: 'gaming-keyboards', name: 'Gaming Keyboards' }],
          prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'Model', terms: [{ name: 'AK680V2' }] },
            { name: 'Color', terms: [{ name: 'Starry Sky Gray' }] }
          ],
          is_in_stock: true
        },
        // Mouse (Matchable)
        {
          id: 'test-expansion-ms-1',
          name: 'TestLogitech G Pro X Superlight Wireless Mouse',
          slug: 'testlogitech-g-pro-x-superlight',
          brand: 'TestLogitech',
          categories: [{ slug: 'gaming-mouse', name: 'Gaming Mouse' }],
          prices: { price: '32000', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'Model', terms: [{ name: 'G Pro X Superlight' }] }
          ],
          is_in_stock: true
        },
        // Monitor (Matchable)
        {
          id: 'test-expansion-mon-1',
          name: 'TestASUS ROG Strix XG32UCWG Gaming Monitor',
          slug: 'testasus-xg32ucwg',
          brand: 'TestASUS',
          categories: [{ slug: 'gaming-monitors', name: 'Gaming Monitors' }],
          prices: { price: '55000', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'Model', terms: [{ name: 'XG32UCWG' }] }
          ],
          is_in_stock: true
        },
        // Mouse Pad (Accessory - Should be skipped)
        {
          id: 'test-expansion-pad-1',
          name: 'TestASUS ROG Hone Ace XXL Mouse Pad',
          slug: 'testasus-rog-hone-ace',
          brand: 'TestASUS',
          categories: [{ slug: 'mouse-pads', name: 'Mouse Pads' }],
          prices: { price: '8000', currency_code: 'PKR', currency_minor_unit: 0 },
          is_in_stock: true
        },
        // Headphone with insufficient model (Unmatchable)
        {
          id: 'test-expansion-hp-1',
          name: 'TestSony Wireless Premium Headset',
          slug: 'testsony-wireless-headset',
          brand: 'TestSony',
          categories: [{ slug: 'gaming-headphones', name: 'Gaming Headphones' }],
          prices: { price: '25000', currency_code: 'PKR', currency_minor_unit: 0 },
          is_in_stock: true
        }
      ];

      const res = await runControlledEezepcCanonicalSync({ rawProducts: multiCategoryFixtures });
      expect(res.success).toBe(true);
      expect(res.fetched).toBe(5);
      expect(res.supported).toBe(4);
      expect(res.matchable).toBe(3);
      expect(res.insufficientIdentity).toBe(1);
      expect(res.skipped).toBe(1); // Mouse pad skipped

      // Verify category metrics
      expect(res.categories.keyboards.matchable).toBe(1);
      expect(res.categories.keyboards.canonicalCreated).toBe(1);

      expect(res.categories.mouse.matchable).toBe(1);
      expect(res.categories.mouse.canonicalCreated).toBe(1);

      expect(res.categories.monitors.matchable).toBe(1);
      expect(res.categories.monitors.canonicalCreated).toBe(1);

      expect(res.categories.headphones.insufficientIdentity).toBe(1);
      expect(res.categories.headphones.matchable).toBe(0);
    });
  });

  describe('2. Idempotency & Re-Sync Integrity', () => {
    test('re-syncing existing products updates offers and creates 0 duplicate canonical records', async () => {
      const sample = [
        {
          id: 'test-expansion-idem-1',
          name: 'TestAjazz AK680 V2 Gaming Keyboard',
          slug: 'testajazz-ak680-v2',
          brand: 'TestAjazz',
          categories: [{ slug: 'gaming-keyboards', name: 'Gaming Keyboards' }],
          prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [{ name: 'Model', terms: [{ name: 'AK680V2' }] }],
          is_in_stock: true
        }
      ];

      // First run: creates
      const run1 = await runControlledEezepcCanonicalSync({ rawProducts: sample });
      expect(run1.canonicalCreated).toBe(1);
      expect(run1.offersCreated).toBe(1);

      // Second run: reuses & updates
      const run2 = await runControlledEezepcCanonicalSync({ rawProducts: sample });
      expect(run2.canonicalCreated).toBe(0);
      expect(run2.canonicalReused).toBe(1);
      expect(run2.offersCreated).toBe(0);
      expect(run2.offersUpdated).toBe(1);

      // Verify exact count in MongoDB
      const canonicalCount = await CanonicalProduct.countDocuments({ canonicalKey: 'testajazz|ak680v2' });
      expect(canonicalCount).toBe(1);

      const offerCount = await ProductOffer.countDocuments({ 'source.listingId': 'test-expansion-idem-1' });
      expect(offerCount).toBe(1);
    });
  });

  describe('3. Cross-Source Canonical Convergence', () => {
    test('converges EEZEPC and Infinity listings for the same trustworthy brand+model to one CanonicalProduct', async () => {
      // 1. EEZEPC listing for TestAjazz AK680 V2
      const eezepcRaw = [
        {
          id: 'test-expansion-cross-eeze-1',
          name: 'TestAjazz AK680 V2 Magnetic Switch Gaming Keyboard',
          slug: 'testajazz-ak680-v2-eeze',
          brand: 'TestAjazz',
          categories: [{ slug: 'keyboards', name: 'Keyboards' }],
          prices: { price: '11000', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'Model', terms: [{ name: 'AK680V2' }] },
            { name: 'Color', terms: [{ name: 'Blue White' }] }
          ],
          is_in_stock: true
        }
      ];

      // 2. Infinity Store listing for TestAjazz AK680 V2
      const infinityRaw = [
        {
          id: 'test-expansion-cross-inf-1',
          name: 'TestAjazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
          slug: 'testajazz-ak680-v2-inf',
          categories: [{ id: 10, name: 'Keyboards', slug: 'keyboards' }],
          prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'pa_brand', terms: [{ name: 'TestAjazz' }] },
            { name: 'Model', terms: [{ name: 'AK680V2' }] },
            { name: 'Color', terms: [{ name: 'Starry Sky Gray' }] }
          ],
          sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
          is_in_stock: true
        }
      ];

      // Run both syncs
      const eezeRes = await runControlledEezepcCanonicalSync({ rawProducts: eezepcRaw });
      const infRes = await runControlledInfinityCanonicalSync({ rawProducts: infinityRaw });

      expect(eezeRes.matchable).toBe(1);
      expect(infRes.matchable).toBe(1);

      // Verify only 1 CanonicalProduct was created for canonicalKey = testajazz|ak680v2
      const canonicals = await CanonicalProduct.find({ canonicalKey: 'testajazz|ak680v2' });
      expect(canonicals.length).toBe(1);

      // Verify 2 distinct offers are attached to the same CanonicalProduct
      const offers = await ProductOffer.find({ canonicalProduct: canonicals[0]._id });
      const testOffers = offers.filter(o => o.source?.listingId?.startsWith('test-expansion-cross-'));
      expect(testOffers.length).toBe(2);

      const sources = testOffers.map(o => o.source.name);
      expect(sources).toContain('EEZEPC');
      expect(sources).toContain('INFINITY_STORE');

      // Test multi-source sync detection
      const multiSync = await runMultiSourceCanonicalSync({
        eezepc: { rawProducts: [] },
        infinity: { rawProducts: [] }
      });

      const ajazzMatch = multiSync.crossSourceMatches.find(m => m.canonicalKey === 'testajazz|ak680v2');
      expect(ajazzMatch).toBeDefined();
      expect(ajazzMatch.sources).toContain('EEZEPC');
      expect(ajazzMatch.sources).toContain('INFINITY_STORE');
      expect(ajazzMatch.bestPrice).toBe(10500);
    });
  });

  describe('4. Failure Isolation & Quality Checks', () => {
    test('isolates failure of one source and continues processing other sources safely', async () => {
      const validInfinityRaw = [
        {
          id: 'test-expansion-iso-inf-1',
          name: 'TestAjazz AK680 V2 Magnetic Switch Gaming Keyboard',
          slug: 'testajazz-ak680-v2-iso',
          categories: [{ id: 10, name: 'Keyboards', slug: 'keyboards' }],
          prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
          attributes: [
            { name: 'pa_brand', terms: [{ name: 'TestAjazz' }] },
            { name: 'Model', terms: [{ name: 'AK680V2' }] }
          ],
          sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
          is_in_stock: true
        }
      ];

      const multiSync = await runMultiSourceCanonicalSync({
        eezepc: { rawProducts: [null] }, // Intentionally bad item that handles error gracefully
        infinity: { rawProducts: validInfinityRaw }
      });

      expect(multiSync.sources.infinity.success).toBe(true);
      expect(multiSync.sources.infinity.matchable).toBe(1);
      expect(multiSync.totals.matchable).toBeGreaterThanOrEqual(1);
    });
  });
});
