import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Cpu, ArrowRight, Laptop, Headphones, Keyboard, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/product/ProductCard';
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

  const fetchFeatured = async () => {
    try {
      setLoading(true);
      const res = await api.getProducts({ limit: 4 });
      // Filter in-memory just in case, or show the first 4 returned
      setFeaturedProducts(res.data.slice(0, 4));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load featured products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  useEffect(() => {
    fetchFeatured();
    fetchCategories();
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
          <div className="home-products-grid">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
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
