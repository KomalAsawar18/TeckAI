import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, ShoppingCart, Heart, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './ProductDetails.css';

const ProductDetails = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.getProductBySlug(slug);
      setProduct(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to retrieve product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  if (loading) return <div className="py-16"><Loader message="Fetching product details..." /></div>;
  if (error) return <div className="container py-8"><ErrorMessage message={error} onRetry={fetchProduct} /></div>;
  if (!product) return null;

  const { name, brand, price, originalPrice, currency, stock, images, description, rating, reviewCount, category, specifications } = product;
  const inStock = stock > 0;
  const mainImage = images && images.length > 0 ? images[0] : 'https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI';

  const specsList = specifications ? Object.entries(specifications) : [];

  return (
    <div className="product-details-page container py-8 fade-in">
      {/* Back Button */}
      <Link to="/products" className="btn btn-secondary back-btn mb-6">
        <ArrowLeft size={16} />
        <span>Back to Catalog</span>
      </Link>

      <div className="product-detail-grid mb-12">
        {/* Gallery Image Display */}
        <section className="product-gallery">
          <div className="main-image-card card">
            <img src={mainImage} alt={name} className="detail-main-image" />
          </div>
        </section>

        {/* Product Details Specs Section */}
        <section className="product-info-panel">
          <span className="info-brand text-sm text-accent-highlight font-semibold uppercase">{brand}</span>
          <h1 className="info-title text-3xl font-bold mb-2">{name}</h1>
          
          <div className="info-rating-category flex align-center gap-4 mb-4">
            <div className="product-rating flex align-center text-sm font-semibold">
              <Star className="star-icon" size={14} />
              <span>{rating.toFixed(1)}</span>
              <span className="text-muted font-normal">({reviewCount} reviews)</span>
            </div>
            <span className="badge badge-secondary">{category?.name}</span>
          </div>

          <div className="info-price-section mb-6">
            <div className="price-tag flex align-center gap-3">
              <span className="current-price text-3xl font-bold">{formatPrice(price, currency)}</span>
              {originalPrice && (
                <span className="original-price text-lg text-muted">{formatPrice(originalPrice, currency)}</span>
              )}
            </div>
            <div className={`detail-stock-badge mt-2 badge ${inStock ? 'badge-success' : 'badge-error'}`}>
              {inStock ? `${stock} units available` : 'Temporarily Out of Stock'}
            </div>
          </div>

          <p className="info-description text-secondary text-md mb-8">{description}</p>

          {/* Phase 1 Disabled CTA Controls */}
          <div className="detail-ctas flex flex-col gap-3 mb-8">
            <div className="flex gap-4">
              <button className="btn btn-primary flex-grow disabled-detail-btn" disabled title="Cart is disabled in Phase 1">
                <ShoppingCart size={16} />
                <span>Add to Cart (Coming Soon)</span>
              </button>
              <button className="btn btn-secondary disabled-detail-btn" disabled title="Wishlist is disabled in Phase 1">
                <Heart size={16} />
              </button>
            </div>
            <span className="text-xs text-muted text-center italic">
              Shopping and order checkouts are disabled in this phase.
            </span>
          </div>

          {/* Commerce Guarantees Layout */}
          <div className="guarantees-grid grid grid-cols-3 gap-4 pt-6 border-top">
            <div className="guarantee-item flex flex-col align-center text-center">
              <ShieldCheck size={20} className="guarantee-icon" />
              <span className="text-xs font-semibold mt-1">1 Year Warranty</span>
            </div>
            <div className="guarantee-item flex flex-col align-center text-center">
              <Truck size={20} className="guarantee-icon" />
              <span className="text-xs font-semibold mt-1">Fast Delivery</span>
            </div>
            <div className="guarantee-item flex flex-col align-center text-center">
              <RefreshCw size={20} className="guarantee-icon" />
              <span className="text-xs font-semibold mt-1">7-Day Returns</span>
            </div>
          </div>
        </section>
      </div>

      {/* Dynamic Category Specifications Section */}
      {specsList.length > 0 && (
        <section className="product-specifications-section pt-8">
          <h2 className="text-xl font-bold mb-4">Technical Specifications</h2>
          <div className="specs-table-wrapper card">
            <table className="specs-table">
              <tbody>
                {specsList.map(([key, val]) => {
                  // Format array specs nicely (e.g. ports list)
                  const displayValue = Array.isArray(val) 
                    ? val.join(', ') 
                    : typeof val === 'boolean' 
                      ? (val ? 'Yes' : 'No') 
                      : val;
                  
                  // Make keys human readable (e.g. ramGB -> RAM (GB))
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

export default ProductDetails;
