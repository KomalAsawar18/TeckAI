const mongoose = require('mongoose');
const cheerio = require('cheerio');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');
const { classifyAudioSubtype } = require('../src/catalog/deriveCanonicalFacts');

require('dotenv').config();

const TRUSTED_HOSTS = [
  'eezepc.com',
  'infinitystore.pk',
  'wp.com', // Jetpack CDN
];

const BANNED_IMAGE_PATTERNS = [
  'pixel', 'tracker', 'logo', 'icon', 'placeholder', 'avatar',
  '1x1', 'blank', 'spinner', 'lazy', 'data:image'
];

function isValidImage(url, sourceHost) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Must be from sourceHost or trusted CDN
    const isTrusted = TRUSTED_HOSTS.some(t => host.includes(t)) || (sourceHost && host.includes(sourceHost));
    if (!isTrusted) return false;

    const lowerUrl = url.toLowerCase();
    for (const pattern of BANNED_IMAGE_PATTERNS) {
      if (lowerUrl.includes(pattern)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

async function scrapeImages(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      return { success: false, reason: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const parsedUrl = new URL(url);
    const sourceHost = parsedUrl.hostname;

    let scrapedUrls = [];

    // 1. JSON-LD Product.image
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data];
        for (const item of graph) {
          if (item['@type'] === 'Product' && item.image) {
            const images = Array.isArray(item.image) ? item.image : [item.image];
            for (const img of images) {
              if (typeof img === 'string') {
                scrapedUrls.push(img);
              } else if (img && typeof img === 'object' && typeof img.url === 'string') {
                scrapedUrls.push(img.url);
              } else if (img && typeof img === 'object' && typeof img.contentUrl === 'string') {
                scrapedUrls.push(img.contentUrl);
              }
            }
          }
        }
      } catch (e) {}
    });

    // 2. WooCommerce Gallery
    $('.woocommerce-product-gallery__image img').each((_, el) => {
      const src = $(el).attr('data-large_image') || $(el).attr('src');
      if (src) scrapedUrls.push(src);
    });

    // 3. OG Image (fallback)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) scrapedUrls.push(ogImage);

    // Filter and deduplicate
    scrapedUrls = [...new Set(scrapedUrls.map(u => u.trim()))];
    scrapedUrls = scrapedUrls.filter(u => isValidImage(u, sourceHost));

    return { success: true, images: scrapedUrls };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

async function runEnrichment() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teckai');
  console.log('Connected to MongoDB.');

  const products = await CanonicalProduct.find().populate('category');
  
  let inspected = 0;
  let missingBefore = 0;
  let apiRecovered = 0;
  let htmlRecovered = 0;
  let stillMissing = 0;
  let blockedFailed = 0;
  let subtypes = {};

  for (const product of products) {
    inspected++;
    const isHeadphone = product.category && (product.category.slug === 'headphones' || product.category.name === 'Headphones');
    const needsImage = !product.images || product.images.length === 0;
    const needsSubtype = isHeadphone && (!product.specifications || !product.specifications.audioSubtype);

    if (!needsImage && !needsSubtype) {
      if (isHeadphone && product.specifications && product.specifications.audioSubtype) {
        subtypes[product.specifications.audioSubtype] = (subtypes[product.specifications.audioSubtype] || 0) + 1;
      }
      continue;
    }

    if (needsImage) missingBefore++;

    let updateData = {};
    let isModified = false;

    // Subtype Classification
    if (needsSubtype) {
      const subtype = classifyAudioSubtype(product.name, product.specifications || {});
      if (subtype !== 'unknown') {
        updateData['specifications.audioSubtype'] = subtype;
        subtypes[subtype] = (subtypes[subtype] || 0) + 1;
        isModified = true;
      }
    }

    // Image Enrichment
    if (needsImage) {
      const offers = await ProductOffer.find({ canonicalProduct: product._id }).sort({ 'price.amount': 1 });
      if (offers.length > 0) {
        const bestOffer = offers[0];
        
        // Check API/source metadata in offer
        let foundImages = [];
        if (bestOffer.sourceData && Array.isArray(bestOffer.sourceData.images)) {
          for (const img of bestOffer.sourceData.images) {
            let src = typeof img === 'string' ? img : (img.url || img.src);
            if (src && typeof src === 'string') {
              src = src.trim();
              if (src.startsWith('http')) foundImages.push(src);
            }
          }
        }
        
        foundImages = foundImages.filter(u => isValidImage(u, bestOffer.sourceUrl ? new URL(bestOffer.sourceUrl).hostname : null));
        
        if (foundImages.length > 0) {
          updateData.images = foundImages;
          apiRecovered++;
          isModified = true;
        } else if (bestOffer.sourceUrl) {
          const scrapeRes = await scrapeImages(bestOffer.sourceUrl);
          if (scrapeRes.success && scrapeRes.images.length > 0) {
            updateData.images = scrapeRes.images;
            htmlRecovered++;
            isModified = true;
          } else if (!scrapeRes.success) {
            console.log(`Failed to scrape ${bestOffer.sourceUrl}: ${scrapeRes.reason}`);
            blockedFailed++;
          }
        }
      }
    }

    if (isModified) {
      await CanonicalProduct.updateOne({ _id: product._id }, { $set: updateData });
    }

    if (needsImage && !updateData.images) {
      stillMissing++;
    }
  }

  console.log('=== Enrichment Results ===');
  console.log(`Total Canonical Products Inspected: ${inspected}`);
  console.log(`Missing Images Before: ${missingBefore}`);
  console.log(`Images Recovered from API/Source Metadata: ${apiRecovered}`);
  console.log(`Images Recovered from HTML/JSON-LD/Gallery: ${htmlRecovered}`);
  console.log(`Still Missing Images: ${stillMissing}`);
  console.log(`Blocked/Failed Source Fetches: ${blockedFailed}`);
  console.log('Headphone Subtype Distribution:');
  console.log(JSON.stringify(subtypes, null, 2));

  await mongoose.disconnect();
}

runEnrichment().catch(console.error);
