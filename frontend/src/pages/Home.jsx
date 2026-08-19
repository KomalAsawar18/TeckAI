import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Laptop, Headphones, Keyboard, Sparkles, Star, Heart, Cpu, Monitor } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { formatPrice } from '../utils/format';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './Home.css';

const FeaturedHorizontalCard = ({ product }) => {
  const { name, slug, brand, price, currency, images, rating } = product;
  const { isInWishlist, toggleWishlist } = useWishlist();
  const mainImage = images && images.length > 0 ? images[0] : 'https://placehold.co/600x400/eceef2/8b8d99?text=TeckAI';
  const isFav = isInWishlist(product._id);

  return (
    <div className="card featured-horizontal-card flex align-center gap-4 p-4 relative">
      <div className="featured-badge absolute top-2 right-2 text-xs font-semibold bg-accent-soft text-accent-highlight px-2 py-1 rounded">Featured</div>
      <Link to={`/products/${slug}`} className="featured-img-link shrink-0">
        <img src={mainImage} alt={name} loading="lazy" className="featured-img" />
      </Link>
      <div className="featured-info flex flex-col flex-grow">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">{brand}</span>
        <h3 className="text-sm font-bold mb-1 truncate-2-lines" title={name}>
          <Link to={`/products/${slug}`}>{name}</Link>
        </h3>
        
        {rating && rating > 0 ? (
          <div className="flex align-center gap-1 text-xs text-secondary mb-2">
            <Star size={12} className="text-accent-highlight fill-accent" />
            <span className="font-semibold">{rating.toFixed(1)}</span>
          </div>
        ) : (
          <div className="mb-2"></div>
        )}
        
        <div className="mt-auto flex align-center justify-between">
          <span className="font-bold text-primary">{formatPrice(price, currency)}</span>
        </div>
      </div>
      
      <button
        className={`wishlist-toggle-btn absolute bottom-4 right-4 ${isFav ? 'active' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWishlist(product);
        }}
        title={isFav ? "Remove from Wishlist" : "Add to Wishlist"}
        type="button"
      >
        <Heart size={16} fill={isFav ? "var(--color-accent-highlight)" : "none"} className={isFav ? "text-accent-highlight" : "text-muted"} />
      </button>
    </div>
  );
};

const Home = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        const [catRes, prodRes] = await Promise.all([
          api.getCategories(),
          api.getProducts()
        ]);
        
        const fetchedCats = catRes.data;
        const allProds = prodRes.data;
        
        setCategories(fetchedCats);
        setFeaturedProducts(allProds.slice(0, 4));

        // Derive representative images from real product data
        const catImageMap = {};
        fetchedCats.forEach(cat => {
          const repProduct = allProds.find(p => {
            if (!p.category) return false;
            if (typeof p.category === 'string') return p.category === cat._id;
            if (p.category._id) return p.category._id === cat._id;
            if (p.category.slug) return p.category.slug === cat.slug;
            return false;
          });
          if (repProduct && repProduct.images && repProduct.images.length > 0) {
            catImageMap[cat.slug] = repProduct.images[0];
          }
        });
        setCategoryImages(catImageMap);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load home page data');
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getCategoryIcon = (slug) => {
    switch (slug.toLowerCase()) {
      case 'laptops': return <Laptop size={20} className="text-accent-highlight" strokeWidth={1.5} />;
      case 'headphones': return <Headphones size={20} className="text-accent-highlight" strokeWidth={1.5} />;
      case 'keyboards': return <Keyboard size={20} className="text-accent-highlight" strokeWidth={1.5} />;
      case 'monitors': return <Monitor size={20} className="text-accent-highlight" strokeWidth={1.5} />;
      default: return <Cpu size={20} className="text-accent-highlight" strokeWidth={1.5} />;
    }
  };

  return (
    <div className="home-page fade-in pb-16">
      
      {/* Premium Split Hero Section */}
      <section className="container mt-6 mb-12">
        <div className="premium-hero-banner flex">
          <div className="hero-content flex flex-col justify-center">
            <h1 className="hero-title font-bold mb-4">
              Find the right tech<br />for your needs.
            </h1>
            <p className="hero-subtitle text-secondary mb-8">
              Discover smart, reliable technology with recommendations powered by TeckAI.
            </p>
            
            <form onSubmit={handleSearchSubmit} className="hero-unified-search flex align-center max-w-lg">
              <div className="hero-search-input-wrapper flex flex-grow align-center px-4 gap-2 bg-surface">
                <Search size={18} className="text-muted shrink-0" />
                <input
                  type="text"
                  className="hero-search-input flex-grow py-3"
                  placeholder="Search for products, brands or categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="hero-search-divider"></div>
              <button
                type="button"
                className="btn btn-primary hero-ai-btn flex align-center gap-2 h-full rounded-r"
                onClick={() => {
                  navigate('/ai-assistant', { state: { initialMessage: searchQuery } });
                }}
              >
                <Sparkles size={16} />
                <span className="whitespace-nowrap">Ask TeckAI</span>
              </button>
            </form>
          </div>
          
          <div className="hero-visual flex justify-end align-end">
            <img 
              src="/hero-composition.png" 
              alt="Premium Tech Gear Composition" 
              className="hero-composition-img"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      {categories.length > 0 && (
        <section className="container mb-12">
          <h2 className="text-xl font-bold mb-6">Shop by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <Link key={cat.slug} to={`/products?category=${cat.slug}`} className="card category-detailed-card flex group">
                <div className="category-detailed-img-wrapper shrink-0">
                  {categoryImages[cat.slug] ? (
                    <img src={categoryImages[cat.slug]} alt={cat.name} className="category-detailed-img" loading="lazy" />
                  ) : (
                    <div className="category-fallback-img flex justify-center align-center">
                      <Cpu size={32} className="text-muted" />
                    </div>
                  )}
                </div>
                <div className="category-detailed-info flex flex-grow align-center justify-between p-4 bg-surface">
                  <div className="flex align-center gap-3">
                    <div className="category-detailed-icon flex justify-center align-center">
                      {getCategoryIcon(cat.slug)}
                    </div>
                    <h3 className="font-semibold text-sm text-primary">{cat.name}</h3>
                  </div>
                  <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Picks */}
      <section className="container mb-16">
        <div className="flex justify-between align-center mb-6">
          <h2 className="text-xl font-bold">Featured Picks</h2>
          <Link to="/products" className="text-sm font-semibold flex align-center gap-1 text-accent-highlight hover:underline">
            <span>View all products</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <Loader message="Loading featured picks..." />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <FeaturedHorizontalCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* AI CTA Strip */}
      <section className="container">
        <div className="ai-cta-strip card p-8 flex flex-col md:flex-row align-center justify-between gap-6">
          <div className="flex align-center gap-6">
            <div className="ai-cta-icon flex justify-center align-center shrink-0">
              <Sparkles size={28} className="text-accent-highlight" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Not sure what you need? Ask TeckAI.</h3>
              <p className="text-sm text-secondary">
                Tell us your needs or budget and get personalized product recommendations.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/ai-assistant')}
            className="btn btn-primary px-8 py-3 whitespace-nowrap shrink-0"
          >
            <Sparkles size={16} />
            Ask TeckAI
          </button>
        </div>
      </section>

    </div>
  );
};

export default Home;
