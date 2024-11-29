import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from './CartContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './style/Cart.css';
import { baseURL } from './App';

interface CartProps {
  tableNumber: number;
}

const Cart: React.FC<CartProps> = ({ tableNumber }) => {
  const { cart, removeFromCart, updateCartItem, clearCart } = useCart();
  const stripe = useStripe();
  const elements = useElements();

  // State management
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Calculate the total amount
  const totalAmount: number = cart.reduce(
    (acc: number, item) => acc + item.price * item.quantity,
    0
  );

  // Handle the payment process
  const handlePayment = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post<{ clientSecret: string }>(
        `${baseURL}/createPaymentIntent`,
        { cart, table_number: tableNumber }
      );

      const { clientSecret } = response.data;

      const cardElement = elements?.getElement(CardElement);
      if (!cardElement || !stripe) {
        setIsProcessing(false);
        setErrorMessage('Stripe is not properly initialized.');
        return;
      }

      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `Table ${tableNumber}`,
          },
        },
      });

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message || 'Payment failed.');
      }

      if (paymentResult.paymentIntent?.status === 'succeeded') {
        alert('Payment successful!');
        clearCart();
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || error.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle updates to special instructions
  const handleSpecialInstructionsChange = (menuItemId: number, value: string) => {
    updateCartItem(menuItemId, { special_instructions: value });
  };

  return (
    <div className="cart-container">
      <h2>Your Cart</h2>
      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div>
          <div className="cart-items-container">
            {cart.map((item) => (
              <div key={item.menu_item_id} className="cart-item">
                <h3>{item.name}</h3>
                <p>Price: ${item.price}</p>
                <p>Quantity: {item.quantity}</p>
                <label>
                  Special Instructions:
                  <input
                    type="text"
                    value={item.special_instructions || ''}
                    onChange={(e) => handleSpecialInstructionsChange(item.menu_item_id, e.target.value)}
                    placeholder="Add special instructions"
                  />
                </label>
                <button onClick={() => removeFromCart(item.menu_item_id)}>Remove</button>
              </div>
            ))}
          </div>
          <h3>Total: ${totalAmount}</h3>
          <form onSubmit={handlePayment}>
            <CardElement options={{ hidePostalCode: true }} />
            <button type="submit" disabled={!stripe || isProcessing}>
              {isProcessing ? 'Processing...' : 'Pay Now'}
            </button>
          </form>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}
          <button onClick={clearCart}>Clear Cart</button>
          <Link to="/menu">
            <button>Back to Menu</button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Cart;
