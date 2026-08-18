import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import './Filters.css';

const BRANDS = [
  { label: 'All Brands', value: '' },
  { label: 'Lenovo', value: 'Lenovo' },
  { label: 'Apple', value: 'Apple' },
  { label: 'HP', value: 'HP' },
  { label: 'Dell', value: 'Dell' },
  { label: 'ASUS', value: 'ASUS' },
  { label: 'Acer', value: 'Acer' },
  { label: 'Sony', value: 'Sony' },
  { label: 'Bose', value: 'Bose' },
  { label: 'Sennheiser', value: 'Sennheiser' },
  { label: 'Audio-Technica', value: 'Audio-Technica' },
  { label: 'Keychron', value: 'Keychron' },
  { label: 'Logitech', value: 'Logitech' },
  { label: 'SteelSeries', value: 'SteelSeries' }
];

const SORT_OPTIONS = [
  { label: 'Popular & Featured', value: '' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Newest Arrivals', value: 'newest' }
];

const Filters = ({ categories = [], filters = {}, onFilterChange, onClear }) => {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice || '');
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice || '');

  // Synchronize state with URL parameters when filters prop updates
  useEffect(() => {
    setSearchInput(filters.search || '');
    setMinPriceInput(filters.minPrice || '');
    setMaxPriceInput(filters.maxPrice || '');
  }, [filters.search, filters.minPrice, filters.maxPrice]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange({ search: searchInput });
  };

  const handlePriceSubmit = (e) => {
    e.preventDefault();
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
          {BRANDS.map((b) => (
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
            onChange={(e) => setMinPriceInput(e.target.value)}
          />
          <span className="text-muted">-</span>
          <input
            type="number"
            className="input-text price-input"
            placeholder="Max"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-price-apply">Go</button>
        </form>
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
