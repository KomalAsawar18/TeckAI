import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2, Tag, Layers, ShoppingCart, Heart, Zap, Truck } from 'lucide-react';
import { api, getOfferRedirectUrl } from '../services/api';
import { formatPrice } from '../utils/format';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './CanonicalProductDetails.css';

const CanonicalProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [offersData, setOffersData] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const fetchCanonicalProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch canonical product summary
      const productRes = await api.getCanonicalProduct(id);
      const prod = productRes.product || productRes.data || productRes;
      setProduct(prod);

      // Fetch all ranked offers if offerCount > 0
      try {
        const offersRes = await api.getCanonicalProductOffers(id);
        setOffersData(offersRes);
        const offers = offersRes?.offers || offersRes?.rankedOffers || [];
        if (offers.length > 0 && !selectedOfferId) {
          const defaultOffer = prod.bestOffer ? offers.find(o => (o.id || o._id) === (prod.bestOffer.id || prod.bestOffer._id)) || offers[0] : offers[0];
          setSelectedOfferId(defaultOffer.id || defaultOffer._id);
        }
      } catch (offersErr) {
        console.warn('Could not load separate offers ranking:', offersErr.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve canonical product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCanonicalProduct();
  }, [id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="py-16">
        <Loader message="Fetching canonical product and real-time retailer deals..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <ErrorMessage message={error} onRetry={fetchCanonicalProduct} />
      </div>
    );
  }

  if (!product) return null;

  const {
    name,
    brand,
    model,
    category,
    images = [],
    specifications,
    bestOffer,
    offerCount = 0
  } = product;

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

  const specsList = specifications ? Object.entries(specifications) : [];
  const rankedOffers = offersData?.offers || offersData?.rankedOffers || [];

  // Determine currently active offer (selected offer, or fallback to bestOffer)
  const activeOffer = (selectedOfferId && rankedOffers.find(o => (o.id || o._id) === selectedOfferId)) 
    || bestOffer 
    || rankedOffers[0] 
    || null;

  const isFavorite = isInWishlist(product.id || product._id);
  const isOutOfStock = activeOffer && activeOffer.availability === 'out_of_stock';
  const sellerName = activeOffer?.seller?.name || activeOffer?.seller || activeOffer?.source?.name || 'Retail Supplier';

  const handleAddToCart = async () => {
    if (!activeOffer || isOutOfStock) return;
    setActionLoading(true);
    const res = await addToCart(product, quantity, activeOffer, activeOffer.variant);
    setActionLoading(false);
    if (res?.success) {
      showToast(`Added ${quantity} to cart with ${sellerName}!`);
    } else {
      showToast(res?.message || 'Failed to add item to cart');
    }
  };

  const handleBuyNow = async () => {
    if (!activeOffer || isOutOfStock) return;
    setActionLoading(true);
    const res = await addToCart(product, quantity, activeOffer, activeOffer.variant);
    setActionLoading(false);
    if (res?.success) {
      navigate('/checkout');
    } else {
      showToast(res?.message || 'Failed to initiate checkout');
    }
  };

  const handleToggleWishlist = async () => {
    await toggleWishlist(product);
  };

  return (
    <div className="canonical-details-page container py-8 fade-in">
      {/* Back to catalog navigation */}
      <Link to="/products" className="btn btn-secondary back-btn mb-6">
        <ArrowLeft size={16} />
        <span>Back to Catalog</span>
      </Link>

      {toastMessage && (
        <div className="toast-notification card p-3 mb-4 flex align-center justify-between">
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setToastMessage('')}>✕</button>
        </div>
      )}

      <div className="canonical-detail-grid mb-12">
        {/* Product Image Panel */}
        <section className="product-gallery">
          <div className="main-image-card card relative">
            <img
              src={mainImage}
              alt={name || 'Product'}
              className="detail-main-image"
              onError={handleImageError}
            />
            <button
              onClick={handleToggleWishlist}
              className={`wishlist-badge-btn ${isFavorite ? 'active' : ''}`}
              title={isFavorite ? 'Remove from Wishlist' : 'Add to Wishlist'}
              aria-label="Wishlist"
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </section>

        {/* Product Identity & Action Panel */}
        <section className="product-info-panel">
          <div className="product-brand-model-header flex align-center gap-2 mb-1">
            <span className="info-brand text-sm text-accent-highlight font-bold uppercase">{brand}</span>
            {model && <span className="info-model text-sm text-muted font-semibold">• Model: {model}</span>}
          </div>

          <h1 className="info-title text-3xl font-bold mb-3">{name}</h1>

          {category && (
            <div className="info-category-badge mb-4">
              <span className="badge badge-secondary">{category.name || category.slug}</span>
            </div>
          )}

          {/* Active / Selected Offer Card */}
          {activeOffer ? (
            <div className="best-deal-card card mb-8 p-6">
              <div className="deal-card-header flex align-center justify-between mb-4">
                <span className="best-price-label text-xs uppercase tracking-wider font-bold text-accent-highlight">
                  {((activeOffer.id || activeOffer._id) === (bestOffer?.id || bestOffer?._id)) ? 'Best Comparable Deal' : 'Selected Retailer Offer'}
                </span>
                <span className="deal-seller-badge text-xs font-semibold text-secondary">
                  Seller: <strong>{sellerName}</strong>
                </span>
              </div>

              <div className="deal-price-row flex align-baseline gap-5 mb-4">
                <span className="current-price text-3xl font-bold">
                  {formatPrice(activeOffer.price, activeOffer.currency)}
                </span>
                <span className={`deal-stock-badge badge ${activeOffer.availability === 'in_stock' ? 'badge-success' : 'badge-secondary'}`}>
                  {activeOffer.availability === 'in_stock' ? 'In Stock' : activeOffer.availability === 'out_of_stock' ? 'Out of Stock' : 'Available'}
                </span>
              </div>

              <div className="deal-meta-attributes flex gap-6 text-xs text-muted mb-6">
                {activeOffer.condition && (
                  <span className="flex align-center gap-1">
                    <Tag size={12} /> Condition: <strong className="capitalize text-secondary">{activeOffer.condition}</strong>
                  </span>
                )}
                {activeOffer.variant?.color && (
                  <span className="flex align-center gap-1">
                    <Layers size={12} /> Color: <strong className="text-secondary">{activeOffer.variant.color}</strong>
                  </span>
                )}
              </div>

              {/* Quantity Stepper & TeckAI Actions */}
              <div className="cart-action-group flex flex-col gap-3 mb-4">
                <div className="quantity-row flex align-center gap-4">
                  <span className="text-sm font-semibold">Quantity:</span>
                  <div className="qty-stepper flex align-center gap-2">
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || isOutOfStock}
                    >-</button>
                    <span className="px-3 py-1 font-bold text-sm">{quantity}</span>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setQuantity(q => q + 1)}
                      disabled={isOutOfStock}
                    >+</button>
                  </div>
                </div>

                <div className="main-actions-grid grid grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || actionLoading}
                    className="btn btn-secondary flex justify-center align-center gap-2 py-3"
                  >
                    <ShoppingCart size={16} />
                    <span>Add to Cart</span>
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock || actionLoading}
                    className="btn btn-primary flex justify-center align-center gap-2 py-3"
                  >
                    <Zap size={16} />
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>

              {/* Preserved Retailer Redirect (Secondary Action) */}
              <div className="retailer-redirect-row pt-3 border-top">
                <a
                  href={getOfferRedirectUrl(activeOffer)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost w-full flex justify-center align-center gap-2 py-2 text-sm text-secondary hover:text-primary"
                >
                  <span>View Deal at {sellerName}</span>
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* Fulfillment Mode Transparency */}
              <div className="fulfillment-notice flex align-center gap-2 mt-4 p-3 bg-secondary rounded text-xs text-muted">
                <Truck size={16} className="text-accent-highlight shrink-0" />
                <span>Fulfilled via authorized retail supplier (Cash on Delivery). TeckAI coordinates delivery directly with supplier.</span>
              </div>
            </div>
          ) : (
            <div className="no-offer-card card p-4 mb-6 text-muted text-sm">
              Currently no active retailer offers are available for this item.
            </div>
          )}

          {/* Verified Deals Trust Guarantee */}
          <div className="guarantees-grid grid grid-cols-2 gap-4 pt-4 border-top">
            <div className="guarantee-item flex align-center gap-2">
              <ShieldCheck size={18} className="text-accent-highlight" />
              <span className="text-xs font-medium text-secondary">Direct retailer pricing</span>
            </div>
            <div className="guarantee-item flex align-center gap-2">
              <CheckCircle2 size={18} className="text-accent-highlight" />
              <span className="text-xs font-medium text-secondary">{offerCount} {offerCount === 1 ? 'verified offer' : 'verified offers'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Available Offers Comparison Table */}
      {rankedOffers && rankedOffers.length > 0 && (
        <section className="available-offers-section mb-12">
          <div className="section-header mb-4">
            <h2 className="text-xl font-bold">Available Offers ({rankedOffers.length})</h2>
            <p className="text-sm text-secondary">
              Select an offer to buy directly or view the deal on the retailer's website.
            </p>
          </div>

          <div className="offers-table-wrapper card">
            <table className="offers-table">
              <thead>
                <tr>
                  <th className="th-select text-left text-xs uppercase font-bold text-muted">Select</th>
                  <th className="th-seller text-left text-xs uppercase font-bold text-muted">Seller</th>
                  <th className="th-variant text-left text-xs uppercase font-bold text-muted">Variant / Color</th>
                  <th className="th-condition text-left text-xs uppercase font-bold text-muted">Condition</th>
                  <th className="th-availability text-left text-xs uppercase font-bold text-muted">Stock</th>
                  <th className="th-price text-left text-xs uppercase font-bold text-muted">Price</th>
                  <th className="th-action text-right text-xs uppercase font-bold text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rankedOffers.map((offer) => {
                  const offerId = offer.id || offer._id;
                  const seller = offer.seller?.name || offer.seller || offer.source?.name || 'Verified Seller';
                  const redirectUrl = getOfferRedirectUrl(offer);
                  const isSelected = (selectedOfferId === offerId);
                  const isRowOutOfStock = offer.availability === 'out_of_stock';

                  return (
                    <tr 
                      key={offerId} 
                      className={`offer-row ${isSelected ? 'offer-row-selected' : ''}`}
                      onClick={() => setSelectedOfferId(offerId)}
                    >
                      <td className="offer-select">
                        <input
                          type="radio"
                          name="selectedOffer"
                          checked={isSelected}
                          onChange={() => setSelectedOfferId(offerId)}
                          aria-label={`Select offer from ${seller}`}
                        />
                      </td>
                      <td className="offer-seller text-sm font-semibold">{seller}</td>
                      <td className="offer-variant text-sm text-secondary">
                        {offer.variant?.color || 'Standard'}
                      </td>
                      <td className="offer-condition text-xs capitalize text-muted">
                        <span className="badge badge-secondary">{offer.condition || 'new'}</span>
                      </td>
                      <td className="offer-availability text-xs">
                        <span className={`badge ${offer.availability === 'in_stock' ? 'badge-success' : 'badge-secondary'}`}>
                          {offer.availability === 'in_stock' ? 'In stock' : offer.availability === 'out_of_stock' ? 'Out of stock' : 'Available'}
                        </span>
                      </td>
                      <td className="offer-price text-sm font-bold text-primary">
                        {formatPrice(offer.price, offer.currency)}
                      </td>
                      <td className="offer-action text-right flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={async () => {
                            setSelectedOfferId(offerId);
                            await addToCart(product, 1, offer, offer.variant);
                            showToast(`Added to cart with ${seller}!`);
                          }}
                          disabled={isRowOutOfStock}
                          className="btn btn-secondary btn-sm flex align-center gap-1"
                        >
                          <ShoppingCart size={12} />
                          <span>Add</span>
                        </button>
                        <a
                          href={redirectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm flex align-center gap-1"
                          style={{ display: 'inline-flex' }}
                        >
                          <span>View Deal</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Specifications */}
      {specsList.length > 0 && (
        <section className="product-specifications-section pt-4">
          <h2 className="text-xl font-bold mb-4">Product Specifications</h2>
          <div className="specs-table-wrapper card">
            <table className="specs-table">
              <tbody>
                {specsList.map(([key, val]) => {
                  const displayValue = Array.isArray(val)
                    ? val.join(', ')
                    : typeof val === 'boolean'
                      ? (val ? 'Yes' : 'No')
                      : String(val);

                  const readableKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase());

                  return (
                    <tr key={key} className="spec-row">
                      <td className="spec-key text-sm font-semibold">{readableKey}</td>
                      <td className="spec-value text-sm text-secondary">{displayValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default CanonicalProductDetails;

