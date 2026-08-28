import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import Filters from '../components/product/Filters';
import ProductGrid from '../components/product/ProductGrid';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import './ProductCatalog.css';

const ProductCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract filters from URL query parameters
  const currentFilters = {
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    brand: searchParams.get('brand') || '',
    sort: searchParams.get('sort') || '',
    page: parseInt(searchParams.get('page'), 10) || 1
  };

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.getCategories();
        setCategories(res.data || res.categories || []);
      } catch (err) {
        console.error('Failed to load categories:', err.message);
      }
    };
    fetchCategories();
  }, []);

  // Fetch canonical products whenever searchParams change
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.getCanonicalProducts({
        category: currentFilters.category,
        search: currentFilters.search,
        minPrice: currentFilters.minPrice,
        maxPrice: currentFilters.maxPrice,
        brand: currentFilters.brand,
        sort: currentFilters.sort,
        page: currentFilters.page,
        limit: 12
      });
      setProducts(res.products || res.data || []);
      setPagination(res.pagination || { page: 1, limit: 12, total: (res.products || []).length, totalPages: 1 });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch catalog products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  // Handle updates to individual filters by modifying URLSearchParams
  const handleFilterChange = (updatedFields) => {
    const newParams = new URLSearchParams(searchParams);
    
    // Reset page to 1 on filter updates to avoid pagination out-of-bounds
    newParams.set('page', '1');

    Object.keys(updatedFields).forEach(key => {
      const val = updatedFields[key];
      if (val !== undefined && val !== null && val !== '') {
        newParams.set(key, val);
      } else {
        newParams.delete(key);
      }
    });

    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  return (
    <div className="product-catalog-page container py-8 fade-in">
      <div className="catalog-header mb-6">
        <h1 className="text-2xl font-bold">Technology Catalog</h1>
        <p className="text-sm text-secondary">
          Compare real-time prices across trusted Pakistan tech retailers and secure the best deal.
        </p>
      </div>

      <div className="catalog-layout flex gap-6">
        {/* Sidebar Filters */}
        <Filters
          categories={categories}
          filters={currentFilters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        {/* Catalog Items Panel */}
        <main className="catalog-main-content">
          {loading ? (
            <Loader message="Fetching product listings..." />
          ) : error ? (
            <ErrorMessage message={error} onRetry={fetchProducts} />
          ) : (
            <div className="flex flex-col gap-6">
              <ProductGrid products={products} />

              {/* Pagination Bar */}
              {pagination.totalPages > 1 && (
                <nav className="pagination-bar flex align-center justify-center gap-4 mt-4" aria-label="Catalog pagination">
                  <button
                    className="btn btn-secondary pagination-btn"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    aria-label="Previous page"
                  >
                    <ArrowLeft size={16} />
                    <span>Previous</span>
                  </button>
                  
                  <span className="pagination-info text-sm font-semibold">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    className="btn btn-secondary pagination-btn"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <ArrowRight size={16} />
                  </button>
                </nav>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProductCatalog;
