import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, ArrowRight, Laptop, Headphones, Keyboard, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import ProductCard from '../components/product/ProductCard';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './Home.css';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    fetchFeatured();
  }, []);

  const categories = [
    { name: 'Laptops', slug: 'laptops', icon: <Laptop size={24} />, count: '10 products' },
    { name: 'Headphones', slug: 'headphones', icon: <Headphones size={24} />, count: '6 products' },
    { name: 'Keyboards', slug: 'keyboards', icon: <Keyboard size={24} />, count: '5 products' }
  ];

  return (
    <div className="home-page container fade-in">
      {/* Hero Section */}
      <section className="hero-section text-center py-16">
        <div className="hero-ai-badge inline-flex align-center gap-2 mb-4">
          <Sparkles size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">Next-Gen Intelligent E-commerce</span>
        </div>
        <h1 className="hero-title text-4xl font-bold mb-4">
          Discover Technology Matched to <span className="title-highlight">Your Real Workloads</span>
        </h1>
        <p className="hero-subtitle text-lg text-secondary mb-8">
          TeckAI combines a developer-grade catalog with natural language intelligence to guide your search for laptops, keyboards, and noise-cancelling headphones.
        </p>
        <div className="hero-ctas flex justify-center gap-4">
          <Link to="/products" className="btn btn-primary btn-lg">
            <span>Browse Catalog</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/ai-assistant" className="btn btn-secondary btn-lg">
            <Sparkles size={16} />
            <span>AI Shopping Assistant</span>
          </Link>
        </div>
      </section>

      {/* Main Categories Section */}
      <section className="home-section mb-12">
        <div className="section-header flex justify-between align-center mb-6">
          <h2 className="section-title text-2xl font-bold">Featured Categories</h2>
          <Link to="/products" className="text-sm font-semibold flex align-center gap-1 text-accent-highlight">
            <span>View All</span>
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link key={cat.slug} to={`/products?category=${cat.slug}`} className="card category-card flex align-center p-6 gap-4">
              <div className="category-icon-wrapper flex justify-center align-center">
                {cat.icon}
              </div>
              <div className="category-card-info">
                <h3 className="category-name text-md font-bold">{cat.name}</h3>
                <span className="category-count text-xs text-muted">{cat.count}</span>
              </div>
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
