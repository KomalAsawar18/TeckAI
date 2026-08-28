const mongoose = require('mongoose');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');
const { canonicalizeListing } = require('../src/catalog/canonicalizeListing');
const { upsertProductOffer } = require('../src/catalog/upsertProductOffer');
const { runControlledEezepcCanonicalSync } = require('../src/catalog/controlledEezepcSync');

require('dotenv').config();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  
  let uri = process.env.MONGODB_URI;
  if (uri) {
    if (uri.includes('?')) {
      const parts = uri.split('?');
      if (parts[0].endsWith('/')) {
        parts[0] += 'teckai_test';
      } else {
        const lastSlash = parts[0].lastIndexOf('/');
        parts[0] = parts[0].substring(0, lastSlash + 1) + 'teckai_test';
      }
      uri = parts.join('?');
    } else {
      if (uri.endsWith('/')) {
        uri += 'teckai_test';
      } else {
        const lastSlash = uri.lastIndexOf('/');
        if (lastSlash > uri.indexOf('://') + 2) {
          uri = uri.substring(0, lastSlash + 1) + 'teckai_test';
        } else {
          uri += '/teckai_test';
        }
      }
    }
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  // Clean up categories to prevent cross-test contamination (E11000 duplicate key)
  await Category.deleteMany({});
  await CanonicalProduct.deleteMany({});
  await ProductOffer.deleteMany({});
  await mongoose.disconnect();
});

