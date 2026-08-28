import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, Heart } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { useWishlist } from '../../context/WishlistContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const {
    id,
    _id,
    name,
    slug,
    brand,
    model,
    price: legacyPrice,
    currency: legacyCurrency,
    stock,
    images = [],
    rating,
    isFeatured,
    bestOffer,
    offerCount
  } = product;

  const { isInWishlist, toggleWishlist } = useWishlist();
  
  // Canonical products use id / _id and route to /canonical-products/:id
  const productId = id || _id;
  const isCanonical = Boolean(bestOffer || (!slug && productId));
  const productUrl = isCanonical ? `/canonical-products/${productId}` : `/products/${slug}`;

  // Price determination: bestOffer price for canonical, legacy price otherwise
  const displayPrice = bestOffer ? bestOffer.price : legacyPrice;
  const displayCurrency = bestOffer ? bestOffer.currency : legacyCurrency;

  // Availability determination
  const isAvailable = bestOffer 
    ? bestOffer.availability === 'in_stock' || bestOffer.availability === 'unknown'
    : product.availability === 'in_stock' || (stock !== undefined && stock > 0);

  const availabilityText = bestOffer
    ? (bestOffer.availability === 'in_stock' ? 'In stock' : bestOffer.availability === 'out_of_stock' ? 'Out of stock' : 'Available')
    : (stock !== undefined && stock > 0 ? `${stock} in stock` : isAvailable ? 'In stock' : 'Out of stock');

  const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI';

  const getValidImageUrl = (imgs) => {
    if (!Array.isArray(imgs) || imgs.length === 0) return PLACEHOLDER_IMAGE;
    const first = imgs[0];
    let url = '';
    if (typeof first === 'string') {
      url = first.trim();
    } else if (first && typeof first === 'object' && typeof first.url === 'string') {
      url = first.url.trim();
    }
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    return PLACEHOLDER_IMAGE;
  };

  const mainImage = getValidImageUrl(images);

  const handleImageError = (e) => {
    if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
      e.currentTarget.onerror = null;
      e.currentTarget.src = PLACEHOLDER_IMAGE;
    }
  };

  const isFav = isInWishlist(productId);

  return (
    <article className={`card product-card ${isFeatured ? 'featured' : ''}`}>
      {isFeatured && <div className="featured-badge text-xs font-semibold">Featured</div>}
      <div className="product-card-image-link" style={{ position: 'relative' }}>
        <Link to={productUrl}>
          <div className="product-image-wrapper">
            <img
              src={mainImage}
              alt={name || 'Product Image'}
              loading="lazy"
              className="product-image"
              onError={handleImageError}
            />
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
          <div className="product-brand-model flex align-center gap-1">
            <span className="product-brand text-xs text-muted font-semibold">{brand}</span>
            {model && <span className="product-model text-xs text-muted font-medium">• {model}</span>}
          </div>
          {typeof rating === 'number' && (
            <div className="product-rating flex align-center text-xs">
              <Star className="star-icon" size={12} />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <h3 className="product-title text-md font-bold mb-2">
          <Link to={productUrl}>{name}</Link>
        </h3>

        {/* Offer Summary Metadata */}
        {bestOffer && (
          <div className="product-offers-meta text-xs text-secondary mb-3 flex flex-col gap-1">
            {bestOffer.seller && (
              <span className="seller-name text-muted">
                Available from <strong className="text-secondary">{bestOffer.seller}</strong>
              </span>
            )}
            {typeof offerCount === 'number' && offerCount > 0 && (
              <span className="offer-count-badge font-semibold">
                {offerCount} {offerCount === 1 ? 'offer' : 'offers'}
              </span>
            )}
          </div>
        )}

        <div className="product-card-footer mt-auto">
          <div className="product-price-stock">
            <span className="product-price text-lg font-bold">
              {bestOffer ? `From ${formatPrice(displayPrice, displayCurrency)}` : formatPrice(displayPrice, displayCurrency)}
            </span>
            <div className={`stock-status ${isAvailable ? 'in-stock' : 'out-of-stock'} text-xs`}>
              {availabilityText}
            </div>
          </div>
          <Link to={productUrl} className="btn btn-secondary btn-view">
            <span>{bestOffer && offerCount > 1 ? 'View Deals' : 'View'}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
