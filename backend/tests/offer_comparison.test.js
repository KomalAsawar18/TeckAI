const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const app = require('../src/app');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');
const { compareOffers } = require('../src/commerce/compareOffers');
const { getProductOffersComparison } = require('../src/commerce/getProductOffersComparison');

describe('Step 3E — Product Offer Comparison & Best Offer Selection Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await Category.deleteMany({});
    await CanonicalProduct.deleteMany({});
    await ProductOffer.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await ProductOffer.deleteMany({});
    await CanonicalProduct.deleteMany({});
    await Category.deleteMany({});
  });

  describe('1. Pure Offer Comparison Engine (compareOffers)', () => {
    it('1. single eligible offer is chosen as bestOffer', () => {
      const offers = [
        {
          _id: 'offer1',
          seller: { name: 'Seller A' },
          source: { name: 'SRC_A', listingId: '101' },
          price: 15000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://seller-a.com/p/101',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer).toBeDefined();
      expect(result.bestOffer.price).toBe(15000);
      expect(result.rankedOffers.length).toBe(1);
      expect(result.excludedOffers.length).toBe(0);
      expect(result.summary.bestPrice).toBe(15000);
      expect(result.summary.eligibleOffers).toBe(1);
    });

    it('2. lower price wins among same condition and availability', () => {
      const offers = [
        {
          _id: 'offer1',
          price: 12000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/1',
          isActive: true
        },
        {
          _id: 'offer2',
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/2',
          isActive: true
        },
        {
          _id: 'offer3',
          price: 14000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/3',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer._id).toBe('offer2');
      expect(result.bestOffer.price).toBe(10500);
      expect(result.rankedOffers.map(o => o._id)).toEqual(['offer2', 'offer1', 'offer3']);
    });

    it('3. new condition beats cheaper used offer by default', () => {
      const offers = [
        {
          _id: 'offer_used',
          price: 9000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'used',
          sourceUrl: 'https://example.com/used',
          isActive: true
        },
        {
          _id: 'offer_new',
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/new',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      // New at 10500 beats Used at 9000
      expect(result.bestOffer._id).toBe('offer_new');
      expect(result.bestOffer.price).toBe(10500);
    });

    it('4. refurbished condition beats used condition', () => {
      const offers = [
        {
          _id: 'offer_used',
          price: 7000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'used',
          sourceUrl: 'https://example.com/used',
          isActive: true
        },
        {
          _id: 'offer_refurbished',
          price: 9500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'refurbished',
          sourceUrl: 'https://example.com/refurb',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer._id).toBe('offer_refurbished');
      expect(result.bestOffer.price).toBe(9500);
    });

    it('5. in-stock availability beats unknown and out-of-stock even if higher priced', () => {
      const offers = [
        {
          _id: 'offer_oos',
          price: 8000,
          currency: 'PKR',
          availability: 'out_of_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/oos',
          isActive: true
        },
        {
          _id: 'offer_unknown',
          price: 9000,
          currency: 'PKR',
          availability: 'unknown',
          condition: 'new',
          sourceUrl: 'https://example.com/unk',
          isActive: true
        },
        {
          _id: 'offer_in_stock',
          price: 11000,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/in_stock',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer._id).toBe('offer_in_stock');
      expect(result.bestOffer.price).toBe(11000);
      expect(result.rankedOffers.map(o => o._id)).toEqual(['offer_in_stock', 'offer_unknown', 'offer_oos']);
    });

    it('6. out-of-stock offer is not selected as default bestOffer when all are out of stock', () => {
      const offers = [
        {
          _id: 'offer_oos1',
          price: 10000,
          currency: 'PKR',
          availability: 'out_of_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/oos1',
          isActive: true
        },
        {
          _id: 'offer_oos2',
          price: 12000,
          currency: 'PKR',
          availability: 'out_of_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/oos2',
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer).toBeNull();
      expect(result.rankedOffers.length).toBe(2);
      expect(result.summary.bestPrice).toBeNull();
    });

    it('7. out-of-stock offer is returned as bestOffer if includeUnavailable: true', () => {
      const offers = [
        {
          _id: 'offer_oos1',
          price: 10000,
          currency: 'PKR',
          availability: 'out_of_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/oos1',
          isActive: true
        },
        {
          _id: 'offer_oos2',
          price: 12000,
          currency: 'PKR',
          availability: 'out_of_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/oos2',
          isActive: true
        }
      ];

      const result = compareOffers(offers, { includeUnavailable: true });
      expect(result.bestOffer).toBeDefined();
      expect(result.bestOffer._id).toBe('offer_oos1');
      expect(result.bestOffer.price).toBe(10000);
    });

    it('8. breaks price ties deterministically by recency (lastSyncedAt)', () => {
      const offers = [
        {
          _id: 'offer_older',
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/1',
          lastSyncedAt: new Date('2026-08-20T10:00:00Z'),
          isActive: true
        },
        {
          _id: 'offer_newer',
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/2',
          lastSyncedAt: new Date('2026-08-27T10:00:00Z'),
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      expect(result.bestOffer._id).toBe('offer_newer');
      expect(result.rankedOffers[0]._id).toBe('offer_newer');
    });

    it('9. breaks exact timestamp ties deterministically by stable source identifier', () => {
      const sameTime = new Date('2026-08-27T10:00:00Z');
      const offers = [
        {
          _id: 'offer_b',
          seller: { name: 'Seller Z' },
          source: { name: 'STORE_Z', listingId: '999' },
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/z',
          lastSyncedAt: sameTime,
          isActive: true
        },
        {
          _id: 'offer_a',
          seller: { name: 'Seller A' },
          source: { name: 'STORE_A', listingId: '100' },
          price: 10500,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          sourceUrl: 'https://example.com/a',
          lastSyncedAt: sameTime,
          isActive: true
        }
      ];

      const result = compareOffers(offers);
      // STORE_A:100 sorts before STORE_Z:999
      expect(result.bestOffer._id).toBe('offer_a');
      expect(result.rankedOffers.map(o => o._id)).toEqual(['offer_a', 'offer_b']);
    });
  });

  describe('2. Variant Filtering & Exclusions (compareOffers)', () => {
    const variantOffers = [
      {
        _id: 'offer_starry_gray',
        price: 10500,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        variant: { color: 'Starry Sky Gray' },
        sourceUrl: 'https://example.com/1',
        isActive: true
      },
      {
        _id: 'offer_blue_white',
        price: 10500,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        variant: { color: 'Blue White' },
        sourceUrl: 'https://example.com/2',
        isActive: true
      },
      {
        _id: 'offer_black_contour',
        price: 12000,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        variant: { color: 'Black Contour' },
        sourceUrl: 'https://example.com/3',
        isActive: true
      }
    ];

    it('10. filters offers by variant color (case-insensitive and trimmed)', () => {
      const result = compareOffers(variantOffers, { color: 'black contour' });
      expect(result.bestOffer._id).toBe('offer_black_contour');
      expect(result.rankedOffers.length).toBe(1);
      expect(result.excludedOffers.length).toBe(2);
      expect(result.excludedOffers.every(e => e.reason === 'variant_mismatch')).toBe(true);
    });

    it('11. returns bestOffer: null when variant filter matches nothing', () => {
      const result = compareOffers(variantOffers, { color: 'Midnight Purple' });
      expect(result.bestOffer).toBeNull();
      expect(result.rankedOffers.length).toBe(0);
      expect(result.excludedOffers.length).toBe(3);
      expect(result.summary.eligibleOffers).toBe(0);
    });

    it('12. excludes inactive offers, invalid prices, missing destinations, and mixed currencies', () => {
      const mixedOffers = [
        {
          _id: 'inactive_offer',
          price: 5000,
          currency: 'PKR',
          sourceUrl: 'https://example.com/inactive',
          isActive: false
        },
        {
          _id: 'invalid_price_offer',
          price: -500,
          currency: 'PKR',
          sourceUrl: 'https://example.com/invalid_price',
          isActive: true
        },
        {
          _id: 'missing_destination_offer',
          price: 10000,
          currency: 'PKR',
          sourceUrl: '', // missing
          isActive: true
        },
        {
          _id: 'usd_offer',
          price: 50,
          currency: 'USD', // mismatched currency
          sourceUrl: 'https://example.com/usd',
          isActive: true
        },
        {
          _id: 'valid_pkr_offer',
          price: 12000,
          currency: 'PKR',
          availability: 'in_stock',
          sourceUrl: 'https://example.com/valid',
          isActive: true
        }
      ];

      const result = compareOffers(mixedOffers);
      expect(result.bestOffer._id).toBe('valid_pkr_offer');
      expect(result.rankedOffers.length).toBe(1);
      expect(result.excludedOffers.length).toBe(4);

      const reasons = result.excludedOffers.map(e => e.reason);
      expect(reasons).toContain('inactive');
      expect(reasons).toContain('invalid_price');
      expect(reasons).toContain('missing_destination');
      expect(reasons).toContain('currency_mismatch');
    });
  });

  describe('3. Database Integration & Cross-Source Canonical Comparison', () => {
    it('13. correctly loads CanonicalProduct and ranks multi-source offers (EEZEPC + Infinity)', async () => {
      const cat = await Category.create({ name: 'Keyboards', slug: 'keyboards' });

      const canonical = await CanonicalProduct.create({
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
        brand: 'Ajazz',
        model: 'AK680V2',
        canonicalKey: 'ajazz|ak680v2',
        category: cat._id
      });

      // 1 EEZEPC offer
      await ProductOffer.create({
        canonicalProduct: canonical._id,
        seller: { name: 'EEZEPC Pakistan', type: 'retailer' },
        source: { name: 'EEZEPC', listingId: '99001', url: 'https://eezepc.com/product/ak680v2' },
        price: 11000,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        sourceUrl: 'https://eezepc.com/product/ak680v2'
      });

      // 1 Infinity offer (cheaper)
      await ProductOffer.create({
        canonicalProduct: canonical._id,
        seller: { name: 'Infinity Store Pakistan', type: 'retailer' },
        source: { name: 'INFINITY_STORE', listingId: '68919', url: 'https://infinitystore.pk/product/ak680v2' },
        price: 10500,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        variant: { color: 'Starry Sky Gray' },
        sourceUrl: 'https://infinitystore.pk/product/ak680v2'
      });

      const res = await getProductOffersComparison(canonical._id);

      expect(res.product.id).toBe(canonical._id.toString());
      expect(res.product.canonicalKey).toBe('ajazz|ak680v2');
      expect(res.bestOffer).toBeDefined();
      expect(res.bestOffer.seller).toBe('Infinity Store Pakistan');
      expect(res.bestOffer.price).toBe(10500);

      expect(res.offers.length).toBe(2);
      expect(res.summary.sellerCount).toBe(2);
      expect(res.summary.sourceCount).toBe(2);
      expect(res.summary.bestPrice).toBe(10500);
    });

    it('14. preserves distinct variants and filters accurately via service', async () => {
      const cat = await Category.create({ name: 'Keyboards', slug: 'keyboards' });

      const canonical = await CanonicalProduct.create({
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
        brand: 'Ajazz',
        model: 'AK680V2',
        canonicalKey: 'ajazz|ak680v2',
        category: cat._id
      });

      const variants = [
        { listingId: '68919', color: 'Starry Sky Gray', price: 10500 },
        { listingId: '68915', color: 'Blue White', price: 10500 },
        { listingId: '68911', color: 'Black Contour', price: 12000 },
        { listingId: '68898', color: 'White Contour', price: 12000 }
      ];

      for (const v of variants) {
        await ProductOffer.create({
          canonicalProduct: canonical._id,
          seller: { name: 'Infinity Store Pakistan' },
          source: { name: 'INFINITY_STORE', listingId: v.listingId },
          price: v.price,
          currency: 'PKR',
          availability: 'in_stock',
          condition: 'new',
          variant: { color: v.color },
          sourceUrl: `https://infinitystore.pk/product/${v.listingId}`
        });
      }

      // Without filter -> 4 offers, lowest price 10500
      const allRes = await getProductOffersComparison(canonical._id);
      expect(allRes.offers.length).toBe(4);
      expect(allRes.bestOffer.price).toBe(10500);

      // With color filter
      const blackRes = await getProductOffersComparison(canonical._id, { color: 'Black Contour' });
      expect(blackRes.bestOffer.variant.color).toBe('Black Contour');
      expect(blackRes.bestOffer.price).toBe(12000);
      expect(blackRes.offers.length).toBe(1);
    });
  });

  describe('4. API Endpoint (GET /api/canonical-products/:id/offers)', () => {
    it('15. returns 400 Bad Request for malformed ObjectId', async () => {
      const res = await request(app).get('/api/canonical-products/invalid-id-format/offers');
      expect(res.status).toBe(400);
    });

    it('16. returns 404 Not Found for non-existent canonical product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/canonical-products/${nonExistentId}/offers`);
      expect(res.status).toBe(404);
    });

    it('17. returns 200 with sanitized bestOffer, ranked offers, and never exposes raw affiliate URLs', async () => {
      const cat = await Category.create({ name: 'Keyboards', slug: 'keyboards' });

      const canonical = await CanonicalProduct.create({
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
        brand: 'Ajazz',
        model: 'AK680V2',
        canonicalKey: 'ajazz|ak680v2',
        category: cat._id
      });

      await ProductOffer.create({
        canonicalProduct: canonical._id,
        seller: { name: 'Infinity Store Pakistan' },
        source: { name: 'INFINITY_STORE', listingId: '68919' },
        price: 10500,
        currency: 'PKR',
        availability: 'in_stock',
        condition: 'new',
        variant: { color: 'Starry Sky Gray' },
        sourceUrl: 'https://infinitystore.pk/product/68919',
        affiliate: {
          enabled: true,
          url: 'https://secret-affiliate-network.com/track?partner=secret_key_123',
          network: 'secret_network'
        }
      });

      const res = await request(app).get(`/api/canonical-products/${canonical._id}/offers`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product.name).toBe('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
      expect(res.body.bestOffer.price).toBe(10500);
      expect(res.body.bestOffer.redirectUrl).toBeDefined();

      // SECURITY CHECK: Raw affiliate tracking URLs and secrets must NEVER be exposed
      const jsonResponse = JSON.stringify(res.body);
      expect(jsonResponse.includes('secret-affiliate-network.com')).toBe(false);
      expect(jsonResponse.includes('secret_key_123')).toBe(false);
      expect(jsonResponse.includes('secret_network')).toBe(false);
    });
  });
});
