const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ProductOffer = require('../src/models/ProductOffer');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const OfferClick = require('../src/models/OfferClick');
const { resolveOfferDestination } = require('../src/commerce/resolveOfferDestination');
const { redirectOffer } = require('../src/commerce/redirectOffer');

async function runDevCommerceVerification() {
  console.log('=== Step 3C — Dev Commerce & Affiliate Verification ===');
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Find an existing ProductOffer
  const existingOffer = await ProductOffer.findOne({ isActive: true }).populate('canonicalProduct');

  if (!existingOffer) {
    console.log('No active ProductOffer found in DB. Run controlled live canonicalization first.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n[Found Active Offer ${existingOffer._id}]`);
  console.log(`Product: "${existingOffer.canonicalProduct?.name || 'Unknown'}"`);
  console.log(`Seller: ${existingOffer.seller?.name || existingOffer.source?.name}`);
  console.log(`Source URL: ${existingOffer.sourceUrl}`);
  console.log(`Current Affiliate Config:`, existingOffer.affiliate);

  // 2. Verify normal source destination fallback
  console.log('\n--- 1. Testing Default Source Fallback Resolution ---');
  const sourceDest = resolveOfferDestination(existingOffer);
  console.log('Source Destination Result:', sourceDest);

  // 3. Test safe in-memory affiliate destination resolution
  console.log('\n--- 2. Testing In-Memory Affiliate Destination Resolution ---');
  const testAffiliateOffer = {
    ...existingOffer.toObject(),
    affiliate: {
      enabled: true,
      url: 'https://test-affiliate-network.example.com/click?offer_id=TEST_123&partner=teckai',
      network: 'MockAffiliateNetwork (DEV/TEST ONLY)',
      campaign: 'dev_verification_2026'
    }
  };
  const affiliateDest = resolveOfferDestination(testAffiliateOffer);
  console.log('Affiliate Destination Result:', affiliateDest);

  // 4. Test Redirect Service and OfferClick creation on a dedicated test record
  console.log('\n--- 3. Testing Redirect & OfferClick Tracking in DB ---');
  // Create a temporary isolated test offer
  const testOffer = await ProductOffer.create({
    canonicalProduct: existingOffer.canonicalProduct._id,
    seller: { name: 'TeckAI Dev Test Store', type: 'retailer' },
    source: { name: 'DEV_TEST', listingId: `TEST_${Date.now()}` },
    price: 99999,
    sourceUrl: 'https://example.com/product/test-offer',
    affiliate: {
      enabled: true,
      url: 'https://affiliate.example.com/click?test=1',
      campaign: 'test_run'
    },
    isActive: true
  });

  const redirectResult = await redirectOffer(testOffer._id.toString(), { context: 'product_page' });
  console.log('Redirect Execution Result:', redirectResult);

  const recordedClick = await OfferClick.findById(redirectResult.clickId);
  console.log('\n=== Recorded OfferClick Record ===');
  console.log(JSON.stringify(recordedClick, null, 2));

  // Clean up temporary test offer & test click
  await ProductOffer.deleteOne({ _id: testOffer._id });
  await OfferClick.deleteOne({ _id: recordedClick._id });
  console.log('\nCleaned up temporary development test records.');

  await mongoose.disconnect();
  console.log('=== Verification Completed Successfully ===');
}

runDevCommerceVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
