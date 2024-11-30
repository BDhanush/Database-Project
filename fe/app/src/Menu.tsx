import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './style/Menu.css';
import { useCart } from './CartContext';
import { baseURL } from './App';

interface MenuItem {
  menu_item_id: number;
  price: number;
  name: string;
  description?: string;
  category: string;
}

interface Ingredient {
  ingredient_name: string;
  quantity: number;
}

const Menu: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']); // Initial 'All' category
  const { cart, addToCart, updateCartItemQuantity } = useCart();

  const [ingredientsData, setIngredientsData] = useState<{ [key: number]: Ingredient[] }>({});
  const [visibleIngredientIds, setVisibleIngredientIds] = useState<number[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);

  // Fetch menu items
  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await axios.get<MenuItem[]>(`${baseURL}/menu`);
        setMenuItems(response.data);
      } catch (error) {
        console.error('Error fetching menu items:', error);
      } finally {
        setIsLoadingMenu(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await axios.get<{ category: string }[]>(`${baseURL}/categories`);
        const categoryNames = response.data.map((cat) => cat.category); // Extract category names
        setCategories(['All', ...categoryNames]); // Add "All" at the beginning
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
    fetchMenuItems();
  }, []);

  const filteredItems = menuItems.filter((item: MenuItem) =>
    (category === 'All' || item.category === category) &&
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCartItemQuantity = (menuItemId: number) => {
    const cartItem = cart.find(item => item.menu_item_id === menuItemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const fetchIngredients = async (menuItemId: number, menuItemName: string) => {
    try {
      const response = await axios.get<Ingredient[]>(`${baseURL}/ingredients?menu_item_id=${menuItemId}`);
      setIngredients(response.data);
      setPopupTitle(menuItemName);
      setPopupVisible(true);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    }
  };

  return (
    <div className="menu-container">
      <h2>Menu</h2>
      <div className="search-filter">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div className="menu-items">
        {filteredItems.map(item => {
          const quantity = getCartItemQuantity(item.menu_item_id);
          return (
            <div key={item.menu_item_id} className="menu-item">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <p>Price: ${item.price}</p>
              <button onClick={() => fetchIngredients(item.menu_item_id, item.name)}>
                View Ingredients
              </button>
              {quantity === 0 ? (
                <button onClick={() => addToCart({ ...item, quantity: 1 })}>Add to Cart</button>
              ) : (
                <div className="quantity-controls">
                  <button onClick={() => updateCartItemQuantity(item.menu_item_id, quantity - 1)}>-</button>
                  <span>{quantity}</span>
                  <button onClick={() => updateCartItemQuantity(item.menu_item_id, quantity + 1)}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {popupVisible && (
        <div className="popup-overlay" onClick={() => setPopupVisible(false)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <h3>Ingredients for {popupTitle}</h3>
            <ul>
              {ingredients.map((ingredient, index) => (
                <li key={index}>
                  <strong>{ingredient.ingredient_name}</strong>: {ingredient.quantity}
                </li>
              ))}
            </ul>
            <button onClick={() => setPopupVisible(false)}>Close</button>
          </div>
        </div>
      )}

      <Link to="/cart" className="cart-link">
        <button>Go to Cart</button>
      </Link>
    </div>
  );
};

export default Menu;
