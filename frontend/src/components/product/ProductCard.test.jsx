import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';

const mockProduct = {
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

describe('ProductCard Component', () => {
  test('renders product name, brand, rating and stock details correctly', () => {
    render(
      <MemoryRouter>
        <ProductCard product={mockProduct} />
      </MemoryRouter>
    );

    // Verify brand and title
    expect(screen.getByText('Lenovo')).toBeDefined();
    expect(screen.getByText('ThinkPad X1 Carbon')).toBeDefined();

    // Verify rating text
    expect(screen.getByText('4.8')).toBeDefined();

    // Verify formatted price
    expect(screen.getByText('PKR 350,000')).toBeDefined();

    // Verify stock status
    expect(screen.getByText('12 in stock')).toBeDefined();
  });

  test('renders out of stock badge if stock is zero', () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 };
    render(
      <MemoryRouter>
        <ProductCard product={outOfStockProduct} />
      </MemoryRouter>
    );

    expect(screen.getByText('Out of stock')).toBeDefined();
  });
});
