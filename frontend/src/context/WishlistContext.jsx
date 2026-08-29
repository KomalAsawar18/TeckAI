import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  const parseWishlistData = (data) => {
    if (!data) return [];
    const legacy = Array.isArray(data.products) ? data.products : [];
    const canonical = Array.isArray(data.canonicalProducts) ? data.canonicalProducts : [];
    return [...legacy, ...canonical];
  };

  // Load wishlist on user changes
  useEffect(() => {
    if (authLoading) return;

    const fetchWishlist = async () => {
      if (user) {
        setLoading(true);
        try {
          const res = await api.getWishlist();
          if (res.success && res.data) {
            setWishlistItems(parseWishlistData(res.data));
          }
        } catch (error) {
          console.error('Failed to load wishlist:', error.message);
        } finally {
          setLoading(false);
        }
      } else {
        setWishlistItems([]);
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user, authLoading]);

  const isInWishlist = (productId) => {
    if (!productId) return false;
    const target = productId.toString();
    return wishlistItems.some(item => {
      const id = (item._id || item.id || item.canonicalProductId || item)?.toString();
      return id === target;
    });
  };

  const addToWishlist = async (product) => {
    if (!user) {
      // Redirect anonymous users to login page
      navigate('/login', { state: { from: location } });
      return { success: false, message: 'Authentication required' };
    }

    try {
      const prodId = typeof product === 'object' ? (product._id || product.id || product.canonicalProductId) : product;
      const isCanonical = typeof product === 'object' ? (product.isCanonical || !!product.bestOffer || !!product.canonicalProductId) : false;

      const payload = isCanonical
        ? { canonicalProductId: prodId, isCanonical: true }
        : { productId: prodId };

      const res = await api.addToWishlist(payload);
      if (res.success && res.data) {
        setWishlistItems(parseWishlistData(res.data));
        return { success: true };
      }
      return { success: false, message: 'Failed to add item to wishlist' };
    } catch (error) {
      console.error('AddToWishlist failed:', error.message);
      return { success: false, message: error.message };
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return { success: false, message: 'Authentication required' };
    }

    try {
      const prodId = typeof productId === 'object' ? (productId._id || productId.id || productId.canonicalProductId) : productId;
      const res = await api.removeFromWishlist(prodId);
      if (res.success && res.data) {
        setWishlistItems(parseWishlistData(res.data));
        return { success: true };
      }
      return { success: false, message: 'Failed to remove item from wishlist' };
    } catch (error) {
      console.error('RemoveFromWishlist failed:', error.message);
      return { success: false, message: error.message };
    }
  };

  // Toggle helper
  const toggleWishlist = async (product) => {
    const productId = typeof product === 'object' ? (product._id || product.id || product.canonicalProductId) : product;
    if (isInWishlist(productId)) {
      return await removeFromWishlist(productId);
    } else {
      return await addToWishlist(product);
    }
  };

  const wishlistCount = wishlistItems.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        loading,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        wishlistCount
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

