import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import CanonicalProductDetails from './CanonicalProductDetails';
import { api } from '../services/api';
import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';

vi.mock('../services/api', () => ({
  api: {
    getCanonicalProducts: vi.fn(),
    getProducts: vi.fn(),
    getCategories: vi.fn(),
    getCanonicalProduct: vi.fn(),
    getCanonicalProductOffers: vi.fn()
  }
}));

describe('Home Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderWithProviders = (ui, { initialRoute = '/' } = {}) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <WishlistProvider>
            {ui}
          </WishlistProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  test('renders 5 canonical categories and does not call legacy getCategories', async () => {
    api.getCanonicalProducts.mockResolvedValueOnce({ products: [] });

    renderWithProviders(<Home />);

    expect(screen.getByText('Shop by Category')).toBeDefined();
    expect(screen.getByText('Laptops')).toBeDefined();
    expect(screen.getByText('Monitors')).toBeDefined();
    expect(screen.getByText('Keyboards')).toBeDefined();
    expect(screen.getByText('Mouse')).toBeDefined();
    expect(screen.getByText('Headphones')).toBeDefined();

    expect(api.getCategories).not.toHaveBeenCalled();
    
    // Check links
    const laptopLink = screen.getByRole('link', { name: /Laptops/i });
    expect(laptopLink.getAttribute('href')).toBe('/products?category=laptops');
  });

  test('fetches and renders recommended gear using getCanonicalProducts with selection logic', async () => {
    const mockCanonicalProduct1 = {
      _id: 'prod_123',
      name: 'Sony WH-1000XM5',
      brand: 'Sony',
      model: 'XM5',
      category: 'headphones',
      images: ['https://example.com/sony.jpg'],
      bestOffer: {
        price: 399,
        currency: 'USD',
        seller: 'TechStore',
        availability: 'in_stock'
      },
      offerCount: 2
    };

    const mockCanonicalProduct2 = {
      _id: 'prod_124',
      name: 'Asus ROG Laptop',
      brand: 'Asus',
      model: 'ROG',
      category: 'laptops',
      images: ['https://example.com/asus.jpg'],
      bestOffer: {
        price: 999,
        currency: 'USD',
        seller: 'Infinity',
        availability: 'in_stock'
      },
      offerCount: 1
    };

    const mockCanonicalProduct3 = {
      _id: 'prod_125',
      name: 'Sony XM4',
      brand: 'Sony',
      category: 'headphones',
      images: ['https://example.com/sony4.jpg'],
      bestOffer: {
        price: 299,
        currency: 'USD',
        seller: 'TechStore',
        availability: 'in_stock'
      },
      offerCount: 1
    };

    // API returns 3 products, but only 2 should render (and preferably from different categories)
    api.getCanonicalProducts.mockResolvedValueOnce({ products: [mockCanonicalProduct1, mockCanonicalProduct3, mockCanonicalProduct2] });

    renderWithProviders(<Home />);

    expect(api.getCanonicalProducts).toHaveBeenCalledWith({ limit: 12, sort: 'newest' });
    expect(api.getProducts).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Sony WH-1000XM5')).toBeDefined();
    });

    // Validates compact card labels
    expect(screen.getByText('Sony XM5')).toBeDefined(); // Brand + Model
    expect(screen.getByText('Best price from TechStore')).toBeDefined();
    expect(screen.getByText('Multiple offers')).toBeDefined();
    expect(screen.getByText('USD 399')).toBeDefined();
    
    expect(screen.getByText('Best price from Infinity')).toBeDefined();
    expect(screen.getByText('Best available deal')).toBeDefined();

    // Proves limit is 2 max
    expect(screen.queryByText('Sony XM4')).toBeNull();

    const productLinks = screen.getAllByRole('link');
    // Ensure the product link correctly formats the canonical link
    const hasCanonicalLink = productLinks.some(link => link.getAttribute('href') === '/canonical-products/prod_123');
    expect(hasCanonicalLink).toBe(true);
  });

  test('handles missing or malformed canonical response safely without .slice() crash', async () => {
    api.getCanonicalProducts.mockResolvedValueOnce({}); // Missing products array
    renderWithProviders(<Home />);
    
    // Should not crash and should render empty state
    await waitFor(() => {
      expect(screen.queryByText(/Loading recommended products/)).toBeNull();
    });
    
    expect(screen.getByText('Recommended Gear')).toBeDefined();
    expect(screen.queryByRole('article')).toBeNull(); // No ProductCards
  });

  test('renders AI assistant CTA correctly', () => {
    api.getCanonicalProducts.mockResolvedValueOnce({ products: [] });
    renderWithProviders(<Home />);
    
    expect(screen.getByText('Not sure what you need? Ask TeckAI.')).toBeDefined();
  });

  test('clicking a Recommended Gear product navigates to CanonicalProductDetails and loads mocked canonical data', async () => {
    // 1. Mock the Home page featured response
    const mockHomeProduct = {
      _id: 'prod_integration_123',
      name: 'Integration Test Headphone',
      brand: 'TestBrand',
      category: 'headphones',
      images: ['https://example.com/test.jpg'],
      bestOffer: {
        id: 'mock-offer-123',
        price: 199,
        currency: 'USD',
        seller: 'TestStore',
        availability: 'in_stock'
      },
      offerCount: 1
    };
    
    api.getCanonicalProducts.mockResolvedValueOnce({ products: [mockHomeProduct] });

    // 2. Mock the CanonicalProductDetails response
    const mockDetailProduct = {
      ...mockHomeProduct,
      model: 'Integration-Model',
      specifications: { Color: 'Black' }
    };
    
    api.getCanonicalProduct.mockResolvedValueOnce({ product: mockDetailProduct });
    api.getCanonicalProductOffers.mockResolvedValueOnce({ offers: [] });

    // 3. Render with Routes so we can navigate
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <WishlistProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/canonical-products/:id" element={<CanonicalProductDetails />} />
            </Routes>
          </WishlistProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // 4. Wait for Home to render the recommended item
    await waitFor(() => {
      expect(screen.getByText('Integration Test Headphone')).toBeDefined();
    });

    // 5. Click the product link (the link with the product image/name or "View Deal" button)
    const viewDealLink = screen.getByRole('link', { name: /Integration Test Headphone/i });
    
    // In React Router, clicking elements can be tricky sometimes, let's just click the link wrapper
    viewDealLink.click();

    // 6. Verify we navigated to the details page and it fetched the specific canonical ID
    await waitFor(() => {
      expect(api.getCanonicalProduct).toHaveBeenCalledWith('prod_integration_123');
    });

    // 7. Verify the details page rendered the canonical data
    await waitFor(() => {
      // "Back to Catalog" is unique to CanonicalProductDetails
      expect(screen.getByText(/Back to Catalog/i)).toBeDefined();
      expect(screen.getByText(/Integration-Model/i)).toBeDefined();
      expect(screen.getByText(/Best Comparable Deal/i)).toBeDefined();
    });
  });
});