describe('Canonical Product & ProductOffer Persistence Pipeline (Step 3B)', () => {
  let laptopsCategory;
  let monitorsCategory;

  beforeEach(async () => {
    await CanonicalProduct.deleteMany({});
    await ProductOffer.deleteMany({});
    await Category.deleteMany({});

    await CanonicalProduct.syncIndexes();
    await ProductOffer.syncIndexes();

    laptopsCategory = await Category.create({
      name: 'Laptops',
      slug: 'laptops',
      isActive: true
    });

    monitorsCategory = await Category.create({
      name: 'Monitors',
      slug: 'monitors',
      isActive: true
    });
  });

  describe('1. Canonicalization & First-Run Creation', () => {
    it('creates a new CanonicalProduct and ProductOffer for a trustworthy listing', async () => {
      const listing = {
        name: 'ASUS ROG Zephyrus G14 (2024)',
        brand: 'ASUS',
        category: 'laptops',
        description: 'Ultra-thin gaming laptop with OLED display',
        images: ['https://eezepc.com/g14.jpg'],
        specifications: {
          model: 'GA403UI',
          processor: 'AMD Ryzen 9 8945HS',
          gpu: 'RTX 4070'
        },
        price: 520000,
        currency: 'PKR',
        availability: 'in_stock',
        source: {
          name: 'EEZEPC',
          listingId: '5001',
          url: 'https://eezepc.com/product/5001',
          type: 'api'
        },
        seller: {
          name: 'EEZEPC Pakistan',
          type: 'retailer'
        }
      };

      const result = await canonicalizeListing(listing);
      expect(result.success).toBe(true);
      expect(result.canonicalOperation).toBe('created');
      expect(result.offerOperation).toBe('created');
      expect(result.canonicalKey).toBe('asus|ga403ui');

      // Verify DB entries
      const canonical = await CanonicalProduct.findById(result.canonicalProductId);
      expect(canonical).not.toBeNull();
      expect(canonical.canonicalKey).toBe('asus|ga403ui');
      expect(canonical.brand).toBe('ASUS');
      expect(canonical.model).toBe('GA403UI');
      expect(canonical.specifications.processor).toBe('AMD Ryzen 9 8945HS');

      const offer = await ProductOffer.findById(result.offerId);
      expect(offer).not.toBeNull();
      expect(offer.canonicalProduct.toString()).toBe(canonical._id.toString());
      expect(offer.price).toBe(520000);
      expect(offer.source.name).toBe('EEZEPC');
      expect(offer.source.listingId).toBe('5001');
    });

    it('reuses existing CanonicalProduct when a second listing shares the same brand and model', async () => {
      const listing1 = {
        name: 'ASUS TUF A15 FA507NV First Listing',
        brand: 'ASUS',
        category: 'laptops',
        specifications: { model: 'FA507NV' },
        price: 310000,
        source: { name: 'EEZEPC', listingId: '5002' }
      };

      const result1 = await canonicalizeListing(listing1);
      expect(result1.canonicalOperation).toBe('created');

      // Listing 2 from another retailer or second batch with same brand & model
      const listing2 = {
        name: 'ASUS TUF Gaming Laptop FA507NV Different Seller',
        brand: 'ASUS',
        category: 'laptops',
        specifications: { model: 'FA507NV' },
        price: 305000,
        source: { name: 'OTHER_SELLER', listingId: '9002' },
        seller: { name: 'Other Retailer', type: 'retailer' }
      };

      const result2 = await canonicalizeListing(listing2);
      expect(result2.success).toBe(true);
      expect(result2.canonicalOperation).toBe('reused');
      expect(result2.offerOperation).toBe('created');
      expect(result2.canonicalProductId.toString()).toBe(result1.canonicalProductId.toString());

      // Check CanonicalProduct count is still 1, but ProductOffer count is 2
      const canonicalCount = await CanonicalProduct.countDocuments({});
      const offerCount = await ProductOffer.countDocuments({});
      expect(canonicalCount).toBe(1);
      expect(offerCount).toBe(2);
    });

    it('creates different CanonicalProduct instances for different model suffixes', async () => {
      const itemA = {
        name: 'ASUS TUF Gaming A15 (RTX 4060)',
        brand: 'ASUS',
        category: 'laptops',
        specifications: { model: 'FA507NV' },
        price: 310000,
        source: { name: 'EEZEPC', listingId: '6001' }
      };

      const itemB = {
        name: 'ASUS TUF Gaming A15 (RTX 4070)',
        brand: 'ASUS',
        category: 'laptops',
        specifications: { model: 'FA507XI' },
        price: 380000,
        source: { name: 'EEZEPC', listingId: '6002' }
      };

      const resA = await canonicalizeListing(itemA);
      const resB = await canonicalizeListing(itemB);

      expect(resA.canonicalKey).toBe('asus|fa507nv');
      expect(resB.canonicalKey).toBe('asus|fa507xi');
      expect(resA.canonicalProductId.toString()).not.toBe(resB.canonicalProductId.toString());

      const count = await CanonicalProduct.countDocuments({});
      expect(count).toBe(2);
    });
  });

  describe('2. Re-Sync & ProductOffer Updates', () => {
    it('updates existing ProductOffer on re-sync without duplicating or wiping values with undefined', async () => {
      const originalListing = {
        name: 'Logitech G PRO X Superlight',
        brand: 'Logitech',
        category: 'laptops',
        specifications: { model: '910-005878' },
        price: 38000,
        availability: 'in_stock',
        stock: 5,
        source: {
          name: 'EEZEPC',
          listingId: '7001',
          url: 'https://eezepc.com/gpro',
          type: 'api'
        },
        seller: {
          name: 'EEZEPC Pakistan',
          type: 'retailer',
          location: 'Karachi'
        }
      };

      const res1 = await canonicalizeListing(originalListing);
      expect(res1.canonicalOperation).toBe('created');
      expect(res1.offerOperation).toBe('created');

      const initialOffer = await ProductOffer.findById(res1.offerId);
      const firstSyncDate = initialOffer.lastSyncedAt;

      // Re-sync with updated price and changed availability, with stock omitted
      const updatedListing = {
        name: 'Logitech G PRO X Superlight (Updated Price)',
        brand: 'Logitech',
        category: 'laptops',
        specifications: { model: '910-005878' },
        price: 36500, // price drop
        availability: 'out_of_stock', // changed
        stock: undefined,
        source: {
          name: 'EEZEPC',
          listingId: '7001',
          url: 'https://eezepc.com/gpro',
          type: 'api'
        }
      };

      const res2 = await canonicalizeListing(updatedListing);
      expect(res2.success).toBe(true);
      expect(res2.canonicalOperation).toBe('reused');
      expect(res2.offerOperation).toBe('updated');
      expect(res2.offerId.toString()).toBe(res1.offerId.toString());

      const updatedOffer = await ProductOffer.findById(res2.offerId);
      expect(updatedOffer.price).toBe(36500);
      expect(updatedOffer.availability).toBe('out_of_stock');
      // Verify location was not wiped when omitted
      expect(updatedOffer.seller.location).toBe('Karachi');
      // Verify lastSyncedAt was refreshed
      expect(new Date(updatedOffer.lastSyncedAt).getTime()).toBeGreaterThanOrEqual(new Date(firstSyncDate).getTime());

      // Ensure total counts remain 1 Canonical and 1 Offer
      expect(await CanonicalProduct.countDocuments({})).toBe(1);
      expect(await ProductOffer.countDocuments({})).toBe(1);
    });

    it('preserves established canonical facts and only enriches missing stable facts', async () => {
      const firstListing = {
        name: 'ASUS ROG Strix XG32UCWG',
        brand: 'ASUS',
        category: 'monitors',
        specifications: { model: 'XG32UCWG', panel: 'OLED' },
        description: 'Original detailed product description',
        images: ['https://eezepc.com/xg32_1.jpg'],
        price: 220000,
        source: { name: 'EEZEPC', listingId: '8001' }
      };

      const res1 = await canonicalizeListing(firstListing);
      expect(res1.canonicalOperation).toBe('created');

      // Second listing with shorter description but new specification field
      const secondListing = {
        name: 'ASUS XG32UCWG Gaming Monitor',
        brand: 'ASUS',
        category: 'monitors',
        specifications: { model: 'XG32UCWG', refresh_rate: '160Hz' },
        description: 'Shorter description from another batch',
        price: 215000,
        source: { name: 'EEZEPC', listingId: '8002' }
      };

      const res2 = await canonicalizeListing(secondListing);
      expect(res2.canonicalOperation).toBe('reused');

      const canonical = await CanonicalProduct.findById(res1.canonicalProductId);
      // Description is preserved from original
      expect(canonical.description).toBe('Original detailed product description');
      // Existing spec is preserved
      expect(canonical.specifications.panel).toBe('OLED');
      // Missing spec was enriched
      expect(canonical.specifications.refresh_rate).toBe('160Hz');
    });
  });

  describe('3. Insufficient Identity & Rejection Rules', () => {
    it('rejects listing without model and creates NEITHER CanonicalProduct NOR ProductOffer', async () => {
      const vagueListing = {
        name: 'Generic Blue Switch Mechanical Gaming Keyboard',
        brand: 'Generic',
        category: 'laptops',
        specifications: { switch_type: 'Blue' }, // no trustworthy model
        price: 4500,
        source: { name: 'EEZEPC', listingId: '9001' }
      };

      const result = await canonicalizeListing(vagueListing);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('insufficient_model_identity');
      expect(result.canonicalProductId).toBeUndefined();
      expect(result.offerId).toBeUndefined();

      // Verify no records inserted
      expect(await CanonicalProduct.countDocuments({})).toBe(0);
      expect(await ProductOffer.countDocuments({})).toBe(0);
    });

    it('rejects listing without brand and creates NEITHER CanonicalProduct NOR ProductOffer', async () => {
      const noBrandListing = {
        name: 'Gaming Headset 7.1 Surround Sound',
        category: 'laptops',
        specifications: { model: 'GH-701' },
        price: 8500,
        source: { name: 'EEZEPC', listingId: '9002' }
      };

      const result = await canonicalizeListing(noBrandListing);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('missing_trustworthy_brand');

      expect(await CanonicalProduct.countDocuments({})).toBe(0);
      expect(await ProductOffer.countDocuments({})).toBe(0);
    });
  });

  describe('4. Controlled EEZEPC Sync Runner', () => {
    it('executes controlled batch with injected fixtures and tracks metrics accurately', async () => {
      const mockRawProducts = [
        {
          id: 101,
          name: 'ASUS ROG Strix XG32UCWG Monitor',
          slug: 'asus-xg32ucwg',
          sku: 'XG32UCWG',
          prices: { price: '215000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: [
            { name: 'Brand', terms: [{ name: 'ASUS' }] },
            { name: 'Model', terms: [{ name: 'XG32UCWG' }] }
          ],
          is_in_stock: true,
          permalink: 'https://eezepc.com/product/101'
        },
        {
          id: 102,
          name: 'Mechanical Gaming Keyboard Without Model',
          slug: 'keyboard-no-model',
          prices: { price: '5000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'keyboards', name: 'Keyboards' }],
          attributes: [
            { name: 'Brand', terms: [{ name: 'Logitech' }] }
            // No model attribute
          ],
          is_in_stock: true,
          permalink: 'https://eezepc.com/product/102'
        }
      ];

      // Run 1: Initial Sync
      const summary1 = await runControlledEezepcCanonicalSync({ rawProducts: mockRawProducts });
      expect(summary1.success).toBe(true);
      expect(summary1.fetched).toBe(2);
      expect(summary1.supported).toBe(2);
      expect(summary1.matchable).toBe(1);
      expect(summary1.insufficientIdentity).toBe(1);
      expect(summary1.canonicalCreated).toBe(1);
      expect(summary1.offersCreated).toBe(1);
      expect(summary1.matchable + summary1.insufficientIdentity + summary1.failed).toBe(summary1.supported);

      expect(await CanonicalProduct.countDocuments({})).toBe(1);
      expect(await ProductOffer.countDocuments({})).toBe(1);

      // Run 2: Re-Sync Same Batch
      const summary2 = await runControlledEezepcCanonicalSync({ rawProducts: mockRawProducts });
      expect(summary2.success).toBe(true);
      expect(summary2.canonicalCreated).toBe(0);
      expect(summary2.canonicalReused).toBe(1);
      expect(summary2.offersCreated).toBe(0);
      expect(summary2.offersUpdated).toBe(1);

      // Verify no duplicates created
      expect(await CanonicalProduct.countDocuments({})).toBe(1);
      expect(await ProductOffer.countDocuments({})).toBe(1);
    });

    it('correctly counts two unmatchable + one matchable listings with insufficientIdentity = 2, matchable = 1', async () => {
      const mockRawProducts = [
        {
          id: 201,
          name: 'ASUS Monitor Without Brand Attribute',
          slug: 'asus-mon-1',
          prices: { price: '150000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: [] // missing brand & model
        },
        {
          id: 202,
          name: 'ASUS Monitor 2 Without Brand Attribute',
          slug: 'asus-mon-2',
          prices: { price: '180000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: [] // missing brand & model
        },
        {
          id: 203,
          name: 'ASUS TUF A15 FA507NV With Explicit Brand & Model',
          slug: 'asus-tuf-fa507nv',
          prices: { price: '320000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'laptops', name: 'Laptops' }],
          attributes: [
            { name: 'Brand', terms: [{ name: 'ASUS' }] },
            { name: 'Model', terms: [{ name: 'FA507NV' }] }
          ]
        }
      ];

      const summary = await runControlledEezepcCanonicalSync({ rawProducts: mockRawProducts });
      expect(summary.success).toBe(true);
      expect(summary.supported).toBe(3);
      expect(summary.insufficientIdentity).toBe(2);
      expect(summary.matchable).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.canonicalCreated).toBe(1);
      expect(summary.offersCreated).toBe(1);
      expect(summary.details).toHaveLength(3);
      expect(summary.matchable + summary.insufficientIdentity + summary.failed).toBe(summary.supported);
    });

    it('represents same listing ID encountered during enrichment once in final details with authoritative outcome', async () => {
      const mockRawProducts = [
        // Listing 301 initially unenriched (missing brand attribute)
        {
          id: 301,
          name: 'ASUS ROG Strix XG32UCWG Initial (Unenriched)',
          slug: 'asus-xg32ucwg',
          prices: { price: '215000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: [] // no attributes
        },
        // Other listing 302
        {
          id: 302,
          name: 'ASUS TUF Monitor 302',
          slug: 'asus-tuf-302',
          prices: { price: '95000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: []
        },
        // Listing 301 enriched in detail pass with explicit brand and model
        {
          id: 301,
          name: 'ASUS ROG Strix XG32UCWG Enriched',
          slug: 'asus-xg32ucwg',
          prices: { price: '215000', currency_code: 'PKR', currency_minor_unit: 0 },
          categories: [{ slug: 'monitors', name: 'Monitors' }],
          attributes: [
            { name: 'Brand', terms: [{ name: 'ASUS' }] },
            { name: 'Model', terms: [{ name: 'XG32UCWG' }] }
          ]
        }
      ];

      const summary = await runControlledEezepcCanonicalSync({ rawProducts: mockRawProducts });
      expect(summary.success).toBe(true);
      // Total unique supported listings is 2 (301 and 302)
      expect(summary.supported).toBe(2);
      expect(summary.matchable).toBe(1); // 301 became matchable/canonicalized
      expect(summary.insufficientIdentity).toBe(1); // 302 is unmatchable
      expect(summary.failed).toBe(0);
      expect(summary.canonicalCreated).toBe(1);
      expect(summary.offersCreated).toBe(1);

      // Invariant check
      expect(summary.matchable + summary.insufficientIdentity + summary.failed).toBe(summary.supported);

      // Verify details only contains 2 entries (one per unique listing ID)
      expect(summary.details).toHaveLength(2);
      const entry301 = summary.details.find(d => d.listingId === '301');
      expect(entry301).toBeDefined();
      expect(entry301.status).toBe('canonicalized');
      expect(entry301.canonicalKey).toBe('asus|xg32ucwg');

      const entry302 = summary.details.find(d => d.listingId === '302');
      expect(entry302).toBeDefined();
      expect(entry302.status).toBe('unmatchable');

      // Database verification
      expect(await CanonicalProduct.countDocuments({})).toBe(1);
      expect(await ProductOffer.countDocuments({})).toBe(1);
    });
  });
});
