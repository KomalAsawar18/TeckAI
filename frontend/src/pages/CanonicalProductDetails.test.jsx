import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CanonicalProductDetails from './CanonicalProductDetails';
import { api } from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      getCanonicalProduct: vi.fn(),
      getCanonicalProductOffers: vi.fn()
    }
  };
});

const mockCanonicalProduct = {
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
  specifications: {
    brand: 'Ajazz',
    switchType: 'Magnetic Switch',
    layout: '68 Keys'
  },
  bestOffer: {
    id: 'offer-1',
    seller: 'Infinity Store Pakistan',
    price: 10500,
    currency: 'PKR',
    availability: 'in_stock',
    condition: 'new',
    variant: {
      color: 'Blue White'
    },
    redirectUrl: '/api/offers/offer-1/redirect'
  },
  offerCount: 4,
  sellerCount: 1,
  sourceCount: 1
};

const mockOffersResponse = {
  canonicalProduct: {
    id: '6a8ff196815cc0cab334e6ba',
    name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard'
  },
  bestOffer: mockCanonicalProduct.bestOffer,
  rankedOffers: [
    {
      id: 'offer-1',
      seller: { name: 'Infinity Store Pakistan' },
      price: 10500,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Blue White' }
    },
    {
      id: 'offer-2',
      seller: { name: 'Infinity Store Pakistan' },
      price: 10500,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Starry Sky Gray' }
    },
    {
      id: 'offer-3',
      seller: { name: 'Infinity Store Pakistan' },
      price: 11000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Black Contour' }
    },
    {
      id: 'offer-4',
      seller: { name: 'Infinity Store Pakistan' },
      price: 11000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'White Contour' }
    }
  ]
};

import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';
import { CartProvider } from '../context/CartContext';

describe('CanonicalProductDetails Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCanonicalProduct.mockResolvedValue({ success: true, product: mockCanonicalProduct });
    api.getCanonicalProductOffers.mockResolvedValue(mockOffersResponse);
  });

  const renderWithProviders = (ui) => {
    return render(
      <MemoryRouter initialEntries={['/canonical-products/6a8ff196815cc0cab334e6ba']}>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <Routes>
                <Route path="/canonical-products/:id" element={ui} />
              </Routes>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  test('loads canonical product by ID and renders product info, specs, and best offer', async () => {
    renderWithProviders(<CanonicalProductDetails />);

    await waitFor(() => {
      expect(api.getCanonicalProduct).toHaveBeenCalledWith('6a8ff196815cc0cab334e6ba');
    });

    // Verify Title & Brand & Model
    expect(screen.getByText('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard')).toBeDefined();
    expect(screen.getAllByText('Ajazz').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('• Model: AK680V2')).toBeDefined();

    // Verify Specs
    expect(screen.getByText('Switch Type')).toBeDefined();
    expect(screen.getByText('Magnetic Switch')).toBeDefined();

    // Verify Best Offer details
    expect(screen.getByText('Best Comparable Deal')).toBeDefined();
    expect(screen.getAllByText('PKR 10,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Infinity Store Pakistan').length).toBeGreaterThanOrEqual(1);
  });

  test('renders all available offers separately and points "View Deal" to safe redirect route', async () => {
    renderWithProviders(<CanonicalProductDetails />);

    await waitFor(() => {
      expect(screen.getByText('Available Offers (4)')).toBeDefined();
    });

    // Check all variants rendered
    expect(screen.getAllByText('Blue White').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Starry Sky Gray')).toBeDefined();
    expect(screen.getByText('Black Contour')).toBeDefined();
    expect(screen.getByText('White Contour')).toBeDefined();

    // Check View Deal anchor tags
    const links = screen.getAllByRole('link');
    const redirectLinks = links.filter(l => l.getAttribute('href')?.includes('/api/offers/'));
    expect(redirectLinks.length).toBeGreaterThanOrEqual(4);

    // Verify all deal links route to backend API origin, not frontend relative or origin
    redirectLinks.forEach(l => {
      const href = l.getAttribute('href') || '';
      expect(href).toMatch(/^http:\/\/localhost:5000\/api\/offers\/[^\/]+\/redirect$/);
      expect(href).not.toContain('localhost:5173');
      expect(href).not.toContain('infinitystore.pk/wp-admin');
      expect(href).not.toContain('affiliate_token');
      expect(href).not.toContain('secret_tracking');
      expect(l.getAttribute('target')).toBe('_blank');
      expect(l.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});
