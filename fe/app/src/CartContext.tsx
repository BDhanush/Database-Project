import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartItem {
  menu_item_id: number;
  price: number;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  special_instructions?: string | null;
}

interface CartContextProps {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (menuItemId: number) => void;
  clearCart: () => void;
  updateCartItemQuantity: (menuItemId: number, quantity: number) => void;
  updateSpecialInstructions: (menuItemId: number, instructions: string) => void; 
}

interface CartProviderProps {
  children: ReactNode;
}

const CartContext = createContext<CartContextProps | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.menu_item_id === item.menu_item_id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.menu_item_id === item.menu_item_id
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      }
      return [...prevCart, item];
    });
  };

  const updateSpecialInstructions = (menuItemId: number, instructions: string) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.menu_item_id === menuItemId ? { ...item, special_instructions: instructions } : item
      )
    );
  };

  const removeFromCart = (menuItemId: number) => {
    setCart(prevCart => prevCart.filter(item => item.menu_item_id !== menuItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const updateCartItemQuantity = (menuItemId: number, quantity: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.menu_item_id === menuItemId ? { ...item, quantity: Math.max(quantity, 0) } : item
      ).filter(item => item.quantity > 0)
    );
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, updateCartItemQuantity, updateSpecialInstructions, }}>
      {children}
    </CartContext.Provider>
  );
};