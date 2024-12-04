import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from './CartContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './style/Cart.css';
import { baseURL } from './App';

interface CartProps {
  isAuthenticated: string;
  tableNumber: number;
}

const Cart: React.FC<CartProps> = ({ isAuthenticated,tableNumber }) => {
  const { cart, removeFromCart, clearCart, updateSpecialInstructions } = useCart();
  const stripe = useStripe();
  const elements = useElements();

  // State management
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showInstructions, setShowInstructions] = useState<{ [id: number]: boolean }>({});

  // Calculate the total amount
  const totalAmount: number = parseFloat(cart.reduce(
    (acc: number, item) => acc + item.price * item.quantity,
    0).toFixed(2));

  // Toggle visibility of instructions input
  const toggleInstructions = (menuItemId: number) => {
    setShowInstructions((prevState) => ({
      ...prevState,
      [menuItemId]: !prevState[menuItemId],
    }));
  };

  // Handle the payment process
  const handlePayment = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post<{ clientSecret: string }>(
        `${baseURL}/createPaymentIntent`,
        { cart, table_number: tableNumber, email:isAuthenticated }
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
                <p>Special Instructions: {item.special_instructions || 'None'}</p>
                {showInstructions[item.menu_item_id] && (
                  <input
                    type="text"
                    placeholder="Add instructions"
                    defaultValue={item.special_instructions || ''}
                    onBlur={(e) => updateSpecialInstructions(item.menu_item_id, e.target.value)}
                    className="special-instructions-input"
                  />
                )}
                <button onClick={() => toggleInstructions(item.menu_item_id)}>
                  {showInstructions[item.menu_item_id] ? 'Hide' : 'Add Instructions'}
                </button>
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
