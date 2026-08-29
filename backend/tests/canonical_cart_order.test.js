const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const Wishlist = require('../src/models/Wishlist');

require('dotenv').config();

jest.setTimeout(60000);

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
  await mongoose.disconnect();
});

describe('Canonical Product Cart, Wishlist & Checkout Bridge Tests', () => {
  let user, token, category, canonicalProduct, offerEezepc, offerInfinity, offerVariantWhite;

  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await CanonicalProduct.deleteMany({});
    await ProductOffer.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Wishlist.deleteMany({});

    user = await User.create({
      name: 'Tester User',
      email: 'tester@example.com',
      password: 'password123',
      role: 'user'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tester@example.com', password: 'password123' });
    token = loginRes.body.data.token;

    category = await Category.create({
      name: 'Laptops',
      slug: 'laptops',
      isActive: true
    });

    canonicalProduct = await CanonicalProduct.create({
      name: 'ASUS ROG Zephyrus G14 Gaming Laptop',
      brand: 'ASUS',
      model: 'GA402',
      category: category._id,
      images: ['https://example.com/g14.jpg'],
      specifications: { ram: '16GB', storage: '1TB' },
      isActive: true
    });

    offerEezepc = await ProductOffer.create({
      canonicalProduct: canonicalProduct._id,
      seller: { name: 'EEZEPC', type: 'retailer', location: 'Karachi' },
      source: { name: 'EEZEPC Ingestion', listingId: 'EEZ-101', url: 'https://eezepc.com/g14?aff=12345', type: 'scraper' },
      price: 350000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Eclipse Gray' },
      stock: 10,
      isActive: true
    });

    offerInfinity = await ProductOffer.create({
      canonicalProduct: canonicalProduct._id,
      seller: { name: 'Infinity Store Pakistan', type: 'retailer', location: 'Lahore' },
      source: { name: 'Infinity Ingestion', listingId: 'INF-202', url: 'https://infinity.pk/g14?track=abcde', type: 'feed' },
      price: 345000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Eclipse Gray' },
      stock: 5,
      isActive: true
    });

    offerVariantWhite = await ProductOffer.create({
      canonicalProduct: canonicalProduct._id,
      seller: { name: 'EEZEPC', type: 'retailer', location: 'Karachi' },
      source: { name: 'EEZEPC Ingestion', listingId: 'EEZ-102', url: 'https://eezepc.com/g14-white', type: 'scraper' },
      price: 360000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Moonlight White' },
      stock: 3,
      isActive: true
    });
  });

  test('1. Same product + different seller = separate cart lines', async () => {
    const items = [
      {
        itemType: 'canonical',
        canonicalProduct: canonicalProduct._id.toString(),
        productOffer: offerEezepc._id.toString(),
        quantity: 1
      },
      {
        itemType: 'canonical',
        canonicalProduct: canonicalProduct._id.toString(),
        productOffer: offerInfinity._id.toString(),
        quantity: 1
      }
    ];

    const res = await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].productOffer._id.toString()).toBe(offerEezepc._id.toString());
    expect(res.body.data.items[1].productOffer._id.toString()).toBe(offerInfinity._id.toString());
    expect(res.body.data.items[0].productOffer.seller.name).toBe('EEZEPC');
    expect(res.body.data.items[1].productOffer.seller.name).toBe('Infinity Store Pakistan');
  });

  test('2. Same product + different variant = separate cart lines', async () => {
    const items = [
      {
        itemType: 'canonical',
        canonicalProduct: canonicalProduct._id.toString(),
        productOffer: offerEezepc._id.toString(),
        variant: { color: 'Eclipse Gray' },
        quantity: 1
      },
      {
        itemType: 'canonical',
        canonicalProduct: canonicalProduct._id.toString(),
        productOffer: offerVariantWhite._id.toString(),
        variant: { color: 'Moonlight White' },
        quantity: 1
      }
    ];

    const res = await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].variant.color).toBe('Eclipse Gray');
    expect(res.body.data.items[1].variant.color).toBe('Moonlight White');
  });

  test('3. Price change requires confirmation before order creation', async () => {
    // 1. Put item into cart with snapshot price of 350000
    await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemType: 'canonical',
          canonicalProduct: canonicalProduct._id.toString(),
          productOffer: offerEezepc._id.toString(),
          quantity: 1
        }]
      });

    // 2. Retailer price updates to 365000 in database
    await ProductOffer.findByIdAndUpdate(offerEezepc._id, { price: 365000 });

    // 3. Attempt checkout without accepting price change
    const shippingAddress = {
      fullName: 'Tester',
      addressLine: '123 Tech Street',
      city: 'Karachi',
      postalCode: '75500',
      country: 'Pakistan'
    };

    const failRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress });

    expect(failRes.status).toBe(409);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.code).toBe('PRICE_CHANGED');
    expect(failRes.body.error.oldPrice).toBe(350000);
    expect(failRes.body.error.newPrice).toBe(365000);

    // 4. Retry checkout with acceptPriceChange: true
    const successRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress, acceptPriceChange: true });

    expect(successRes.status).toBe(201);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.items[0].price).toBe(365000);
    expect(successRes.body.data.subtotal).toBe(365000);
  });

  test('4. Out-of-stock checkout is blocked and preserves item in cart', async () => {
    // 1. Put item into cart
    await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemType: 'canonical',
          canonicalProduct: canonicalProduct._id.toString(),
          productOffer: offerInfinity._id.toString(),
          quantity: 1
        }]
      });

    // 2. Retailer goes out of stock
    await ProductOffer.findByIdAndUpdate(offerInfinity._id, { availability: 'out_of_stock' });

    // 3. Attempt checkout
    const shippingAddress = {
      fullName: 'Tester',
      addressLine: '123 Tech Street',
      city: 'Karachi',
      postalCode: '75500',
      country: 'Pakistan'
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/out of stock/i);

    // 4. Verify item still preserved in cart
    const cart = await Cart.findOne({ user: user._id });
    expect(cart.items).toHaveLength(1);
  });

  test('5. Selected Buy Now offer is preserved and external_supplier order does not claim automated retailer fulfillment', async () => {
    // Put selected offer (Infinity Store) directly into cart
    await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemType: 'canonical',
          canonicalProduct: canonicalProduct._id.toString(),
          productOffer: offerInfinity._id.toString(),
          quantity: 1
        }]
      });

    const shippingAddress = {
      fullName: 'Tester',
      addressLine: '123 Tech Street',
      city: 'Karachi',
      postalCode: '75500',
      country: 'Pakistan'
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const order = res.body.data;
    expect(order.items).toHaveLength(1);
    const orderItem = order.items[0];

    // Preserves selected offer details
    expect(orderItem.productOffer.toString()).toBe(offerInfinity._id.toString());
    expect(orderItem.seller).toBe('Infinity Store Pakistan');
    expect(orderItem.fulfillmentMode).toBe('external_supplier');
    expect(orderItem.price).toBe(345000);
  });

  test('6. Cart and Wishlist API responses do not expose raw affiliate URLs or tracking tokens', async () => {
    // Add canonical product to wishlist
    const wishRes = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ canonicalProductId: canonicalProduct._id.toString(), isCanonical: true });

    expect(wishRes.status).toBe(200);
    expect(wishRes.body.success).toBe(true);
    const canonicalWishItem = wishRes.body.data.canonicalProducts[0];
    expect(canonicalWishItem).toBeDefined();
    // Verify bestOffer redirectUrl is the safe internal redirect endpoint, not the raw affiliate URL
    expect(canonicalWishItem.bestOffer.redirectUrl).toBe(`/api/offers/${offerInfinity._id}/redirect`);
    expect(JSON.stringify(canonicalWishItem)).not.toContain('aff=12345');
    expect(JSON.stringify(canonicalWishItem)).not.toContain('track=abcde');

    // Add to cart
    const cartRes = await request(app)
      .put('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          itemType: 'canonical',
          canonicalProduct: canonicalProduct._id.toString(),
          productOffer: offerEezepc._id.toString(),
          quantity: 1
        }]
      });

    expect(cartRes.status).toBe(200);
    const cartItem = cartRes.body.data.items[0];
    expect(cartItem.productOffer.seller.name).toBe('EEZEPC');
    // Ensure raw source url with affiliate tokens was not projected in populated cart response
    expect(JSON.stringify(cartItem)).not.toContain('aff=12345');
  });
});
