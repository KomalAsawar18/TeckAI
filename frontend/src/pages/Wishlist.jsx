import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/product/ProductCard';
import Loader from '../components/common/Loader';
import { Heart, ArrowLeft } from 'lucide-react';

const Wishlist = () => {
  const { wishlistItems, loading } = useWishlist();

  if (loading) {
    return (
      <div className="flex justify-center align-center py-16" style={{ minHeight: '60vh' }}>
        <Loader message="Loading your favorites..." />
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container py-16 text-center fade-in">
        <div className="max-w-md mx-auto card p-8 flex flex-col align-center">
          <Heart size={48} className="text-muted mb-4" />
          <h1 className="text-xl font-bold text-primary mb-2">Your Wishlist is Empty</h1>
          <p className="text-secondary text-sm mb-6">
            Explore our technology catalog and click the heart icon on any product to save it here.
          </p>
          <Link to="/products" className="btn btn-primary flex align-center gap-2">
            <ArrowLeft size={16} />
            <span>Browse Products</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12 fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">My Wishlist</h1>
        <p className="text-secondary text-sm">Your curated collection of favorite gear</p>
      </div>

      <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-6)' }}>
        {wishlistItems.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default Wishlist;
