import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, Heart } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { useWishlist } from '../../context/WishlistContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { name, slug, brand, price, currency, stock, images, rating, isFeatured } = product;
  const { isInWishlist, toggleWishlist } = useWishlist();
  const inStock = stock > 0;
  const mainImage = images && images.length > 0 ? images[0] : 'https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI';
  
  const isFav = isInWishlist(product._id);

  return (
    <article className={`card product-card ${isFeatured ? 'featured' : ''}`}>
      {isFeatured && <div className="featured-badge text-xs font-semibold">Featured</div>}
      <div className="product-card-image-link" style={{ position: 'relative' }}>
        <Link to={`/products/${slug}`}>
          <div className="product-image-wrapper">
            <img src={mainImage} alt={name} loading="lazy" className="product-image" />
          </div>
        </Link>
        <button
          className={`wishlist-toggle-card-btn ${isFav ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          title={isFav ? "Remove from Wishlist" : "Add to Wishlist"}
          type="button"
        >
          <Heart size={15} fill={isFav ? "var(--color-accent-highlight)" : "none"} />
        </button>
      </div>
      <div className="product-card-content">
        <div className="product-card-header">
          <span className="product-brand text-xs text-muted font-semibold">{brand}</span>
          <div className="product-rating flex align-center text-xs">
            <Star className="star-icon" size={12} />
            <span>{rating.toFixed(1)}</span>
          </div>
        </div>
        
        <h3 className="product-title text-md font-bold mb-2">
          <Link to={`/products/${slug}`}>{name}</Link>
        </h3>

        <div className="product-card-footer mt-auto">
          <div className="product-price-stock">
            <span className="product-price text-lg font-bold">{formatPrice(price, currency)}</span>
            <div className={`stock-status ${inStock ? 'in-stock' : 'out-of-stock'} text-xs`}>
              {inStock ? `${stock} in stock` : 'Out of stock'}
            </div>
          </div>
          <Link to={`/products/${slug}`} className="btn btn-secondary btn-view">
            <span>View</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
