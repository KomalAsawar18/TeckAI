import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Cpu, ArrowRight, Laptop, Headphones, Keyboard, Sparkles, Monitor, Mouse } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
// Removed ProductCard for compact layout
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const justRegistered = location.state?.justRegistered;
  const justLoggedIn = location.state?.justLoggedIn;
  const showWelcome = justRegistered || justLoggedIn;
  const firstName = user?.name ? user.name.split(' ')[0] : '';
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome);

  const [categories, setCategories] = useState([]);

  // Clear welcome state from browser history so it doesn't re-appear on refresh
  useEffect(() => {
    if (showWelcome) {
      window.history.replaceState({}, '', '/');
      const timer = setTimeout(() => setWelcomeVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const selectCuratedProducts = (productsArray) => {
    if (!Array.isArray(productsArray) || productsArray.length === 0) return [];
    
    // Filter for valid in-stock products with images
    const valid = productsArray.filter(p => 
      p.bestOffer && 
      p.bestOffer.availability === 'in_stock' && 
      p.images && 
      p.images.length > 0
    );

    // Score: prefer multiple offers
    const scored = valid.map(p => ({
      product: p,
      score: p.offerCount > 1 ? 10 : 0
    }));
    
    scored.sort((a, b) => b.score - a.score);

    const selected = [];
    const seenCategories = new Set();
    
    // Pass 1: Try to get diversity across categories
    for (const item of scored) {
      if (selected.length >= 2) break;
      const catId = item.product.category?.slug || item.product.category;
      if (!seenCategories.has(catId)) {
        selected.push(item.product);
        seenCategories.add(catId);
      }
    }
    
    // Pass 2: Fallback if we don't have 2 yet
    if (selected.length < 2) {
      for (const item of scored) {
        if (selected.length >= 2) break;
        if (!selected.includes(item.product)) {
          selected.push(item.product);
        }
      }
    }
    
    return selected;
  };

  const fetchFeatured = async () => {
    try {
      setLoading(true);
      // Fetch a larger pool to select from
      const res = await api.getCanonicalProducts({ limit: 12, sort: 'newest' });
      const productsArray = Array.isArray(res?.products) ? res.products : [];
      setFeaturedProducts(selectCuratedProducts(productsArray));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load recommended products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatured();
    // Use hardcoded canonical categories instead of fetching legacy categories
    setCategories([
      { name: 'Laptops', slug: 'laptops' },
      { name: 'Monitors', slug: 'monitors' },
      { name: 'Keyboards', slug: 'keyboards' },
      { name: 'Mouse', slug: 'mouse' },
      { name: 'Headphones', slug: 'headphones' }
    ]);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getCategoryIcon = (slug) => {
    switch (slug.toLowerCase()) {
      case 'laptops': return <Laptop size={24} />;
      case 'headphones': return <Headphones size={24} />;
      case 'keyboards': return <Keyboard size={24} />;
      case 'monitors': return <Monitor size={24} />;
      case 'mouse': return <Mouse size={24} />;
      default: return <Cpu size={24} />;
    }
  };

  return (
    <div className="home-page container fade-in">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          {welcomeVisible && firstName && (
            <div className="home-hero-welcome">
              {justRegistered
                ? `Welcome to TeckAI, ${firstName}! 🎉`
                : `Welcome back, ${firstName}!`}
            </div>
          )}
          <h1 className="home-hero-title">
            Find the right tech for your needs.
          </h1>
          <p className="home-hero-description">
            Search, compare, or ask TeckAI to find the right device for you.
          </p>

          {/* Search Container */}
          <form onSubmit={handleSearchSubmit} className="home-hero-search">
            <div className="home-hero-search-field">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                placeholder="What are you buying today?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="home-hero-ai-button"
              onClick={() => {
                navigate('/ai-assistant', { state: { initialMessage: searchQuery } });
              }}
            >
              <Sparkles size={16} />
              <span>Ask TeckAI</span>
            </button>
          </form>
        </div>
        <div className="home-hero-visual">
          <img 
            src="/hero-composition.png" 
            alt="TeckAI Premium Tech Gear" 
            loading="eager"
          />
        </div>
      </section>

      {/* Shop by Category Section */}
      <section className="home-section">
        <div className="home-section-header">
          <h2>Shop by Category</h2>
        </div>
        <div className="home-category-grid">
          {categories.map((cat) => (
            <Link key={cat.slug} to={`/products?category=${cat.slug}`} className="home-category-card">
              <div className="home-category-icon">
                {getCategoryIcon(cat.slug)}
              </div>
              <div className="home-category-content">
                <h3>{cat.name}</h3>
                <p>
                  {cat.slug === 'laptops' && 'Powerful performance. Anywhere.'}
                  {cat.slug === 'keyboards' && 'Built for speed. Made to last.'}
                  {cat.slug === 'headphones' && 'Premium sound. Pure clarity.'}
                  {cat.slug === 'monitors' && 'Crystal clear displays.'}
                  {cat.slug === 'mouse' && 'Precision control. Ergonomic design.'}
                </p>
              </div>
              <ArrowRight size={16} className="home-category-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recommended Gear Section */}
      <section className="home-section home-recommended-section">
        <div className="home-section-header">
          <h2>Recommended Gear</h2>
          <Link to="/products" className="home-section-link">
            <span>Explore Full Catalog</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <Loader message="Loading recommended products..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={fetchFeatured} />
        ) : (
          <div className="home-compact-cards">
            {featuredProducts.map((product) => {
              const productId = product.id || product._id;
              return (
                <Link key={productId} to={`/canonical-products/${productId}`} className="home-compact-card">
                <div className="compact-card-img">
                  <img src={product.images[0]} alt={product.name} />
                </div>
                <div className="compact-card-info">
                  {product.brand && product.model && (
                    <span className="compact-card-brand">{product.brand} {product.model}</span>
                  )}
                  <h3 className="compact-card-name">{product.name}</h3>
                  <div className="compact-card-pricing">
                    <div className="compact-card-price">
                      <span className="price-label">Best price from {product.bestOffer.seller}</span>
                      <span className="price-amount">{product.bestOffer.currency} {product.bestOffer.price.toLocaleString()}</span>
                    </div>
                    {product.offerCount > 1 ? (
                      <div className="compact-card-badge">Multiple offers</div>
                    ) : (
                      <div className="compact-card-badge">Best available deal</div>
                    )}
                  </div>
                  <div className="compact-card-action">
                    View Deal
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* AI CTA Section */}
      <section className="home-ai-cta">
        <div className="home-ai-cta-content">
          <h3>Not sure what you need? Ask TeckAI.</h3>
          <p>Tell us your needs or budget and get personalized product recommendations.</p>
        </div>
        <button 
          className="home-ai-cta-button"
          onClick={() => navigate('/ai-assistant')}
        >
          <Sparkles size={16} />
          <span>Ask TeckAI</span>
        </button>
      </section>
    </div>
  );
};

export default Home;
