import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductGrid from './ProductGrid';

const mockProducts = [
  {
    _id: '1',
    name: 'Sony WH-1000XM5',
    slug: 'sony-wh-1000xm5',
    sku: 'SNY-WH1000XM5',
    brand: 'Sony',
    price: 85000,
    currency: 'PKR',
    stock: 5,
    rating: 4.8,
    images: []
  },
  {
    _id: '2',
    name: 'Keychron K2',
    slug: 'keychron-k2',
    sku: 'KCN-K2-V2',
    brand: 'Keychron',
    price: 24000,
    currency: 'PKR',
    stock: 8,
    rating: 4.7,
    images: []
  }
];

describe('ProductGrid Component', () => {
  test('renders multiple product cards when products array is populated', () => {
    render(
      <MemoryRouter>
        <ProductGrid products={mockProducts} />
      </MemoryRouter>
    );

    expect(screen.getByText('Sony WH-1000XM5')).toBeDefined();
    expect(screen.getByText('Keychron K2')).toBeDefined();
  });

  test('renders empty state messages when products list is empty', () => {
    render(<ProductGrid products={[]} />);

    expect(screen.getByText('No products found')).toBeDefined();
    expect(screen.getByText('Try clearing search parameters or adjusting filters.')).toBeDefined();
  });
});
