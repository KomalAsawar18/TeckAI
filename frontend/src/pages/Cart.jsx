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
      <div className="cart-container py-16 text-center fade-in">
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
    <div className="cart-container py-12 fade-in">
      <div className="cart-header mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Shopping Cart</h1>
        <p className="text-secondary text-base">Review your selected items and subtotals</p>
      </div>

      <div className="cart-grid">
        {/* Cart Items List */}
        <div className="cart-items-section flex flex-col gap-6">
          <div className="cart-items-list flex flex-col gap-6">
            {cartItems.map((item) => {
              const product = item.product;
              const itemSubtotal = product.price * item.quantity;
              const isMaxStock = item.quantity >= product.stock;

              return (
                <div key={product._id} className="card cart-item-card p-5 flex gap-6">
                  <div className="cart-item-image-wrapper">
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/120'}
                      alt={product.name}
                      className="cart-item-image"
                    />
                  </div>

                  <div className="cart-item-details flex flex-col justify-between flex-1">
                    <div className="flex justify-between align-start gap-4">
                      <div className="cart-item-info">
                        <span className="cart-item-brand text-xs font-semibold text-secondary uppercase tracking-wider mb-1 block">
                          {product.brand}
                        </span>
                        <h3 className="cart-item-name font-bold text-lg text-primary">
                          <Link to={`/products/${product.slug}`} className="hover-underline">
                            {product.name}
                          </Link>
                        </h3>
                        {product.stock <= 5 && (
                          <span className="text-xs font-medium text-warning mt-2 block">
                            Only {product.stock} left in stock
                          </span>
                        )}
                      </div>
                      <button
                        className="cart-item-remove-btn text-muted hover-text-danger"
                        onClick={() => removeFromCart(product._id)}
                        aria-label={`Remove ${product.name} from cart`}
                        title="Remove Item"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="cart-item-actions flex justify-between align-end mt-4">
                      <div className="cart-quantity-stepper flex align-center border rounded">
                        <button
                          className="qty-btn text-secondary hover-text-primary"
                          onClick={() => updateQuantity(product._id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="qty-value font-semibold text-primary">
                          {item.quantity}
                        </span>
                        <button
                          className="qty-btn text-secondary hover-text-primary"
                          onClick={() => updateQuantity(product._id, item.quantity + 1)}
                          disabled={isMaxStock}
                          aria-label="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="cart-item-price-wrapper text-right">
                        {item.quantity > 1 && (
                          <div className="text-sm text-secondary mb-1">
                            PKR {product.price.toLocaleString()} each
                          </div>
                        )}
                        <div className="font-bold text-xl text-primary">
                          PKR {itemSubtotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-secondary-actions flex justify-between align-center mt-2">
            <Link to="/products" className="btn btn-secondary flex align-center gap-2">
              <ArrowLeft size={16} />
              <span>Continue Shopping</span>
            </Link>
            <button className="cart-clear-btn text-sm text-muted hover-text-danger" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="cart-summary-section">
          <div className="card cart-summary-card p-8 shadow-sm border sticky-summary">
            <h2 className="text-xl font-bold text-primary mb-6">
              Order Summary
            </h2>

            <div className="cart-summary-rows flex flex-col gap-4 text-base mb-6">
              <div className="flex justify-between">
                <span className="text-secondary">Subtotal</span>
                <span className="font-semibold text-primary">
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
                <span className="font-semibold text-primary">PKR 0</span>
              </div>
            </div>

            <div className="cart-summary-total flex justify-between align-center font-bold text-xl pt-6 border-top mb-8">
              <span className="text-primary">Estimated Total</span>
              <span className="text-primary">
                PKR {cartSubtotal.toLocaleString()}
              </span>
            </div>

            <Link 
              to="/checkout"
              className="btn btn-primary w-full py-4 text-center block text-lg font-semibold"
            >
              Proceed to Checkout
            </Link>

            <div className="cart-security-note flex align-center gap-2 justify-center mt-6 text-sm text-muted">
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
