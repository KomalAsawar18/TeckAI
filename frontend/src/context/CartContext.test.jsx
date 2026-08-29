import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart, getCartItemKey, normalizeCartItem } from './CartContext';
import { AuthProvider } from './AuthContext';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCart: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    updateCart: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    getMe: vi.fn().mockResolvedValue({ success: true, data: { _id: 'user1', email: 'test@example.com' } })
  }
}));

describe('CartContext & Canonical Product Item Lines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }) => (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );

  const mockProduct = {
    _id: 'prod_canon_1',
    id: 'prod_canon_1',
    name: 'Logitech G Pro X Superlight 2',
    brand: 'Logitech',
    isCanonical: true,
    bestOffer: {
      _id: 'offer_eezepc',
      id: 'offer_eezepc',
      seller: 'EEZEPC',
      price: 36000,
      currency: 'PKR',
      availability: 'in_stock',
      stock: 5,
      variant: { color: 'Black' }
    }
  };

  const offerInfinity = {
    _id: 'offer_infinity',
    id: 'offer_infinity',
    seller: 'Infinity Store Pakistan',
    price: 35500,
    currency: 'PKR',
    availability: 'in_stock',
    stock: 3,
    variant: { color: 'Black' }
  };

  const offerWhiteVariant = {
    _id: 'offer_eezepc_white',
    id: 'offer_eezepc_white',
    seller: 'EEZEPC',
    price: 37000,
    currency: 'PKR',
    availability: 'in_stock',
    stock: 2,
    variant: { color: 'Magenta' }
  };

  test('getCartItemKey generates unique keys across different sellers and variants', () => {
    const itemA = {
      itemType: 'canonical',
      canonicalProduct: { _id: 'prod_1' },
      productOffer: { _id: 'offer_1' },
      variant: { color: 'Black' }
    };
    const itemB = {
      itemType: 'canonical',
      canonicalProduct: { _id: 'prod_1' },
      productOffer: { _id: 'offer_2' },
      variant: { color: 'Black' }
    };
    const itemC = {
      itemType: 'canonical',
      canonicalProduct: { _id: 'prod_1' },
      productOffer: { _id: 'offer_1' },
      variant: { color: 'White' }
    };

    expect(getCartItemKey(itemA)).not.toBe(getCartItemKey(itemB));
    expect(getCartItemKey(itemA)).not.toBe(getCartItemKey(itemC));
  });

  test('same product + different seller = separate cart line items', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      // 1. Add offer from EEZEPC
      await result.current.addToCart(mockProduct, 1, mockProduct.bestOffer);
    });

    await act(async () => {
      // 2. Add offer from Infinity Store Pakistan
      await result.current.addToCart(mockProduct, 1, offerInfinity);
    });

    expect(result.current.cartItems).toHaveLength(2);
    expect(result.current.cartItems[0].product.seller).toBe('EEZEPC');
    expect(result.current.cartItems[1].product.seller).toBe('Infinity Store Pakistan');
    expect(result.current.cartSubtotal).toBe(36000 + 35500);
  });

  test('same product + different variant = separate cart line items', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      // 1. Add Black variant from EEZEPC
      await result.current.addToCart(mockProduct, 1, mockProduct.bestOffer, { color: 'Black' });
    });

    await act(async () => {
      // 2. Add Magenta variant from EEZEPC
      await result.current.addToCart(mockProduct, 1, offerWhiteVariant, { color: 'Magenta' });
    });

    expect(result.current.cartItems).toHaveLength(2);
    expect(result.current.cartItems[0].variant.color).toBe('Black');
    expect(result.current.cartItems[1].variant.color).toBe('Magenta');
  });

  test('adding the exact same offer and variant increments quantity', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addToCart(mockProduct, 1, mockProduct.bestOffer);
    });

    await act(async () => {
      await result.current.addToCart(mockProduct, 2, mockProduct.bestOffer);
    });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(3);
    expect(result.current.cartSubtotal).toBe(36000 * 3);
  });
});
