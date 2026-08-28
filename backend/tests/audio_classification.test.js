const { classifyAudioSubtype } = require('../src/catalog/deriveCanonicalFacts');

describe('Audio Subtype Classification', () => {
  it('classifies TWS properly with precedence', () => {
    expect(classifyAudioSubtype('Soundcore Liberty Buds', {})).toBe('true_wireless_earbuds');
    expect(classifyAudioSubtype('Apple AirPods Pro', {})).toBe('true_wireless_earbuds');
    expect(classifyAudioSubtype('Some random TWS headset', {})).toBe('true_wireless_earbuds');
  });

  it('classifies generic earbuds', () => {
    expect(classifyAudioSubtype('Generic Earbuds wired', {})).toBe('earbuds');
  });

  it('classifies in ear monitors', () => {
    expect(classifyAudioSubtype('Kz in ear monitors', {})).toBe('in_ear');
    expect(classifyAudioSubtype('Shure IEM', {})).toBe('in_ear');
  });

  it('classifies over ear', () => {
    expect(classifyAudioSubtype('Sony WH-1000XM5', {})).toBe('over_ear');
    expect(classifyAudioSubtype('Apple AirPods Max', {})).toBe('over_ear');
    expect(classifyAudioSubtype('Generic over ear headphones', {})).toBe('over_ear');
  });

  it('classifies headsets', () => {
    expect(classifyAudioSubtype('Plantronics wired single-ear USB headset', {})).toBe('headset');
    expect(classifyAudioSubtype('Razer gaming headset', {})).toBe('headset');
  });

  it('returns unknown for ambiguous titles', () => {
    expect(classifyAudioSubtype('Generic Audio Device', {})).toBe('unknown');
  });
});
