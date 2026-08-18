import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

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
        // Fetch all products to resolve guest info or validate stock levels (Source of Truth)
        const prodRes = await api.getProducts({ limit: 100 });
        const catalogProducts = prodRes.success ? prodRes.data : [];

        // Check local storage for guest items
        const localCartRaw = localStorage.getItem('cart');
        const guestItems = localCartRaw ? JSON.parse(localCartRaw) : [];

        if (user) {
          // Fetch authenticated user's remote database cart
          const cartRes = await api.getCart();
          const dbCartItems = cartRes.success && cartRes.data ? cartRes.data.items : [];

          // Handle guest -> login merge behavior
          if (guestItems.length > 0) {
            console.log('Merging guest cart items with remote database cart...');
            const mergedMap = new Map();

            // 1. Add remote DB items
            dbCartItems.forEach(item => {
              const prodId = item.product._id || item.product;
              mergedMap.set(prodId.toString(), {
                product: prodId.toString(),
                quantity: item.quantity
              });
            });

            // 2. Combine guest items
            guestItems.forEach(item => {
              const prodId = item.product;
              const existing = mergedMap.get(prodId.toString());
              if (existing) {
                mergedMap.set(prodId.toString(), {
                  product: prodId.toString(),
                  quantity: existing.quantity + item.quantity
                });
              } else {
                mergedMap.set(prodId.toString(), {
                  product: prodId.toString(),
                  quantity: item.quantity
                });
              }
            });

            // 3. Validate and cap quantities against database stock truths
            const validatedItems = [];
            for (const [prodId, item] of mergedMap.entries()) {
              const catalogProd = catalogProducts.find(p => p._id.toString() === prodId);
              if (catalogProd && catalogProd.isActive && catalogProd.stock > 0) {
                const cappedQty = Math.min(item.quantity, catalogProd.stock);
                validatedItems.push({
                  product: prodId,
                  quantity: cappedQty
                });
              }
            }

            // 4. Sync merged cart back to the database (PUT replacements)
            const syncRes = await api.updateCart(validatedItems);
            if (syncRes.success) {
              // Clear guest cart ONLY after successful server synchronization
              localStorage.removeItem('cart');
              
              // Set state with populated product detail cart returned from server
              setCartItems(syncRes.data.items);
            } else {
              // Fallback to DB items if sync rejected by server
              setCartItems(dbCartItems);
            }
          } else {
            // No guest items; directly apply remote DB items
            setCartItems(dbCartItems);
          }
        } else {
          // Anonymous Guest cart state resolution
          const validatedGuestItems = [];
          guestItems.forEach(item => {
            const catalogProd = catalogProducts.find(p => p._id.toString() === item.product);
            if (catalogProd && catalogProd.isActive && catalogProd.stock > 0) {
              const cappedQty = Math.min(item.quantity, catalogProd.stock);
              validatedGuestItems.push({
                product: catalogProd, // Store full catalog metadata in state for views
                quantity: cappedQty
              });
            }
          });
          setCartItems(validatedGuestItems);
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
    if (user) {
      try {
        // Format payload to only contain product IDs and quantities
        const payload = updatedItems.map(item => ({
          product: (item.product._id || item.product).toString(),
          quantity: item.quantity
        }));
        
        const res = await api.updateCart(payload);
        if (res.success) {
          setCartItems(res.data.items);
          return { success: true };
        }
        return { success: false, message: 'Cart update failed' };
      } catch (error) {
        console.error('Failed syncing cart with DB:', error.message);
        return { success: false, message: error.message };
      }
    } else {
      // Guest state persistence (stores only product ID + quantity)
      const guestPayload = updatedItems.map(item => ({
        product: (item.product._id || item.product).toString(),
        quantity: item.quantity
      }));
      localStorage.setItem('cart', JSON.stringify(guestPayload));
      setCartItems(updatedItems);
      return { success: true };
    }
  };

  const addToCart = async (product, quantity = 1) => {
    const existingIndex = cartItems.findIndex(
      item => (item.product._id || item.product).toString() === product._id.toString()
    );

    let updated = [...cartItems];
    let newQty = quantity;

    if (existingIndex > -1) {
      newQty = cartItems[existingIndex].quantity + quantity;
      // Cap at database stock level
      newQty = Math.min(newQty, product.stock);
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty
      };
    } else {
      // New item additions
      newQty = Math.min(newQty, product.stock);
      updated.push({
        product,
        quantity: newQty
      });
    }

    if (newQty <= 0) return { success: false, message: 'Quantity must be at least 1' };

    return await syncCartState(updated);
  };

  const updateQuantity = async (productId, quantity) => {
    const existingIndex = cartItems.findIndex(
      item => (item.product._id || item.product).toString() === productId.toString()
    );

    if (existingIndex === -1) return { success: false, message: 'Item not in cart' };

    const item = cartItems[existingIndex];
    const maxStock = item.product.stock;
    const cappedQty = Math.min(Math.max(1, quantity), maxStock);

    const updated = [...cartItems];
    updated[existingIndex] = {
      ...item,
      quantity: cappedQty
    };

    return await syncCartState(updated);
  };

  const removeFromCart = async (productId) => {
    const updated = cartItems.filter(
      item => (item.product._id || item.product).toString() !== productId.toString()
    );
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
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Subtotal calculation (Source of truth: database product prices)
  const cartSubtotal = cartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

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
