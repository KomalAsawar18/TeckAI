import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';

vi.mock('../../context/WishlistContext', () => ({
  useWishlist: () => ({
    isInWishlist: () => false,
    toggleWishlist: () => {}
  })
}));

const mockLegacyProduct = {
  name: 'ThinkPad X1 Carbon',
  slug: 'thinkpad-x1-carbon',
  sku: 'LNV-X1C-G11',
  brand: 'Lenovo',
  price: 350000,
  currency: 'PKR',
  stock: 12,
  rating: 4.8,
  images: []
};

const mockCanonicalAjazzProduct = {
  id: '6a8ff196815cc0cab334e6ba',
  name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
  brand: 'Ajazz',
  model: 'AK680V2',
  category: {
    id: '6a8ff196815cc0cab334e6b8',
    name: 'Keyboards',
    slug: 'keyboards'
  },
  images: [],
  bestOffer: {
    id: '6a8ff1b8e704060b361a376f',
    seller: 'Infinity Store Pakistan',
    price: 10500,
    currency: 'PKR',
    availability: 'in_stock',
    condition: 'new',
    variant: {
      color: 'Blue White'
    },
    redirectUrl: '/api/offers/6a8ff1b8e704060b361a376f/redirect'
  },
  offerCount: 4,
  sellerCount: 1,
  sourceCount: 1
};

describe('ProductCard Component', () => {
  test('renders legacy product details correctly', () => {
    render(
      <MemoryRouter>
        <ProductCard product={mockLegacyProduct} />
      </MemoryRouter>
    );

    expect(screen.getByText('Lenovo')).toBeDefined();
    expect(screen.getByText('ThinkPad X1 Carbon')).toBeDefined();
    expect(screen.getByText('PKR 350,000')).toBeDefined();
    expect(screen.getByText('12 in stock')).toBeDefined();
  });

  test('renders canonical Ajazz product with bestOffer price, seller, offerCount, and placeholder image', () => {
    render(
      <MemoryRouter>
        <ProductCard product={mockCanonicalAjazzProduct} />
      </MemoryRouter>
    );

    // Verify brand and model
    expect(screen.getByText('Ajazz')).toBeDefined();
    expect(screen.getByText('• AK680V2')).toBeDefined();
    expect(screen.getByText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard')).toBeDefined();

    // Verify bestOffer price
    expect(screen.getByText('From PKR 10,500')).toBeDefined();

    // Verify seller and offerCount
    expect(screen.getByText('Infinity Store Pakistan')).toBeDefined();
    expect(screen.getByText('4 offers')).toBeDefined();

    // Verify in stock status (no fake numeric count)
    expect(screen.getByText('In stock')).toBeDefined();

    // Verify placeholder image
    const img = screen.getByAltText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    expect(img.getAttribute('src')).toContain('placehold.co');

    // Verify links to canonical route
    const link = screen.getAllByRole('link').find(l => l.getAttribute('href') === '/canonical-products/6a8ff196815cc0cab334e6ba');
    expect(link).toBeDefined();
  });

  test('valid image URL renders directly', () => {
    const productWithValidImage = {
      ...mockCanonicalAjazzProduct,
      images: ['https://example.com/products/ak680.jpg']
    };

    render(
      <MemoryRouter>
        <ProductCard product={productWithValidImage} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    expect(img.getAttribute('src')).toBe('https://example.com/products/ak680.jpg');
  });

  test('empty images array uses TeckAI placeholder', () => {
    const productWithEmptyImages = {
      ...mockCanonicalAjazzProduct,
      images: []
    };

    render(
      <MemoryRouter>
        <ProductCard product={productWithEmptyImages} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    expect(img.getAttribute('src')).toBe('https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI');
  });

  test('invalid image values (non-http, empty string, malformed) use placeholder', () => {
    const productWithInvalidImages = {
      ...mockCanonicalAjazzProduct,
      images: ['not-a-valid-url', '', null]
    };

    render(
      <MemoryRouter>
        <ProductCard product={productWithInvalidImages} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    expect(img.getAttribute('src')).toBe('https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI');
  });

  test('remote image load failure switches to placeholder via onError without infinite loop', () => {
    const { fireEvent } = require('@testing-library/react');
    const productWithBrokenRemote = {
      ...mockCanonicalAjazzProduct,
      images: ['https://broken-cdn.example.com/image-404.jpg']
    };

    render(
      <MemoryRouter>
        <ProductCard product={productWithBrokenRemote} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
    expect(img.getAttribute('src')).toBe('https://broken-cdn.example.com/image-404.jpg');

    // Simulate broken image trigger
    fireEvent.error(img);

    expect(img.getAttribute('src')).toBe('https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI');
    expect(img.onerror).toBeNull();
  });
});


