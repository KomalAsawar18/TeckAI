import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCatalog from './ProductCatalog';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getCategories: vi.fn(),
    getCanonicalProducts: vi.fn()
  }
}));

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({
    isInWishlist: () => false,
    toggleWishlist: () => {}
  })
}));

const mockCategories = [
  { _id: 'cat-1', name: 'Keyboards', slug: 'keyboards' },
  { _id: 'cat-2', name: 'Monitors', slug: 'monitors' },
  { _id: 'cat-3', name: 'Laptops', slug: 'laptops' }
];

const mockCanonicalProducts = [
  {
    id: '6a8ff196815cc0cab334e6ba',
    name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
    brand: 'Ajazz',
    model: 'AK680V2',
    category: {
      id: 'cat-1',
      name: 'Keyboards',
      slug: 'keyboards'
    },
    images: [],
    bestOffer: {
      id: 'offer-1',
      seller: 'Infinity Store Pakistan',
      price: 10500,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Blue White' },
      redirectUrl: '/api/offers/offer-1/redirect'
    },
    offerCount: 4,
    sellerCount: 1,
    sourceCount: 1
  },
  {
    id: '6a8ff1f61c76981c081b8e4f',
    name: 'ASUS ROG Strix 32-inch Gaming Monitor',
    brand: 'ASUS',
    model: 'XG32UCWG',
    category: {
      id: 'cat-2',
      name: 'Monitors',
      slug: 'monitors'
    },
    images: ['https://eezepc.com/uploads/asus-1.jpg'],
    bestOffer: {
      id: 'offer-2',
      seller: 'EEZEPC',
      price: 55000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: null,
      redirectUrl: '/api/offers/offer-2/redirect'
    },
    offerCount: 1,
    sellerCount: 1,
    sourceCount: 1
  }
];

describe('ProductCatalog Component (Canonical Catalog Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCategories.mockResolvedValue({ success: true, data: mockCategories });
    api.getCanonicalProducts.mockResolvedValue({
      success: true,
      products: mockCanonicalProducts,
      pagination: { page: 1, limit: 12, total: 2, totalPages: 1 }
    });
  });

  test('loads canonical catalog API and renders products with best offers', async () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <ProductCatalog />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.getCanonicalProducts).toHaveBeenCalled();
    });

    expect(screen.getByText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard')).toBeDefined();
    expect(screen.getByText('From PKR 10,500')).toBeDefined();
    expect(screen.getByText('Infinity Store Pakistan')).toBeDefined();
    expect(screen.getByText('4 offers')).toBeDefined();

    expect(screen.getByText('ASUS ROG Strix 32-inch Gaming Monitor')).toBeDefined();
    expect(screen.getByText('From PKR 55,000')).toBeDefined();
    expect(screen.getByText('EEZEPC')).toBeDefined();
  });

  test('passes canonical-compatible filter parameters from URL', async () => {
    render(
      <MemoryRouter initialEntries={['/products?category=keyboards&brand=Ajazz&sort=price_asc&minPrice=5000&maxPrice=15000']}>
        <ProductCatalog />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.getCanonicalProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'keyboards',
          brand: 'Ajazz',
          sort: 'price_asc',
          minPrice: '5000',
          maxPrice: '15000'
        })
      );
    });
  });

  test('renders "No products found" when category has no canonical records', async () => {
    api.getCanonicalProducts.mockResolvedValueOnce({
      success: true,
      products: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 }
    });

    render(
      <MemoryRouter initialEntries={['/products?category=laptops']}>
        <ProductCatalog />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No products found')).toBeDefined();
    });
  });
});
