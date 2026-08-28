const cheerio = require('cheerio');

describe('Enrichment Scraper Fallbacks', () => {
  it('extracts og:image', () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/og.jpg" /></head></html>`;
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content');
    expect(ogImage).toBe('https://example.com/og.jpg');
  });

  it('extracts JSON-LD Product.image', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type": "Product", "image": "https://example.com/jsonld.jpg"}
    </script></head></html>`;
    const $ = cheerio.load(html);
    let scraped = '';
    $('script[type="application/ld+json"]').each((_, el) => {
      const data = JSON.parse($(el).html());
      if (data['@type'] === 'Product' && data.image) {
        scraped = data.image;
      }
    });
    expect(scraped).toBe('https://example.com/jsonld.jpg');
  });

  it('extracts WooCommerce Gallery image', () => {
    const html = `<html><body><div class="woocommerce-product-gallery__image"><img src="https://example.com/thumb.jpg" data-large_image="https://example.com/large.jpg" /></div></body></html>`;
    const $ = cheerio.load(html);
    let scraped = '';
    $('.woocommerce-product-gallery__image img').each((_, el) => {
      scraped = $(el).attr('data-large_image') || $(el).attr('src');
    });
    expect(scraped).toBe('https://example.com/large.jpg');
  });
});
