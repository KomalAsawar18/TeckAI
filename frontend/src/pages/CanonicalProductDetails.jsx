import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2, Tag, Layers } from 'lucide-react';
import { api } from '../services/api';
import { formatPrice } from '../utils/format';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './CanonicalProductDetails.css';

const CanonicalProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [offersData, setOffersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="canonical-details-page container py-8 fade-in">
      {/* Back to catalog navigation */}
      <Link to="/products" className="btn btn-secondary back-btn mb-6">
        <ArrowLeft size={16} />
        <span>Back to Catalog</span>
      </Link>

      <div className="canonical-detail-grid mb-12">
        {/* Product Image Panel */}
        <section className="product-gallery">
          <div className="main-image-card card">
            <img
              src={mainImage}
              alt={name || 'Product'}
              className="detail-main-image"
              onError={handleImageError}
            />
          </div>
        </section>

        {/* Product Identity & Best Deal Panel */}
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

          {/* Best Deal Highlight Card */}
          {bestOffer ? (
            <div className="best-deal-card card mb-8 p-6">
              <div className="deal-card-header flex align-center justify-between mb-4">
                <span className="best-price-label text-xs uppercase tracking-wider font-bold text-accent-highlight">
                  Best Comparable Deal
                </span>
                <span className="deal-seller-badge text-xs font-semibold text-secondary">
                  Seller: <strong>{bestOffer.seller}</strong>
                </span>
              </div>

              <div className="deal-price-row flex align-baseline gap-5 mb-4">
                <span className="current-price text-3xl font-bold">
                  {formatPrice(bestOffer.price, bestOffer.currency)}
                </span>
                <span className={`deal-stock-badge badge ${bestOffer.availability === 'in_stock' ? 'badge-success' : 'badge-secondary'}`}>
                  {bestOffer.availability === 'in_stock' ? 'In Stock' : bestOffer.availability === 'out_of_stock' ? 'Out of Stock' : 'Available'}
                </span>
              </div>

              <div className="deal-meta-attributes flex gap-6 text-xs text-muted mb-6">
                {bestOffer.condition && (
                  <span className="flex align-center gap-1">
                    <Tag size={12} /> Condition: <strong className="capitalize text-secondary">{bestOffer.condition}</strong>
                  </span>
                )}
                {bestOffer.variant?.color && (
                  <span className="flex align-center gap-1">
                    <Layers size={12} /> Color: <strong className="text-secondary">{bestOffer.variant.color}</strong>
                  </span>
                )}
              </div>

              <a
                href={bestOffer.redirectUrl || `/api/offers/${bestOffer.id}/redirect`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-full flex justify-center align-center gap-2 py-3"
              >
                <span>View Deal at {bestOffer.seller}</span>
                <ExternalLink size={16} />
              </a>
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
              Compare all variants and retailer listings for {name}.
            </p>
          </div>

          <div className="offers-table-wrapper card">
            <table className="offers-table">
              <thead>
                <tr>
                  <th className="th-seller text-left text-xs uppercase font-bold text-muted">Seller</th>
                  <th className="th-variant text-left text-xs uppercase font-bold text-muted">Variant / Color</th>
                  <th className="th-condition text-left text-xs uppercase font-bold text-muted">Condition</th>
                  <th className="th-availability text-left text-xs uppercase font-bold text-muted">Stock</th>
                  <th className="th-price text-left text-xs uppercase font-bold text-muted">Price</th>
                  <th className="th-action text-right text-xs uppercase font-bold text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {rankedOffers.map((offer) => {
                  const offerId = offer.id || offer._id;
                  const sellerName = offer.seller?.name || offer.seller || 'Verified Seller';
                  const redirectUrl = `/api/offers/${offerId}/redirect`;

                  return (
                    <tr key={offerId} className="offer-row">
                      <td className="offer-seller text-sm font-semibold">{sellerName}</td>
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
                      <td className="offer-action text-right">
                        <a
                          href={redirectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm flex align-center gap-1"
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
