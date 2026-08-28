const { sanitizeImages } = require('../src/catalog/deriveCanonicalFacts');
const { mapProduct } = require('../src/ingestion/sources/eezepc/mapper');
const { mapInfinityProduct } = require('../src/ingestion/sources/infinity/mapper');

describe('Image Extraction Logic', () => {
  it('EEZEPC mapper safely handles [object Object] and extracts valid URLs', () => {
    const raw = {
      id: 1,
      name: 'Test',
      prices: { price: '100', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'mouse', name: 'Mouse' }],
      images: [
        { src: 'https://eezepc.com/1.jpg' },
        { src: 'http://eezepc.com/2.png' },
        { src: '[object Object]' },
        { url: 'https://eezepc.com/3.jpg' }, // not normally in eezepc, but handled by my fix
        'https://eezepc.com/4.jpg'
      ]
    };

    const mapped = mapProduct(raw);
    expect(mapped.images).toContain('https://eezepc.com/1.jpg');
    expect(mapped.images).toContain('http://eezepc.com/2.png');
    expect(mapped.images).toContain('https://eezepc.com/3.jpg');
    expect(mapped.images).toContain('https://eezepc.com/4.jpg');
    expect(mapped.images).not.toContain('[object Object]');
  });

  it('Infinity mapper safely handles [object Object] and extracts valid URLs', () => {
    const raw = {
      id: 1,
      name: 'Test',
      prices: { price: '100', currency_code: 'PKR', currency_minor_unit: 0 },
      categories: [{ slug: 'mouse', name: 'Mouse' }],
      images: [
        { src: 'https://infinity.pk/1.jpg' },
        { url: 'https://infinity.pk/2.jpg' },
        { src: '[object Object]' },
        'https://infinity.pk/3.jpg',
        null,
        undefined,
        { src: 'invalid-url' }
      ]
    };

    const mapped = mapInfinityProduct(raw);
    const urls = mapped.images.map(i => i.url);
    expect(urls).toContain('https://infinity.pk/1.jpg');
    expect(urls).toContain('https://infinity.pk/2.jpg');
    expect(urls).toContain('https://infinity.pk/3.jpg');
    expect(urls).not.toContain('[object Object]');
    expect(urls).not.toContain('invalid-url');
  });
});
