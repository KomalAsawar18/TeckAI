import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

/**
 * Generate a deterministic unique key for each cart line item.
 * Guarantees that different sellers or different variants for the same canonical product remain separate.
 */
export const getCartItemKey = (item) => {
  if (!item) return '';
  const isCanonical = item.itemType === 'canonical' || !!item.canonicalProduct;
  if (isCanonical) {
    const cId = (item.canonicalProduct?._id || item.canonicalProduct?.id || item.canonicalProduct || item.canonicalProductId)?.toString() || '';
    const oId = (item.productOffer?._id || item.productOffer?.id || item.productOffer || item.selectedProductOfferId || item.productOfferId)?.toString() || '';
    const variantStr = item.variant ? JSON.stringify(item.variant) : '';
    return `canonical_${cId}_${oId}_${variantStr}`;
  }
  const pId = (item.product?._id || item.product?.id || item.product)?.toString() || '';
  return `legacy_${pId}`;
};

/**
 * Normalizes populated DB/guest cart item into unified frontend representation.
 */
export const normalizeCartItem = (item) => {
  if (!item) return null;
  const isCanonical = item.itemType === 'canonical' || !!item.canonicalProduct;

  if (isCanonical) {
    const canonical = typeof item.canonicalProduct === 'object' ? item.canonicalProduct : { _id: item.canonicalProduct };
    const offer = typeof item.productOffer === 'object' ? item.productOffer : { _id: item.productOffer };
    const price = offer.price ?? item.priceSnapshot ?? 0;
    const currency = offer.currency || 'PKR';
    const seller = offer.seller?.name || offer.seller || 'Retail Supplier';
    const source = offer.source?.name || offer.source || 'Retailer Feed';
    const image = canonical.images?.[0] || (Array.isArray(canonical.images) && canonical.images[0]) || '';
    const variant = item.variant || offer.variant || null;
    const stock = offer.stock;
    const availability = offer.availability || 'in_stock';
    const isAvailable = availability !== 'out_of_stock';

    return {
      itemType: 'canonical',
      key: getCartItemKey(item),
      canonicalProduct: canonical,
      productOffer: offer,
      variant,
      priceSnapshot: price,
      quantity: item.quantity,
      // Unified product interface for Cart / Checkout views
      product: {
        _id: canonical._id || canonical.id,
        id: canonical._id || canonical.id,
        name: canonical.name || 'Product',
        brand: canonical.brand || '',
        model: canonical.model || '',
        price,
        currency,
        seller,
        source,
        condition: offer.condition || 'new',
        images: canonical.images || (image ? [image] : []),
        image,
        stock,
        availability,
        isAvailable,
        variant,
        isCanonical: true,
        canonicalProductId: canonical._id || canonical.id,
        productOfferId: offer._id || offer.id
      }
    };
  }

  // Legacy item
  const product = typeof item.product === 'object' ? item.product : { _id: item.product, price: item.priceSnapshot || 0 };
  return {
    itemType: 'legacy',
    key: getCartItemKey(item),
    product,
    priceSnapshot: product.price ?? item.priceSnapshot,
    quantity: item.quantity
  };
};

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevUserRef = useRef(null);

  // Load cart on boot or user change
  useEffect(() => {
    if (authLoading) return;

    const initializeCart = async () => {
      setLoading(true);
      try {
        // Fetch legacy catalog products as fallback helper
        let catalogProducts = [];
        try {
          if (typeof api.getProducts === 'function') {
            const prodRes = await api.getProducts({ limit: 100 });
            if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
              catalogProducts = prodRes.data;
            }
          }
        } catch (e) {
          // ignore in tests / offline
        }

        // Check local storage for guest items
        const localCartRaw = localStorage.getItem('cart');
        const guestItems = localCartRaw ? JSON.parse(localCartRaw) : [];

        if (user) {
          // Fetch authenticated user's remote database cart
          const cartRes = await api.getCart();
          const dbCartItems = cartRes.success && cartRes.data?.items ? cartRes.data.items : [];

          // Handle guest -> login merge behavior
          if (guestItems.length > 0) {
            console.log('Merging guest cart items with remote database cart...');
            const mergedMap = new Map();

            // 1. Add remote DB items
            dbCartItems.forEach(item => {
              const key = getCartItemKey(item);
              mergedMap.set(key, { ...item });
            });

            // 2. Combine guest items by unique line key
            guestItems.forEach(item => {
              const key = getCartItemKey(item);
              const existing = mergedMap.get(key);
              if (existing) {
                mergedMap.set(key, {
                  ...existing,
                  quantity: existing.quantity + item.quantity
                });
              } else {
                mergedMap.set(key, { ...item });
              }
            });

            // 3. Format validated payload for sync
            const syncPayload = Array.from(mergedMap.values()).map(item => {
              if (item.itemType === 'canonical' || item.canonicalProduct) {
                return {
                  itemType: 'canonical',
                  canonicalProduct: (item.canonicalProduct?._id || item.canonicalProduct?.id || item.canonicalProduct).toString(),
                  productOffer: (item.productOffer?._id || item.productOffer?.id || item.productOffer).toString(),
                  variant: item.variant || null,
                  priceSnapshot: item.priceSnapshot || item.productOffer?.price,
                  quantity: item.quantity
                };
              }
              return {
                itemType: 'legacy',
                product: (item.product?._id || item.product?.id || item.product).toString(),
                priceSnapshot: item.priceSnapshot || item.product?.price,
                quantity: item.quantity
              };
            });

            // 4. Sync merged cart back to the database
            const syncRes = await api.updateCart(syncPayload);
            if (syncRes.success && syncRes.data?.items) {
              localStorage.removeItem('cart');
              setCartItems(syncRes.data.items.map(normalizeCartItem).filter(Boolean));
            } else {
              setCartItems(dbCartItems.map(normalizeCartItem).filter(Boolean));
            }
          } else {
            // No guest items; directly apply remote DB items
            setCartItems(dbCartItems.map(normalizeCartItem).filter(Boolean));
          }
        } else {
          // Anonymous Guest cart state resolution
          const normalizedGuest = guestItems.map(normalizeCartItem).filter(Boolean);
          setCartItems(normalizedGuest);
        }
      } catch (error) {
        console.error('Initialize cart failed:', error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeCart();
    prevUserRef.current = user;
  }, [user, authLoading]);

  // Sync state changes with localStorage (for guest) or DB (for authenticated user)
  const syncCartState = async (updatedItems) => {
    const normalized = updatedItems.map(normalizeCartItem).filter(Boolean);

    if (user) {
      try {
        const payload = normalized.map(item => {
          if (item.itemType === 'canonical') {
            return {
              itemType: 'canonical',
              canonicalProduct: (item.canonicalProduct?._id || item.canonicalProduct?.id || item.canonicalProduct).toString(),
              productOffer: (item.productOffer?._id || item.productOffer?.id || item.productOffer).toString(),
              variant: item.variant || null,
              priceSnapshot: item.priceSnapshot,
              quantity: item.quantity
            };
          }
          return {
            itemType: 'legacy',
            product: (item.product?._id || item.product?.id || item.product).toString(),
            priceSnapshot: item.priceSnapshot,
            quantity: item.quantity
          };
        });

        const res = await api.updateCart(payload);
        if (res.success && res.data?.items) {
          setCartItems(res.data.items.map(normalizeCartItem).filter(Boolean));
          return { success: true };
        }
        return { success: false, message: 'Cart update failed' };
      } catch (error) {
        console.error('Failed syncing cart with DB:', error.message);
        return { success: false, message: error.message };
      }
    } else {
      // Guest state persistence
      localStorage.setItem('cart', JSON.stringify(normalized));
      setCartItems(normalized);
      return { success: true };
    }
  };

  /**
   * Add a product (canonical or legacy) to cart.
   * For canonical products: binds explicitly to selectedOffer (or bestOffer fallback).
   */
  const addToCart = async (product, quantity = 1, selectedOffer = null, variant = null) => {
    const isCanonical = product.isCanonical || !!product.bestOffer || !!selectedOffer || !!product.canonicalProductId;

    let newItem;
    if (isCanonical) {
      const offer = selectedOffer || product.bestOffer;
      if (!offer) {
        return { success: false, message: 'No purchasable offer available for this product.' };
      }

      newItem = {
        itemType: 'canonical',
        canonicalProduct: product,
        productOffer: offer,
        variant: variant || offer.variant || null,
        priceSnapshot: offer.price,
        quantity
      };
    } else {
      newItem = {
        itemType: 'legacy',
        product,
        priceSnapshot: product.price,
        quantity
      };
    }

    const newKey = getCartItemKey(newItem);
    const existingIndex = cartItems.findIndex(item => getCartItemKey(item) === newKey);

    let updated = [...cartItems];
    let newQty = quantity;

    if (existingIndex > -1) {
      newQty = cartItems[existingIndex].quantity + quantity;
      const maxStock = isCanonical ? (selectedOffer?.stock ?? product.bestOffer?.stock) : product.stock;
      if (maxStock !== undefined) {
        newQty = Math.min(newQty, maxStock);
      }
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty
      };
    } else {
      const maxStock = isCanonical ? (selectedOffer?.stock ?? product.bestOffer?.stock) : product.stock;
      if (maxStock !== undefined) {
        newQty = Math.min(newQty, maxStock);
      }
      updated.push({
        ...newItem,
        quantity: newQty
      });
    }

    if (newQty <= 0) return { success: false, message: 'Quantity must be at least 1' };

    return await syncCartState(updated);
  };

  const updateQuantity = async (itemKeyOrId, quantity) => {
    const existingIndex = cartItems.findIndex(item => {
      const key = getCartItemKey(item);
      const prodId = (item.product?._id || item.product?.id || item.product)?.toString();
      return key === itemKeyOrId || prodId === itemKeyOrId?.toString();
    });

    if (existingIndex === -1) return { success: false, message: 'Item not in cart' };

    const item = cartItems[existingIndex];
    const maxStock = item.product?.stock;
    let cappedQty = Math.max(1, quantity);
    if (maxStock !== undefined) {
      cappedQty = Math.min(cappedQty, maxStock);
    }

    const updated = [...cartItems];
    updated[existingIndex] = {
      ...item,
      quantity: cappedQty
    };

    return await syncCartState(updated);
  };

  const removeFromCart = async (itemKeyOrId) => {
    const updated = cartItems.filter(item => {
      const key = getCartItemKey(item);
      const prodId = (item.product?._id || item.product?.id || item.product)?.toString();
      return key !== itemKeyOrId && prodId !== itemKeyOrId?.toString();
    });
    return await syncCartState(updated);
  };

  const clearCart = async () => {
    return await syncCartState([]);
  };

  const clearCartLocally = () => {
    setCartItems([]);
    localStorage.removeItem('cart');
  };

  // Get total count of items in the cart
  const cartCount = cartItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

  // Subtotal calculation (Source of truth: database/offer prices)
  const cartSubtotal = cartItems.reduce((acc, item) => {
    const unitPrice = item.product?.price ?? item.priceSnapshot ?? 0;
    return acc + (unitPrice * (item.quantity || 0));
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        clearCartLocally,
        cartCount,
        cartSubtotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

