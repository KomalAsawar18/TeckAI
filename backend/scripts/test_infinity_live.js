const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const { runControlledInfinityCanonicalSync } = require('../src/ingestion/sources/infinity/controlledSync');

async function runLiveValidation() {
  console.log('=== Step 3D.3 — Infinity Store Live Controlled Sync Validation ===');
  await mongoose.connect(process.env.MONGODB_URI);

  const initialCanonicalCount = await CanonicalProduct.countDocuments();
  const initialOfferCount = await ProductOffer.countDocuments();
  console.log(`Initial DB State: ${initialCanonicalCount} CanonicalProducts, ${initialOfferCount} ProductOffers`);

  // 1. First Live Run (small bounded sample: page 1, limit 5)
  console.log('\n--- 1. Executing First Live Controlled Run (page 1, limit 5) ---');
  const run1 = await runControlledInfinityCanonicalSync({ page: 1, limit: 5 });
  console.log('Run 1 Summary:');
  console.log(JSON.stringify({
    fetched: run1.fetched,
    supported: run1.supported,
    matchable: run1.matchable,
    insufficientIdentity: run1.insufficientIdentity,
    failed: run1.failed,
    canonicalCreated: run1.canonicalCreated,
    canonicalReused: run1.canonicalReused,
    offersCreated: run1.offersCreated,
    offersUpdated: run1.offersUpdated,
    skipped: run1.skipped
  }, null, 2));

  console.log('\nRun 1 Listing Details:');
  run1.details.forEach(d => {
    if (d.status === 'canonicalized') {
      console.log(`- [${d.status}] ID: ${d.listingId} - "${d.name}"`);
      console.log(`    Brand: ${d.brand}`);
      console.log(`    Accepted Model: ${d.model}`);
      console.log(`    Identity Evidence: Source=${d.modelIdentitySource}, Confidence=${d.identityConfidence}`);
      console.log(`    CanonicalKey: ${d.canonicalKey}`);
      console.log(`    CanonicalOp: ${d.canonicalOperation}, OfferOp: ${d.offerOperation}`);
    } else {
      console.log(`- [${d.status}] ID: ${d.listingId || d.rawId} - "${d.name}" (Reason: ${d.reason || d.error})`);
    }
  });

  const postRun1CanonicalCount = await CanonicalProduct.countDocuments();
  const postRun1OfferCount = await ProductOffer.countDocuments();
  console.log(`\nPost-Run 1 DB State: ${postRun1CanonicalCount} CanonicalProducts, ${postRun1OfferCount} ProductOffers`);

  // 2. Second Live Run (Exact same page to test idempotency and update-in-place)
  console.log('\n--- 2. Executing Second Live Controlled Run (Re-sync Idempotency Test) ---');
  const run2 = await runControlledInfinityCanonicalSync({ page: 1, limit: 5 });
  console.log('Run 2 Summary:');
  console.log(JSON.stringify({
    fetched: run2.fetched,
    supported: run2.supported,
    matchable: run2.matchable,
    insufficientIdentity: run2.insufficientIdentity,
    failed: run2.failed,
    canonicalCreated: run2.canonicalCreated,
    canonicalReused: run2.canonicalReused,
    offersCreated: run2.offersCreated,
    offersUpdated: run2.offersUpdated,
    skipped: run2.skipped
  }, null, 2));

  const postRun2CanonicalCount = await CanonicalProduct.countDocuments();
  const postRun2OfferCount = await ProductOffer.countDocuments();
  console.log(`\nPost-Run 2 DB State: ${postRun2CanonicalCount} CanonicalProducts, ${postRun2OfferCount} ProductOffers`);

  // 3. Inspect Canonical Products & Offers Details
  console.log('\n--- 3. Detailed Inspection of Canonical Products & Offers ---');
  const allCanonicals = await CanonicalProduct.find({});
  let crossSourceMatchFound = false;

  for (const cp of allCanonicals) {
    const offers = await ProductOffer.find({ canonicalProduct: cp._id });
    const sources = [...new Set(offers.map(o => o.source.name))];
    console.log(`\n======================================================`);
    console.log(`CanonicalProduct ID: ${cp._id}`);
    console.log(`CanonicalProduct Name: "${cp.name}"`);
    console.log(`CanonicalKey: "${cp.canonicalKey}"`);
    console.log(`Brand: "${cp.brand}", Model: "${cp.model}"`);
    console.log(`Specifications:`, JSON.stringify(cp.specifications, null, 2));
    console.log(`Images (${cp.images.length}):`, cp.images);
    console.log(`Total Offers: ${offers.length} from [${sources.join(', ')}]`);
    console.log(`Offers Breakdown:`);
    offers.forEach((o, idx) => {
      console.log(`  ${idx + 1}. [${o.source.name}] ID: ${o.source.listingId} - Price: Rs. ${o.price} - Variant Color: ${o.variant?.color || 'N/A'} - URL: ${o.sourceUrl}`);
    });

    if (sources.includes('EEZEPC') && sources.includes('INFINITY_STORE')) {
      crossSourceMatchFound = true;
      console.log(`  >>> GENUINE CROSS-SOURCE MATCH FOUND for ${cp.canonicalKey}! <<<`);
    }
  }

  if (!crossSourceMatchFound) {
    console.log('\nResult: no_cross_source_match_found in this sample.');
  }

  await mongoose.disconnect();
  console.log('\n=== Live Validation Finished ===');
}

runLiveValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
