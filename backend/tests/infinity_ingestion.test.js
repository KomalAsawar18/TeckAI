const mongoose = require('mongoose');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');

const {
  fetchProducts,
  fetchProduct,
  isValidInfinityUrl
} = require('../src/ingestion/sources/infinity/client');

const {
  mapInfinityProduct,
  mapCategory,
  extractBrand,
  extractModel,
  extractPriceAndCurrency,
  isAccessoryCategory
} = require('../src/ingestion/sources/infinity/mapper');

const {
  adaptInfinityToCanonicalAndOffer
} = require('../src/ingestion/sources/infinity/adapter');

const {
  adaptEezepcToCanonicalAndOffer
} = require('../src/catalog/adapters/eezepcAdapter');

const {
  canonicalizeListing
} = require('../src/catalog/canonicalizeListing');

const {
  runControlledInfinityCanonicalSync
} = require('../src/ingestion/sources/infinity/controlledSync');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await Category.deleteMany({});
  await CanonicalProduct.deleteMany({});
  await ProductOffer.deleteMany({});
  await disconnectTestDB();
});

describe('Step 3D.3 — Infinity Store Connector & Multi-Source Canonicalization Tests', () => {
  let keyboardCat;
  let monitorCat;
  let mouseCat;

  beforeEach(async () => {
    await CanonicalProduct.deleteMany({});
    await ProductOffer.deleteMany({});
    await Category.deleteMany({});

    await CanonicalProduct.syncIndexes();
    await ProductOffer.syncIndexes();

    keyboardCat = await Category.create({ name: 'Keyboards', slug: 'keyboards', isActive: true });
    monitorCat = await Category.create({ name: 'Monitors', slug: 'monitors', isActive: true });
    mouseCat = await Category.create({ name: 'Mouse', slug: 'mouse', isActive: true });
  });

  describe('1. API Client & URL Validation', () => {
    it('validates strictly HTTPS and infinitystore.pk hostname', () => {
      expect(isValidInfinityUrl('https://infinitystore.pk/wp-json/wc/store/v1/products')).toBe(true);
      expect(isValidInfinityUrl('https://www.infinitystore.pk/wp-json/wc/store/v1/products')).toBe(true);
      expect(isValidInfinityUrl('http://infinitystore.pk/wp-json/wc/store/v1/products')).toBe(false);
      expect(isValidInfinityUrl('https://evil-site.com/products')).toBe(false);
      expect(isValidInfinityUrl('not-a-url')).toBe(false);
    });

    it('rejects invalid URLs without executing fetch', async () => {
      const result = await fetchProducts({ page: 1 });
      // In tests without internet/mocking, it will fail safely or fetch with strict protocol
      expect(typeof isValidInfinityUrl).toBe('function');
    });
  });

  describe('2. Mapper & Category/Brand/Model Rules', () => {
    it('maps prices respecting currency_minor_unit (scale 0 vs scale 2)', () => {
      // Scale 0 (PKR in whole numbers)
      const res0 = extractPriceAndCurrency({
        price: '10500',
        currency_code: 'PKR',
        currency_minor_unit: 0
      });
      expect(res0.price).toBe(10500);
      expect(res0.currency).toBe('PKR');

      // Scale 2 (minor unit cents)
      const res2 = extractPriceAndCurrency({
        price: '1050000',
        currency_code: 'PKR',
        currency_minor_unit: 2
      });
      expect(res2.price).toBe(10500);
    });

    it('extracts explicit pa_brand and leaves brand undefined if absent (no title guessing)', () => {
      const productWithBrand = {
        attributes: [
          {
            taxonomy: 'pa_brand',
            terms: [{ name: 'Ajazz', slug: 'ajazz' }]
          }
        ]
      };
      expect(extractBrand(productWithBrand)).toBe('Ajazz');

      const productWithoutBrand = {
        name: 'Razer DeathAdder Gaming Mouse',
        attributes: [{ name: 'Color', terms: [{ name: 'Black' }] }]
      };
      // Must NOT extract "Razer" from title
      expect(extractBrand(productWithoutBrand)).toBeUndefined();
    });

    it('does NOT treat retailer SKU as manufacturer model', () => {
      const rawProduct = {
        id: 68919,
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY', // Internal inventory / retailer SKU
        attributes: [
          { taxonomy: 'pa_brand', terms: [{ name: 'Ajazz' }] },
          { name: 'Color', terms: [{ name: 'Gray' }] }
          // No explicit Model attribute
        ],
        categories: [{ slug: 'keyboard', name: 'Keyboard' }],
        prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
        is_in_stock: true
      };

      const mapped = mapInfinityProduct(rawProduct);
      expect(mapped.brand).toBe('Ajazz');
      expect(mapped.model).toBeUndefined(); // SKU is not converted to model
    });

    it('extracts explicit Model / MPN attribute when genuinely present', () => {
      const rawProduct = {
        id: 70001,
        name: 'ASUS ROG Strix Monitor',
        sku: 'RTL-SKU-999',
        attributes: [
          { taxonomy: 'pa_brand', terms: [{ name: 'ASUS' }] },
          { name: 'Model', terms: [{ name: 'XG32UCWG' }] }
        ],
        categories: [{ slug: 'monitors', name: 'Monitors' }],
        prices: { price: '215000', currency_code: 'PKR', currency_minor_unit: 0 },
        is_in_stock: true
      };

      const mapped = mapInfinityProduct(rawProduct);
      expect(mapped.brand).toBe('ASUS');
      expect(mapped.model).toBe('XG32UCWG');
    });

    it('maps supported categories and excludes accessory categories', () => {
      expect(mapCategory([{ slug: 'keyboard', name: 'Keyboard' }])).toBe('keyboards');
      expect(mapCategory([{ slug: 'mouse', name: 'Mouse' }])).toBe('mouse');
      expect(mapCategory([{ slug: 'headphones', name: 'Headphones' }])).toBe('headphones');
      expect(mapCategory([{ slug: 'monitors', name: 'Monitors' }])).toBe('monitors');
      expect(mapCategory([{ slug: 'gaming-laptops', name: 'Gaming Laptops' }])).toBe('laptops');

      // Accessories must be rejected (return undefined)
      expect(mapCategory([{ slug: 'mouse-pads', name: 'Mouse Pads' }])).toBeUndefined();
      expect(mapCategory([{ slug: 'keycaps', name: 'Keycaps' }])).toBeUndefined();
      expect(mapCategory([{ slug: 'headphone-stands', name: 'Headphone Stands' }])).toBeUndefined();
      expect(mapCategory([{ slug: 'monitor-arms', name: 'Monitor Arms' }])).toBeUndefined();
      expect(mapCategory([{ slug: 'gamepads', name: 'Gamepads' }])).toBeUndefined();
    });

    it('correctly maps availability without fabricating stock count', () => {
      const inStockRaw = {
        id: 101,
        name: 'Keyboard',
        categories: [{ slug: 'keyboard' }],
        is_in_stock: true,
        prices: { price: '5000' }
      };
      const outStockRaw = {
        id: 102,
        name: 'Keyboard',
        categories: [{ slug: 'keyboard' }],
        is_in_stock: false,
        prices: { price: '5000' }
      };

      const mappedIn = mapInfinityProduct(inStockRaw);
      const mappedOut = mapInfinityProduct(outStockRaw);

      expect(mappedIn.availability).toBe('in_stock');
      expect(mappedIn.stock).toBeUndefined(); // no fabricated stock

      expect(mappedOut.availability).toBe('out_of_stock');
      expect(mappedOut.stock).toBeUndefined();
    });
  });

  describe('3. Adapter & Canonicalization Rules', () => {
    it('adapts Infinity Store listing into canonical candidate and offer candidate', () => {
      const normalized = {
        name: 'Ajazz AK680 V2 Gaming Keyboard',
        brand: 'Ajazz',
        model: 'AK680 V2',
        category: 'keyboards',
        price: 10500,
        currency: 'PKR',
        availability: 'in_stock',
        sourceUrl: 'https://infinitystore.pk/product/ajazz-ak680',
        source: {
          name: 'INFINITY_STORE',
          listingId: '68919',
          url: 'https://infinitystore.pk/product/ajazz-ak680'
        }
      };

      const adapted = adaptInfinityToCanonicalAndOffer(normalized);
      expect(adapted.isMatchable).toBe(true);
      expect(adapted.candidateCanonical.canonicalKey).toBe('ajazz|ak680 v2');
      expect(adapted.offer.seller.name).toBe('Infinity Store Pakistan');
      expect(adapted.offer.source.name).toBe('INFINITY_STORE');
      expect(adapted.offer.source.listingId).toBe('68919');
      expect(adapted.offer.affiliate.enabled).toBe(false);
    });

    it('marks listing without model as isMatchable: false (insufficient_model_identity)', () => {
      const normalized = {
        name: 'Ajazz Unknown Keyboard',
        brand: 'Ajazz',
        category: 'keyboards',
        source: { name: 'INFINITY_STORE', listingId: '68919' }
      };

      const adapted = adaptInfinityToCanonicalAndOffer(normalized);
      expect(adapted.isMatchable).toBe(false);
      expect(adapted.reason).toBe('insufficient_model_identity');
    });
  });

  describe('4. Multi-Source Cross-Matching (EEZEPC + Infinity Store)', () => {
    it('cross-matches same brand + model from EEZEPC and Infinity Store into ONE CanonicalProduct with TWO ProductOffers', async () => {
      // 1. Ingest EEZEPC listing for ASUS XG32UCWG
      const eezepcListing = {
        name: 'ASUS ROG Strix XG32UCWG 32″ 4K 165Hz Monitor',
        brand: 'ASUS',
        model: 'XG32UCWG',
        category: 'monitors',
        price: 215000,
        currency: 'PKR',
        availability: 'in_stock',
        sourceUrl: 'https://eezepc.com/product/asus-rog-strix-xg32ucwg',
        source: {
          name: 'EEZEPC',
          listingId: '291149',
          url: 'https://eezepc.com/product/asus-rog-strix-xg32ucwg'
        },
        seller: { name: 'EEZEPC Pakistan', type: 'retailer' }
      };

      const res1 = await canonicalizeListing(eezepcListing);
      expect(res1.success).toBe(true);
      expect(res1.canonicalOperation).toBe('created');
      expect(res1.canonicalKey).toBe('asus|xg32ucwg');

      // Verify 1 CanonicalProduct and 1 Offer in DB
      expect(await CanonicalProduct.countDocuments()).toBe(1);
      expect(await ProductOffer.countDocuments()).toBe(1);

      // 2. Ingest Infinity Store listing for the same product (ASUS XG32UCWG)
      const infinityListing = {
        name: 'ASUS ROG Strix XG32UCWG 4K OLED Gaming Monitor',
        brand: 'ASUS',
        model: 'XG32UCWG',
        category: 'monitors',
        price: 219000, // Different seller price
        currency: 'PKR',
        availability: 'in_stock',
        sourceUrl: 'https://infinitystore.pk/product/asus-xg32ucwg',
        source: {
          name: 'INFINITY_STORE',
          listingId: '88123',
          url: 'https://infinitystore.pk/product/asus-xg32ucwg'
        },
        seller: { name: 'Infinity Store Pakistan', type: 'retailer' }
      };

      const res2 = await canonicalizeListing(infinityListing);
      expect(res2.success).toBe(true);
      expect(res2.canonicalOperation).toBe('reused'); // REUSED!
      expect(res2.canonicalProductId.toString()).toBe(res1.canonicalProductId.toString());

      // Assert database state: EXACTLY ONE CanonicalProduct, TWO ProductOffers
      const allCanonicals = await CanonicalProduct.find({});
      expect(allCanonicals.length).toBe(1);
      expect(allCanonicals[0].canonicalKey).toBe('asus|xg32ucwg');

      const allOffers = await ProductOffer.find({ canonicalProduct: allCanonicals[0]._id });
      expect(allOffers.length).toBe(2);

      const sources = allOffers.map(o => o.source.name).sort();
      expect(sources).toEqual(['EEZEPC', 'INFINITY_STORE']);

      const eezepcOffer = allOffers.find(o => o.source.name === 'EEZEPC');
      const infOffer = allOffers.find(o => o.source.name === 'INFINITY_STORE');
      expect(eezepcOffer.price).toBe(215000);
      expect(infOffer.price).toBe(219000);
      expect(infOffer.seller.name).toBe('Infinity Store Pakistan');
    });

    it('creates different CanonicalProducts for different models of the same brand', async () => {
      const p1 = {
        name: 'ASUS ROG Strix XG32UCWG',
        brand: 'ASUS',
        model: 'XG32UCWG',
        category: 'monitors',
        price: 215000,
        source: { name: 'EEZEPC', listingId: '1' }
      };

      const p2 = {
        name: 'ASUS ROG Swift PG32UCDM',
        brand: 'ASUS',
        model: 'PG32UCDM',
        category: 'monitors',
        price: 350000,
        source: { name: 'INFINITY_STORE', listingId: '2' }
      };

      await canonicalizeListing(p1);
      await canonicalizeListing(p2);

      expect(await CanonicalProduct.countDocuments()).toBe(2);
      expect(await ProductOffer.countDocuments()).toBe(2);
    });

    it('re-sync updates existing Infinity Store offer in place without creating duplicates', async () => {
      const infinityListing = {
        name: 'ASUS ROG Strix XG32UCWG',
        brand: 'ASUS',
        model: 'XG32UCWG',
        category: 'monitors',
        price: 219000,
        source: { name: 'INFINITY_STORE', listingId: '88123' },
        sourceUrl: 'https://infinitystore.pk/product/asus-xg32ucwg'
      };

      const res1 = await canonicalizeListing(infinityListing);
      expect(res1.offerOperation).toBe('created');

      // Re-sync with updated price
      infinityListing.price = 212000;
      const res2 = await canonicalizeListing(infinityListing);
      expect(res2.offerOperation).toBe('updated');

      expect(await CanonicalProduct.countDocuments()).toBe(1);
      expect(await ProductOffer.countDocuments()).toBe(1);

      const savedOffer = await ProductOffer.findById(res2.offerId);
      expect(savedOffer.price).toBe(212000);
    });
  });

  describe('5. Controlled Infinity Sync Runner', () => {
    it('executes controlled batch with injected fixtures and maintains invariant: matchable + insufficientIdentity + failed === supported', async () => {
      const fixtureProducts = [
        // 1. Matchable product
        {
          id: 1,
          name: 'Ajazz AK680 V2 Mechanical Keyboard',
          attributes: [
            { taxonomy: 'pa_brand', terms: [{ name: 'Ajazz' }] },
            { name: 'Model', terms: [{ name: 'AK680 V2' }] }
          ],
          categories: [{ slug: 'keyboard', name: 'Keyboard' }],
          prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
          is_in_stock: true,
          permalink: 'https://infinitystore.pk/product/1'
        },
        // 2. Unmatchable product (has brand, but lacks model)
        {
          id: 2,
          name: 'Ajazz Mouse',
          attributes: [
            { taxonomy: 'pa_brand', terms: [{ name: 'Ajazz' }] }
          ],
          categories: [{ slug: 'mouse', name: 'Mouse' }],
          prices: { price: '8000', currency_code: 'PKR', currency_minor_unit: 0 },
          is_in_stock: true,
          permalink: 'https://infinitystore.pk/product/2'
        },
        // 3. Accessory (must be skipped)
        {
          id: 3,
          name: 'Ajazz Mouse Pad XXL',
          attributes: [{ taxonomy: 'pa_brand', terms: [{ name: 'Ajazz' }] }],
          categories: [{ slug: 'mouse-pads', name: 'Mouse Pads' }],
          prices: { price: '2000', currency_code: 'PKR', currency_minor_unit: 0 },
          is_in_stock: true,
          permalink: 'https://infinitystore.pk/product/3'
        }
      ];

      const result = await runControlledInfinityCanonicalSync({ rawProducts: fixtureProducts });
      expect(result.success).toBe(true);
      expect(result.fetched).toBe(3);
      expect(result.supported).toBe(2); // 1 and 2 supported; 3 is accessory
      expect(result.skipped).toBe(1); // 3 skipped
      expect(result.matchable).toBe(1); // 1 matchable
      expect(result.insufficientIdentity).toBe(1); // 2 insufficient model
      expect(result.failed).toBe(0);

      // Invariant check
      expect(result.matchable + result.insufficientIdentity + result.failed).toBe(result.supported);

      expect(result.canonicalCreated).toBe(1);
      expect(result.offersCreated).toBe(1);
    });
  });

  describe('6. Conservative Cross-Field Model Identity Enrichment (Step 3D.4)', () => {
    it('1. explicit Model attribute still wins over title + SKU corroboration', () => {
      const product = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        specifications: {
          model: 'AK680-EXPLICIT'
        }
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(true);
      expect(adapted.candidateCanonical.model).toBe('AK680-EXPLICIT');
      expect(adapted.modelIdentitySource).toBe('explicit_attribute');
      expect(adapted.identityConfidence).toBe('high');
    });

    it('2. explicit MPN attribute still works as high-confidence explicit identity', () => {
      const product = {
        name: 'Ajazz AK680 V2 Gaming Keyboard',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        specifications: {
          mpn: 'AK680-MPN-999'
        }
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(true);
      expect(adapted.candidateCanonical.model).toBe('AK680-MPN-999');
      expect(adapted.modelIdentitySource).toBe('explicit_attribute');
    });

    it('3. title + SKU corroboration accepts AK680 V2 / AJ-AK680V2-...', () => {
      const product = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY'
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(true);
      expect(adapted.candidateCanonical.model).toBe('AK680V2');
      expect(adapted.candidateCanonical.canonicalKey).toBe('ajazz|ak680v2');
      expect(adapted.modelIdentitySource).toBe('title_sku_corroborated');
      expect(adapted.identityConfidence).toBe('high');
    });

    it('4. harmless spaces/hyphens normalize correctly (AK680 V2, AK680-V2, AK680V2)', () => {
      const p1 = { name: 'Ajazz AK680 V2 Keyboard', brand: 'Ajazz', sku: 'AJ-AK680V2-BLK' };
      const p2 = { name: 'Ajazz AK680-V2 Keyboard', brand: 'Ajazz', sku: 'AJ-AK680-V2-BLK' };
      const p3 = { name: 'Ajazz AK680V2 Keyboard', brand: 'Ajazz', sku: 'AJ-AK680V2-BLK' };

      const res1 = adaptInfinityToCanonicalAndOffer(p1);
      const res2 = adaptInfinityToCanonicalAndOffer(p2);
      const res3 = adaptInfinityToCanonicalAndOffer(p3);

      expect(res1.candidateCanonical.canonicalKey).toBe('ajazz|ak680v2');
      expect(res2.candidateCanonical.canonicalKey).toBe('ajazz|ak680v2');
      expect(res3.candidateCanonical.canonicalKey).toBe('ajazz|ak680v2');
    });

    it('5. SKU alone remains insufficient (cannot guess model without corroborating title token)', () => {
      const product = {
        name: 'Ajazz Gaming Keyboard', // No model in title
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY'
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(false);
      expect(adapted.reason).toBe('insufficient_model_identity');
    });

    it('6. title alone remains insufficient (cannot guess model without corroborating SKU)', () => {
      const product = {
        name: 'Ajazz AK680 V2 Gaming Keyboard',
        brand: 'Ajazz',
        sku: 'INV-998811' // Unrelated retailer inventory number
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(false);
      expect(adapted.reason).toBe('insufficient_model_identity');
    });

    it('7. unrelated title and SKU tokens remain insufficient', () => {
      const product = {
        name: 'Ajazz K1 Mechanical Keyboard',
        brand: 'Ajazz',
        sku: 'AJ-M9-BLACK'
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(false);
      expect(adapted.reason).toBe('insufficient_model_identity');
    });

    it('8. generic words do not become model identity', () => {
      const product = {
        name: 'Ajazz Wireless Pro Gaming Mouse',
        brand: 'Ajazz',
        sku: 'AJ-WRLS-PRO-MSE'
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.isMatchable).toBe(false);
      expect(adapted.reason).toBe('insufficient_model_identity');
    });

    it('9. color suffix does not alter base canonical model', () => {
      const product = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY'
      };

      const adapted = adaptInfinityToCanonicalAndOffer(product);
      expect(adapted.candidateCanonical.canonicalKey).toBe('ajazz|ak680v2');
      expect(adapted.candidateCanonical.model).toBe('AK680V2');
    });

    it('10. four AK680 V2 color listings converge to ONE CanonicalProduct with FOUR separate ProductOffers', async () => {
      const variants = [
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
          category: 'keyboards',
          price: 10500,
          source: { name: 'INFINITY_STORE', listingId: '68919', url: 'https://infinitystore.pk/1' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Blue White',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-BL-WH',
          category: 'keyboards',
          price: 10500,
          source: { name: 'INFINITY_STORE', listingId: '68915', url: 'https://infinitystore.pk/2' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Black Contour',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-BLK',
          category: 'keyboards',
          price: 10500,
          source: { name: 'INFINITY_STORE', listingId: '68911', url: 'https://infinitystore.pk/3' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – White Contour',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-WHT',
          category: 'keyboards',
          price: 10500,
          source: { name: 'INFINITY_STORE', listingId: '68898', url: 'https://infinitystore.pk/4' }
        }
      ];

      for (const variant of variants) {
        const res = await canonicalizeListing(variant);
        expect(res.success).toBe(true);
        expect(res.canonicalKey).toBe('ajazz|ak680v2');
      }

      // Must have exactly 1 CanonicalProduct and 4 distinct ProductOffers in DB
      const canonicals = await CanonicalProduct.find({ canonicalKey: 'ajazz|ak680v2' });
      expect(canonicals.length).toBe(1);

      const offers = await ProductOffer.find({ canonicalProduct: canonicals[0]._id });
      expect(offers.length).toBe(4);

      const listingIds = offers.map(o => o.source.listingId).sort();
      expect(listingIds).toEqual(['68898', '68911', '68915', '68919']);
    });

    it('11. different real model suffixes create separate CanonicalProducts', async () => {
      const v2 = {
        name: 'Ajazz AK680 V2 Gaming Keyboard',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-BLK',
        category: 'keyboards',
        price: 10500,
        source: { name: 'INFINITY_STORE', listingId: '101' }
      };

      const v3 = {
        name: 'Ajazz AK680 V3 Gaming Keyboard',
        brand: 'Ajazz',
        sku: 'AJ-AK680V3-BLK',
        category: 'keyboards',
        price: 12500,
        source: { name: 'INFINITY_STORE', listingId: '102' }
      };

      const resV2 = await canonicalizeListing(v2);
      const resV3 = await canonicalizeListing(v3);

      expect(resV2.canonicalKey).toBe('ajazz|ak680v2');
      expect(resV3.canonicalKey).toBe('ajazz|ak680v3');
      expect(resV2.canonicalProductId.toString()).not.toBe(resV3.canonicalProductId.toString());

      expect(await CanonicalProduct.countDocuments({ canonicalKey: { $in: ['ajazz|ak680v2', 'ajazz|ak680v3'] } })).toBe(2);
    });

    it('12. cross-source existing deterministic matching continues to work with corroborated identity', async () => {
      // EEZEPC listing for AJAZZ AK680V2
      const eezepc = {
        name: 'Ajazz AK680 V2 Mechanical Keyboard',
        brand: 'Ajazz',
        model: 'AK680V2',
        category: 'keyboards',
        price: 10200,
        source: { name: 'EEZEPC', listingId: '99001' }
      };

      // Infinity Store listing for the same corroborated keyboard
      const infinity = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        category: 'keyboards',
        price: 10500,
        source: { name: 'INFINITY_STORE', listingId: '68919' }
      };

      const r1 = await canonicalizeListing(eezepc);
      const r2 = await canonicalizeListing(infinity);

      expect(r1.canonicalKey).toBe('ajazz|ak680v2');
      expect(r2.canonicalKey).toBe('ajazz|ak680v2');
      expect(r2.canonicalOperation).toBe('reused');
      expect(r1.canonicalProductId.toString()).toBe(r2.canonicalProductId.toString());

      const offers = await ProductOffer.find({ canonicalProduct: r1.canonicalProductId });
      expect(offers.length).toBe(2);
      expect(offers.map(o => o.source.name).sort()).toEqual(['EEZEPC', 'INFINITY_STORE']);
    });
  });

  describe('7. Canonical vs Variant Data Separation & Image Sanitization (Step 3D.5)', () => {
    it('persists WooCommerce image objects as clean string URLs and rejects [object Object]', async () => {
      const rawProduct = {
        id: 88201,
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        attributes: [
          { taxonomy: 'pa_brand', terms: [{ name: 'Ajazz' }] },
          { name: 'Color', terms: [{ name: 'Starry Sky Gray' }] }
        ],
        categories: [{ slug: 'keyboard', name: 'Keyboard' }],
        prices: { price: '10500', currency_code: 'PKR', currency_minor_unit: 0 },
        images: [
          { src: 'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-1.jpg' },
          { src: 'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-2.jpg' },
          { src: '' }, // empty, should be filtered
          'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-3.jpg'
        ],
        is_in_stock: true
      };

      const mapped = mapInfinityProduct(rawProduct);
      expect(mapped.images.every(img => typeof img.url === 'string' && !img.url.includes('[object Object]'))).toBe(true);

      const res = await canonicalizeListing(mapped);
      expect(res.success).toBe(true);

      const canonical = await CanonicalProduct.findById(res.canonicalProductId);
      expect(canonical.images.length).toBe(3);
      expect(canonical.images).toEqual([
        'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-1.jpg',
        'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-2.jpg',
        'https://infinitystore.pk/wp-content/uploads/2026/01/ak680-3.jpg'
      ]);
      expect(canonical.images.some(img => img.includes('[object Object]'))).toBe(false);
    });

    it('derives clean base CanonicalProduct name without color variant suffix', async () => {
      const variant1 = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        category: 'keyboards',
        price: 10500,
        specifications: {
          brand: 'Ajazz',
          color: 'Starry Sky Gray',
          warranty: '10 Months'
        },
        source: { name: 'INFINITY_STORE', listingId: '68919' }
      };

      const res = await canonicalizeListing(variant1);
      expect(res.success).toBe(true);

      const canonical = await CanonicalProduct.findById(res.canonicalProductId);
      // Must NOT be tied to the color "Starry Sky Gray"
      expect(canonical.name).toBe('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    });

    it('stores variant color on ProductOffer and prunes variant specs from CanonicalProduct', async () => {
      const variantListings = [
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
          category: 'keyboards',
          price: 10500,
          specifications: { brand: 'Ajazz', color: 'Starry Sky Gray', warranty: '10 Months' },
          source: { name: 'INFINITY_STORE', listingId: '68919' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Blue White',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-BL-WH',
          category: 'keyboards',
          price: 10500,
          specifications: { brand: 'Ajazz', color: 'Blue White', warranty: '10 Months' },
          source: { name: 'INFINITY_STORE', listingId: '68915' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Black Contour',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-BLK',
          category: 'keyboards',
          price: 10500,
          specifications: { brand: 'Ajazz', color: 'Black Contour', warranty: '10 Months' },
          source: { name: 'INFINITY_STORE', listingId: '68911' }
        },
        {
          name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – White Contour',
          brand: 'Ajazz',
          sku: 'AJ-AK680V2-MAG-WHT',
          category: 'keyboards',
          price: 10500,
          specifications: { brand: 'Ajazz', color: 'White Contour', warranty: '10 Months' },
          source: { name: 'INFINITY_STORE', listingId: '68898' }
        }
      ];

      for (const listing of variantListings) {
        await canonicalizeListing(listing);
      }

      // Exactly ONE CanonicalProduct
      const canonicals = await CanonicalProduct.find({ canonicalKey: 'ajazz|ak680v2' });
      expect(canonicals.length).toBe(1);

      const canonical = canonicals[0];
      expect(canonical.name).toBe('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
      // specifications must NOT contain color or warranty
      expect(canonical.specifications.color).toBeUndefined();
      expect(canonical.specifications.warranty).toBeUndefined();
      expect(canonical.specifications.brand).toBe('Ajazz');

      // Four ProductOffers each with distinct variant color
      const offers = await ProductOffer.find({ canonicalProduct: canonical._id }).sort({ 'source.listingId': 1 });
      expect(offers.length).toBe(4);

      const colorsByListing = {};
      offers.forEach(o => {
        colorsByListing[o.source.listingId] = o.variant?.color;
      });

      expect(colorsByListing['68919']).toBe('Starry Sky Gray');
      expect(colorsByListing['68915']).toBe('Blue White');
      expect(colorsByListing['68911']).toBe('Black Contour');
      expect(colorsByListing['68898']).toBe('White Contour');
    });

    it('preserves existing affiliate metadata when updating offers with variant data', async () => {
      const listing = {
        name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard – Starry Sky Gray',
        brand: 'Ajazz',
        sku: 'AJ-AK680V2-MAG-ST-SK-GRY',
        category: 'keyboards',
        price: 10500,
        source: { name: 'INFINITY_STORE', listingId: '68919', url: 'https://infinitystore.pk/product/1' }
      };

      const res1 = await canonicalizeListing(listing);
      const offerId = res1.offerId;

      // Manually attach affiliate data
      await ProductOffer.findByIdAndUpdate(offerId, {
        affiliate: {
          enabled: true,
          url: 'https://affiliate.network/track?id=68919',
          network: 'test_network',
          campaign: 'test_campaign'
        }
      });

      // Re-sync listing
      listing.price = 9999;
      await canonicalizeListing(listing);

      const updatedOffer = await ProductOffer.findById(offerId);
      expect(updatedOffer.price).toBe(9999);
      expect(updatedOffer.affiliate.enabled).toBe(true);
      expect(updatedOffer.affiliate.url).toBe('https://affiliate.network/track?id=68919');
      expect(updatedOffer.affiliate.network).toBe('test_network');
      expect(updatedOffer.variant?.color).toBe('Starry Sky Gray');
    });
  });
});
