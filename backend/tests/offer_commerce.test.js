const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const OfferClick = require('../src/models/OfferClick');
const Category = require('../src/models/Category');
const { resolveOfferDestination } = require('../src/commerce/resolveOfferDestination');
const { redirectOffer } = require('../src/commerce/redirectOffer');
const { upsertProductOffer } = require('../src/catalog/upsertProductOffer');

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
  await Category.deleteMany({});
  await CanonicalProduct.deleteMany({});
  await ProductOffer.deleteMany({});
  await mongoose.disconnect();
});

describe('Step 3C — Affiliate + Offer Commerce Foundation Tests', () => {
  let sampleCategory;
  let sampleCanonical;

  beforeEach(async () => {
    await CanonicalProduct.deleteMany({});
    await ProductOffer.deleteMany({});
    await OfferClick.deleteMany({});
    await Category.deleteMany({});

    await CanonicalProduct.syncIndexes();
    await ProductOffer.syncIndexes();
    await OfferClick.syncIndexes();

    sampleCategory = await Category.create({
      name: 'Monitors',
      slug: 'monitors',
      isActive: true
    });

    sampleCanonical = await CanonicalProduct.create({
      name: 'ASUS ROG Strix XG32UCWG 32″ 4K 165Hz Monitor',
      brand: 'ASUS',
      model: 'XG32UCWG',
      category: sampleCategory._id,
      canonicalKey: 'asus|xg32ucwg'
    });
  });

  describe('1. Destination URL Resolver (resolveOfferDestination)', () => {
    it('resolves affiliate URL when affiliate is enabled and URL is valid', () => {
      const offer = {
        sourceUrl: 'https://eezepc.com/product/monitor',
        affiliate: {
          enabled: true,
          url: 'https://partner.network.com/click?offer=123&aff_id=teckai',
          network: 'Impact',
          campaign: 'summer_promo'
        }
      };

      const result = resolveOfferDestination(offer);
      expect(result.success).toBe(true);
      expect(result.destinationType).toBe('affiliate');
      expect(result.affiliateUsed).toBe(true);
      expect(result.destinationUrl).toBe('https://partner.network.com/click?offer=123&aff_id=teckai');
      expect(result.campaign).toBe('summer_promo');
    });

    it('resolves source URL when affiliate is disabled', () => {
      const offer = {
        sourceUrl: 'https://eezepc.com/product/monitor',
        affiliate: {
          enabled: false,
          url: 'https://partner.network.com/click?offer=123'
        }
      };

      const result = resolveOfferDestination(offer);
      expect(result.success).toBe(true);
      expect(result.destinationType).toBe('source');
      expect(result.affiliateUsed).toBe(false);
      expect(result.destinationUrl).toBe('https://eezepc.com/product/monitor');
      expect(result.campaign).toBeUndefined();
    });

    it('falls back safely to source URL if affiliate is enabled but affiliate URL is empty/invalid', () => {
      const offer = {
        sourceUrl: 'https://eezepc.com/product/monitor',
        affiliate: {
          enabled: true,
          url: '' // empty
        }
      };

      const result = resolveOfferDestination(offer);
      expect(result.success).toBe(true);
      expect(result.destinationType).toBe('source');
      expect(result.affiliateUsed).toBe(false);
      expect(result.destinationUrl).toBe('https://eezepc.com/product/monitor');
    });

    it('returns destination_unavailable when neither affiliate nor source URL is valid', () => {
      const offer = {
        sourceUrl: 'invalid-url',
        affiliate: {
          enabled: true,
          url: 'not-a-valid-url'
        }
      };

      const result = resolveOfferDestination(offer);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('destination_unavailable');
      expect(result.destinationUrl).toBeNull();
      expect(result.destinationType).toBe('none');
    });
  });

  describe('2. ProductOffer Upsert & Affiliate Metadata Preservation', () => {
    it('preserves existing affiliate configuration when source re-syncs without affiliate data', async () => {
      // 1. Initial upsert with affiliate configuration
      const initialPayload = {
        canonicalProduct: sampleCanonical._id,
        source: {
          name: 'EEZEPC',
          listingId: '291149',
          url: 'https://eezepc.com/product/asus-xg32'
        },
        price: 215000,
        currency: 'PKR',
        availability: 'in_stock',
        sourceUrl: 'https://eezepc.com/product/asus-xg32',
        affiliate: {
          enabled: true,
          url: 'https://affiliate.teckai.com/deal/291149',
          network: 'CustomAffiliate',
          campaign: 'launch_2026'
        }
      };

      const res1 = await upsertProductOffer(initialPayload);
      expect(res1.operation).toBe('created');
      expect(res1.offer.affiliate.enabled).toBe(true);
      expect(res1.offer.affiliate.url).toBe('https://affiliate.teckai.com/deal/291149');

      // 2. Incoming automated EEZEPC sync payload (has no affiliate metadata)
      const incomingSyncPayload = {
        canonicalProduct: sampleCanonical._id,
        source: {
          name: 'EEZEPC',
          listingId: '291149',
          url: 'https://eezepc.com/product/asus-xg32'
        },
        price: 209000, // Price updated
        currency: 'PKR',
        availability: 'in_stock',
        sourceUrl: 'https://eezepc.com/product/asus-xg32'
        // No affiliate object provided
      };

      const res2 = await upsertProductOffer(incomingSyncPayload);
      expect(res2.operation).toBe('updated');
      expect(res2.offer.price).toBe(209000);

      // Verify affiliate metadata was NOT wiped
      const savedOffer = await ProductOffer.findById(res2.offer._id);
      expect(savedOffer.affiliate.enabled).toBe(true);
      expect(savedOffer.affiliate.url).toBe('https://affiliate.teckai.com/deal/291149');
      expect(savedOffer.affiliate.network).toBe('CustomAffiliate');
      expect(savedOffer.affiliate.campaign).toBe('launch_2026');
    });
  });

  describe('3. Redirect Service & HTTP Commerce Route', () => {
    it('redirects (302) to affiliate URL and records OfferClick when affiliate is active', async () => {
      const offer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        seller: { name: 'EEZEPC Pakistan', type: 'retailer' },
        source: { name: 'EEZEPC', listingId: '1001', url: 'https://eezepc.com/product/1001' },
        price: 215000,
        sourceUrl: 'https://eezepc.com/product/1001',
        affiliate: {
          enabled: true,
          url: 'https://partner.network.com/click?offer=1001',
          campaign: 'homepage_featured'
        },
        isActive: true
      });

      const res = await request(app)
        .get(`/api/offers/${offer._id}/redirect?context=product_page`)
        .expect(302);

      expect(res.headers.location).toBe('https://partner.network.com/click?offer=1001');

      // Verify OfferClick record (data minimization: full destinationUrl is omitted, only destinationHost is retained)
      const click = await OfferClick.findOne({ offer: offer._id });
      expect(click).not.toBeNull();
      expect(click.canonicalProduct.toString()).toBe(sampleCanonical._id.toString());
      expect(click.sellerName).toBe('EEZEPC Pakistan');
      expect(click.sourceName).toBe('EEZEPC');
      expect(click.affiliateUsed).toBe(true);
      expect(click.destinationType).toBe('affiliate');
      expect(click.destinationHost).toBe('partner.network.com');
      expect(click.destinationUrl).toBeUndefined(); // Data minimization: full URL with queries omitted
      expect(click.campaign).toBe('homepage_featured');
      expect(click.context).toBe('product_page');
    });

    it('redirects (302) to source URL and records OfferClick when affiliate is not active', async () => {
      const offer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        seller: { name: 'EEZEPC Pakistan', type: 'retailer' },
        source: { name: 'EEZEPC', listingId: '1002', url: 'https://eezepc.com/product/1002' },
        price: 185000,
        sourceUrl: 'https://eezepc.com/product/1002',
        affiliate: {
          enabled: false
        },
        isActive: true
      });

      const res = await request(app)
        .get(`/api/offers/${offer._id}/redirect?context=comparison`)
        .expect(302);

      expect(res.headers.location).toBe('https://eezepc.com/product/1002');

      const click = await OfferClick.findOne({ offer: offer._id });
      expect(click).not.toBeNull();
      expect(click.affiliateUsed).toBe(false);
      expect(click.destinationType).toBe('source');
      expect(click.destinationHost).toBe('eezepc.com');
      expect(click.destinationUrl).toBeUndefined(); // Data minimization
      expect(click.context).toBe('comparison');
    });

    it('falls back context to "unknown" when client sends an invalid/unsupported context', async () => {
      const offer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        source: { name: 'EEZEPC', listingId: '1003' },
        price: 99000,
        sourceUrl: 'https://eezepc.com/product/1003',
        isActive: true
      });

      await request(app)
        .get(`/api/offers/${offer._id}/redirect?context=arbitrary_malicious_script_injection`)
        .expect(302);

      const click = await OfferClick.findOne({ offer: offer._id });
      expect(click).not.toBeNull();
      expect(click.context).toBe('unknown');
    });

    it('returns 400 Bad Request for malformed offer ID', async () => {
      const res = await request(app)
        .get('/api/offers/not-a-valid-id/redirect')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid offer ID');
    });

    it('returns 404 Not Found for non-existent offer ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/offers/${nonExistentId}/redirect`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('returns 410 Gone for inactive / discontinued offer', async () => {
      const inactiveOffer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        source: { name: 'EEZEPC', listingId: '1004' },
        price: 150000,
        sourceUrl: 'https://eezepc.com/product/1004',
        isActive: false // Inactive
      });

      const res = await request(app)
        .get(`/api/offers/${inactiveOffer._id}/redirect`)
        .expect(410);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('inactive or discontinued');

      // Ensure no click was recorded for inactive offer
      const clickCount = await OfferClick.countDocuments({ offer: inactiveOffer._id });
      expect(clickCount).toBe(0);
    });

    it('returns 422 Unprocessable Entity when offer has no valid destination URL', async () => {
      const invalidUrlOffer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        source: { name: 'EEZEPC', listingId: '1005' },
        price: 120000,
        sourceUrl: '', // empty
        affiliate: { enabled: false },
        isActive: true
      });

      const res = await request(app)
        .get(`/api/offers/${invalidUrlOffer._id}/redirect`)
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No valid destination URL');
    });

    it('prevents open-redirect attacks by ignoring arbitrary client destination query parameters', async () => {
      const offer = await ProductOffer.create({
        canonicalProduct: sampleCanonical._id,
        source: { name: 'EEZEPC', listingId: '1006' },
        price: 140000,
        sourceUrl: 'https://eezepc.com/product/1006',
        isActive: true
      });

      // Attacker attempts open-redirect via ?url= or ?redirect=
      const res = await request(app)
        .get(`/api/offers/${offer._id}/redirect?url=https://attacker-site.com&redirect=https://evil.com`)
        .expect(302);

      // Destination strictly matches trusted database URL
      expect(res.headers.location).toBe('https://eezepc.com/product/1006');
      expect(res.headers.location).not.toContain('attacker-site');
    });
  });
});
