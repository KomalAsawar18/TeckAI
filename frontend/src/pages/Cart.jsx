import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Shield } from 'lucide-react';
import Loader from '../components/common/Loader';
import './Cart.css';

const Cart = () => {
  const {
    cartItems,
    loading,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal
  } = useCart();

  if (loading) {
    return (
      <div className="cart-loading-container flex justify-center align-center">
        <Loader />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container py-16 text-center fade-in">
        <div className="cart-empty-wrapper max-w-md mx-auto card p-8 flex flex-col align-center">
          <ShoppingBag size={48} className="text-muted mb-4" />
          <h1 className="text-xl font-bold text-primary mb-2">Your Cart is Empty</h1>
          <p className="text-secondary text-sm mb-6">
            You haven't added any products to your shopping cart yet.
          </p>
          <Link to="/products" className="btn btn-primary flex align-center gap-2">
            <ArrowLeft size={16} />
            <span>Browse Products</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12 fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Shopping Cart</h1>
        <p className="text-secondary text-sm">Review your selected items and subtotals</p>
      </div>

      <div className="cart-grid">
        {/* Cart Items List */}
        <div className="cart-items-section flex flex-col gap-4">
          {cartItems.map((item) => {
            const product = item.product;
            const itemSubtotal = product.price * item.quantity;
            const isMaxStock = item.quantity >= product.stock;

            return (
              <div key={product._id} className="card cart-item-card p-4 flex gap-4">
                <div className="cart-item-image-wrapper">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/100'}
                    alt={product.name}
                    className="cart-item-image"
                  />
                </div>

                <div className="cart-item-details flex flex-col justify-between flex-1">
                  <div className="flex justify-between align-start gap-4">
                    <div>
                      <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
                        {product.brand}
                      </span>
                      <h3 className="cart-item-name font-semibold text-base mt-1 text-primary">
                        <Link to={`/products/${product.slug}`} className="hover-underline">
                          {product.name}
                        </Link>
                      </h3>
                      {product.stock <= 5 && (
                        <span className="text-xs font-medium text-warning mt-1 block">
                          Only {product.stock} left in stock
                        </span>
                      )}
                    </div>
                    <button
                      className="cart-item-remove-btn text-muted hover-text-danger"
                      onClick={() => removeFromCart(product._id)}
                      title="Remove Item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="cart-item-actions flex justify-between align-center mt-4">
                    <div className="quantity-controls flex align-center border rounded">
                      <button
                        className="qty-btn p-1 text-secondary hover-text-primary"
                        onClick={() => updateQuantity(product._id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="qty-value px-3 font-semibold text-sm text-primary">
                        {item.quantity}
                      </span>
                      <button
                        className="qty-btn p-1 text-secondary hover-text-primary"
                        onClick={() => updateQuantity(product._id, item.quantity + 1)}
                        disabled={isMaxStock}
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="cart-item-price-wrapper text-right">
                      <div className="text-xs text-secondary">
                        PKR {product.price.toLocaleString()} each
                      </div>
                      <div className="font-bold text-primary mt-1">
                        PKR {itemSubtotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between mt-4">
            <Link to="/products" className="btn btn-secondary flex align-center gap-2">
              <ArrowLeft size={16} />
              <span>Continue Shopping</span>
            </Link>
            <button className="btn btn-secondary text-danger" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="cart-summary-section">
          <div className="card p-6 shadow-md border sticky-summary">
            <h2 className="text-lg font-bold text-primary mb-4 pb-2 border-bottom">
              Order Summary
            </h2>

            <div className="flex flex-col gap-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-secondary">Subtotal</span>
                <span className="font-semibold text-primary">
                  PKR {cartSubtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Shipping</span>
                <span className="text-muted text-xs italic">
                  Calculated at checkout (Placeholder)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Tax</span>
                <span className="font-semibold text-primary">PKR 0</span>
              </div>
            </div>

            <div className="flex justify-between align-center font-bold text-lg pt-4 border-top mb-6">
              <span className="text-primary">Estimated Total</span>
              <span className="text-primary">
                PKR {cartSubtotal.toLocaleString()}
              </span>
            </div>

            <Link 
              to="/checkout"
              className="btn btn-primary w-full py-3 text-center block"
            >
              Proceed to Checkout
            </Link>

            <div className="flex align-center gap-2 justify-center mt-6 text-xs text-muted">
              <Shield size={14} />
              <span>Authoritative catalog stock validations active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
