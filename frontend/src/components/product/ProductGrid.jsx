import React from 'react';
import ProductCard from './ProductCard';
import './ProductGrid.css';

const ProductGrid = ({ products = [] }) => {
  if (products.length === 0) {
    return (
      <div className="empty-catalog-state">
        <p className="text-lg font-semibold text-secondary">No products found</p>
        <p className="text-sm text-muted">Try clearing search parameters or adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6 product-grid-layout">
      {products.map(product => (
        <ProductGridItemWrapper key={product._id || product.slug}>
          <ProductCard product={product} />
        </ProductGridItemWrapper>
      ))}
    </div>
  );
};

// Help with frontend tests if needed
export const ProductGridItemWrapper = ({ children }) => {
  return <div className="product-grid-item">{children}</div>;
};

export default ProductGrid;
