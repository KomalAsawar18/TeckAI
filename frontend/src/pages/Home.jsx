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
      {/* Hero / Personalized Welcome Section */}
      <section className="hero-banner-unified mb-12">
        <div className="hero-left-column">
          {welcomeVisible && firstName && (
            <div className="hero-greeting-container mb-4 text-left justify-start">
              <span className="hero-greeting">
                {justRegistered
                  ? `Welcome to TeckAI, ${firstName}! 🎉`
                  : `Welcome back, ${firstName}!`}
              </span>
            </div>
          )}
          <h1 className="hero-title text-5xl font-bold mb-4 text-black leading-tight">
            Find the right tech <br />for your needs.
          </h1>
          <p className="hero-subtitle text-secondary mb-8 text-md max-w-sm ml-0">
            Search, compare, or ask TeckAI to find the right device for you.
          </p>

          {/* Search & AI Query Bar */}
          <form onSubmit={handleSearchSubmit} className="hero-unified-search-box mt-8">
            <div className="search-input-wrapper flex-grow flex align-center px-4">
              <svg xmlns="http://www.w3.org/20event/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary mr-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                className="unified-search-input"
                placeholder="What are you building today?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn unified-btn-ask flex align-center gap-2 whitespace-nowrap"
              onClick={() => {
                navigate('/ai-assistant', { state: { initialMessage: searchQuery } });
              }}
            >
              <Sparkles size={16} />
              <span>Ask TeckAI</span>
            </button>
          </form>
        </div>
        <div className="hero-right-column flex justify-end align-center">
          <img 
            src="/hero-composition.png" 
            alt="TeckAI Premium Tech Gear" 
            className="hero-image-blended" 
            loading="eager"
          />
        </div>
      </section>

      {/* Main Categories Section */}
      <section className="home-section mb-12">
        <div className="section-header flex justify-between align-center mb-6">
          <h2 className="section-title text-2xl font-bold text-black">Shop by Category</h2>
        </div>
        <div className="category-unified-row flex gap-6">
          {categories.map((cat) => (
            <Link key={cat.slug} to={`/products?category=${cat.slug}`} className="card category-unified-card flex align-center p-4 gap-4 flex-1">
              <div className="category-icon-square flex justify-center align-center">
                {getCategoryIcon(cat.slug)}
              </div>
              <div className="category-card-info flex-grow">
                <h3 className="category-name font-bold text-black">{cat.name}</h3>
                <p className="category-subtitle text-xs text-secondary mt-1">
                  {cat.slug === 'laptops' && 'Powerful performance. Anywhere.'}
                  {cat.slug === 'keyboards' && 'Built for speed. Made to last.'}
                  {cat.slug === 'headphones' && 'Premium sound. Pure clarity.'}
                  {cat.slug === 'monitors' && 'Crystal clear displays.'}
                </p>
              </div>
              <ArrowRight size={16} className="text-secondary ml-auto" />
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="home-section mb-16">
        <div className="section-header flex justify-between align-center mb-6">
          <h2 className="section-title text-2xl font-bold">Recommended Gear</h2>
          <Link to="/products" className="text-sm font-semibold flex align-center gap-1 text-accent-highlight">
            <span>Explore Full Catalog</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <Loader message="Loading recommended products..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={fetchFeatured} />
        ) : (
          <div className="grid grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Value Proposition Benefits */}
      <section className="usp-section card p-8 mb-16 flex align-center justify-between gap-8">
        <div className="usp-text">
          <h3 className="text-xl font-bold mb-2">Search by Need, Not Just Specs</h3>
          <p className="text-sm text-secondary">
            Traditional filters force you to pre-select RAM, processor families, and screen sizes. TeckAI is engineered to match workloads (like running local Docker virtual machines or compiling heavy Rust builds) directly to physical hardware specs.
          </p>
        </div>
        <div className="usp-icon-decor flex justify-center align-center">
          <Cpu size={48} className="usp-decor-icon" />
        </div>
      </section>
    </div>
  );
};

export default Home;
