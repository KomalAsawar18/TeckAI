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
      <div className="cart-container text-center fade-in cart-empty-section">
        <div className="cart-empty-wrapper card flex flex-col align-center">
          <ShoppingBag size={48} className="cart-empty-icon text-muted" />
          <h1 className="cart-empty-title text-primary">Your Cart is Empty</h1>
          <p className="cart-empty-text text-secondary">
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
    <div className="cart-container fade-in cart-page-wrapper">
      <div className="cart-header">
        <h1 className="cart-title text-primary">Shopping Cart</h1>
        <p className="cart-subtitle text-secondary">Review your selected items and subtotals</p>
      </div>

      <div className="cart-grid">
        {/* Cart Items List */}
        <div className="cart-items-section flex flex-col gap-6">
          <div className="cart-items-list flex flex-col gap-6">
            {cartItems.map((item) => {
              const product = item.product;
              const itemSubtotal = product.price * item.quantity;
              const isMaxStock = product.stock !== undefined ? item.quantity >= product.stock : item.quantity >= 99;

              return (
                <div key={product._id} className="card cart-item-card flex gap-6">
                  <div className="cart-item-image-wrapper">
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/120'}
                      alt={product.name}
                      className="cart-item-image"
                    />
                  </div>

                  <div className="cart-item-details flex flex-col justify-between flex-1">
                    <div className="cart-item-header flex justify-between">
                      <div className="cart-item-info">
                        <span className="cart-item-brand text-secondary uppercase">
                          {product.brand}
                        </span>
                        <h3 className="cart-item-name text-primary">
                          <Link to={`/products/${product.slug}`}>{product.name}</Link>
                        </h3>
                        {product.stock !== undefined && product.stock <= 5 && (
                          <span className="cart-item-stock text-warning">
                            Only {product.stock} left in stock
                          </span>
                        )}
                      </div>
                      <button
                        className="cart-item-remove-btn text-muted"
                        onClick={() => removeFromCart(product._id)}
                        aria-label={`Remove ${product.name} from cart`}
                        title="Remove Item"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="cart-item-actions flex justify-between align-center">
                      <div className="cart-quantity-stepper flex align-center border rounded">
                        <button
                          className="qty-btn text-secondary"
                          onClick={() => updateQuantity(product._id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="qty-value text-primary">
                          {item.quantity}
                        </span>
                        <button
                          className="qty-btn text-secondary"
                          onClick={() => updateQuantity(product._id, item.quantity + 1)}
                          disabled={isMaxStock}
                          aria-label="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="cart-item-price-wrapper text-right">
                        {item.quantity > 1 && (
                          <div className="cart-item-unit-price text-secondary">
                            PKR {product.price.toLocaleString()} each
                          </div>
                        )}
                        <div className="cart-item-subtotal text-primary">
                          PKR {itemSubtotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-secondary-actions flex justify-between align-center">
            <Link to="/products" className="btn btn-secondary flex align-center gap-2">
              <ArrowLeft size={16} />
              <span>Continue Shopping</span>
            </Link>
            <button className="cart-clear-btn text-muted" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="cart-summary-section">
          <div className="card cart-summary-card shadow-sm border sticky-summary">
            <h2 className="cart-summary-title text-primary">
              Order Summary
            </h2>

            <div className="cart-summary-rows flex flex-col gap-4">
              <div className="flex justify-between">
                <span className="text-secondary">Subtotal</span>
                <span className="cart-summary-value text-primary">
                  PKR {cartSubtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Shipping</span>
                <span className="text-secondary">
                  Calculated at checkout
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Tax</span>
                <span className="cart-summary-value text-primary">PKR 0</span>
              </div>
            </div>

            <div className="cart-summary-total flex justify-between align-center border-top">
              <span className="text-primary">Estimated Total</span>
              <span className="cart-summary-total-value text-primary">
                PKR {cartSubtotal.toLocaleString()}
              </span>
            </div>

            <Link 
              to="/checkout"
              className="btn btn-primary cart-checkout-btn"
            >
              Proceed to Checkout
            </Link>

            <div className="cart-security-note flex align-center justify-center text-muted">
              <Shield size={16} />
              <span>Secure checkout & stock validation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
