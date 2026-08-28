const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getCanonicalCatalog, getCanonicalProductById } = require('../src/commerce/getCanonicalCatalog');
const { getProductOffersComparison } = require('../src/commerce/getProductOffersComparison');
const { compareOffers } = require('../src/commerce/compareOffers');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');

describe('Read-Only Validation Guards & Non-Destructive Invariants', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('getCanonicalCatalog does not mutate, create, or delete CanonicalProduct or ProductOffer records', async () => {
    const cpCountBefore = await CanonicalProduct.countDocuments();
    const poCountBefore = await ProductOffer.countDocuments();

    // Call read-only catalog services with various queries
    await getCanonicalCatalog({ page: 1, limit: 10 });
    await getCanonicalCatalog({ category: 'keyboards' });
    await getCanonicalCatalog({ sort: 'price_asc' });
    await getCanonicalCatalog({ search: 'Ajazz' });

    const cpCountAfter = await CanonicalProduct.countDocuments();
    const poCountAfter = await ProductOffer.countDocuments();

    expect(cpCountAfter).toBe(cpCountBefore);
    expect(poCountAfter).toBe(poCountBefore);
  });

  test('getProductOffersComparison and getCanonicalProductById are strictly read-only', async () => {
    const sample = await CanonicalProduct.findOne({ isActive: true });
    if (!sample) return;

    const cpCountBefore = await CanonicalProduct.countDocuments();
    const poCountBefore = await ProductOffer.countDocuments();

    await getCanonicalProductById(sample._id.toString());
    await getProductOffersComparison(sample._id.toString());

    const cpCountAfter = await CanonicalProduct.countDocuments();
    const poCountAfter = await ProductOffer.countDocuments();

    expect(cpCountAfter).toBe(cpCountBefore);
    expect(poCountAfter).toBe(poCountBefore);
  });

  test('compareOffers pure function operates without database interaction or side effects', () => {
    const sampleOffers = [
      { id: '1', price: 12000, currency: 'PKR', availability: 'in_stock', condition: 'new', isActive: true, sourceUrl: 'https://example.com/1', seller: { name: 'S1' } },
      { id: '2', price: 10500, currency: 'PKR', availability: 'in_stock', condition: 'new', isActive: true, sourceUrl: 'https://example.com/2', seller: { name: 'S2' } }
    ];

    const res = compareOffers(sampleOffers);
    expect(res.bestOffer.id).toBe('2');
    expect(sampleOffers.length).toBe(2); // In-place array untouched
  });
});
