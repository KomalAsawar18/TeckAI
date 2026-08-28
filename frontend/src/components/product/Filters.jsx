import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import './Filters.css';

const DEFAULT_BRANDS = [
  { label: 'All Brands', value: '' },
  { label: 'Ajazz', value: 'Ajazz' },
  { label: 'ASUS', value: 'ASUS' },
  { label: 'Logitech', value: 'Logitech' },
  { label: 'Keychron', value: 'Keychron' },
  { label: 'SteelSeries', value: 'SteelSeries' },
  { label: 'Razer', value: 'Razer' },
  { label: 'Dell', value: 'Dell' },
  { label: 'Lenovo', value: 'Lenovo' },
  { label: 'HP', value: 'HP' }
];

const SORT_OPTIONS = [
  { label: 'Newest Arrivals', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Name: A to Z', value: 'name_asc' }
];

const Filters = ({ categories = [], brands = [], filters = {}, onFilterChange, onClear }) => {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice || '');
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice || '');
  const [priceError, setPriceError] = useState('');

  const brandOptions = brands && brands.length > 0
    ? [{ label: 'All Brands', value: '' }, ...brands.map(b => (typeof b === 'string' ? { label: b, value: b } : b))]
    : DEFAULT_BRANDS;

  // Synchronize state with URL parameters when filters prop updates
  useEffect(() => {
    setSearchInput(filters.search || '');
    setMinPriceInput(filters.minPrice || '');
    setMaxPriceInput(filters.maxPrice || '');
    setPriceError('');
  }, [filters.search, filters.minPrice, filters.maxPrice]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange({ search: searchInput });
  };

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const minVal = minPriceInput !== '' ? Number(minPriceInput) : null;
    const maxVal = maxPriceInput !== '' ? Number(maxPriceInput) : null;

    if (minVal !== null && minVal < 0) {
      setPriceError('Prices cannot be negative.');
      return;
    }
    if (maxVal !== null && maxVal < 0) {
      setPriceError('Prices cannot be negative.');
      return;
    }
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      setPriceError('Minimum price cannot exceed maximum price.');
      return;
    }

    setPriceError('');
    onFilterChange({
      minPrice: minPriceInput,
      maxPrice: maxPriceInput
    });
  };

  return (
    <aside className="filters-sidebar">
      {/* Search Bar */}
      <div className="filter-group">
        <h4 className="filter-label text-sm font-semibold mb-2">Search Catalog</h4>
        <form onSubmit={handleSearchSubmit} className="search-form">
          <input
            type="text"
            className="input-text search-input"
            placeholder="Search laptop, ANC..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary search-btn" aria-label="Submit search">
            <Search size={14} />
          </button>
        </form>
      </div>

      {/* Categories */}
      <div className="filter-group">
        <h4 className="filter-label text-sm font-semibold mb-2">Category</h4>
        <div className="category-options-list flex flex-col gap-2">
          <button
            className={`category-option-btn text-sm ${!filters.category ? 'active' : ''}`}
            onClick={() => onFilterChange({ category: '' })}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              className={`category-option-btn text-sm ${filters.category === cat.slug ? 'active' : ''}`}
              onClick={() => onFilterChange({ category: cat.slug })}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div className="filter-group">
        <h4 className="filter-label text-sm font-semibold mb-2">Brand</h4>
        <select
          className="input-text select-brand"
          value={filters.brand || ''}
          onChange={(e) => onFilterChange({ brand: e.target.value })}
        >
          {brandOptions.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="filter-group">
        <h4 className="filter-label text-sm font-semibold mb-2">Price (PKR)</h4>
        <form onSubmit={handlePriceSubmit} className="price-range-form flex align-center gap-2">
          <input
            type="number"
            className="input-text price-input"
            placeholder="Min"
            value={minPriceInput}
            onChange={(e) => {
              setMinPriceInput(e.target.value);
              setPriceError('');
            }}
          />
          <span className="text-muted">-</span>
          <input
            type="number"
            className="input-text price-input"
            placeholder="Max"
            value={maxPriceInput}
            onChange={(e) => {
              setMaxPriceInput(e.target.value);
              setPriceError('');
            }}
          />
          <button type="submit" className="btn btn-secondary btn-price-apply">Go</button>
        </form>
        {priceError && <p className="price-error-msg">{priceError}</p>}
      </div>

      {/* Sort Options */}
      <div className="filter-group">
        <h4 className="filter-label text-sm font-semibold mb-2">Sort By</h4>
        <select
          className="input-text select-sort"
          value={filters.sort || ''}
          onChange={(e) => onFilterChange({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear/Reset Trigger */}
      <button className="btn btn-secondary btn-clear-filters w-full flex justify-center mt-4" onClick={onClear}>
        <RotateCcw size={14} />
        <span>Reset Filters</span>
      </button>
    </aside>
  );
};

export default Filters;
