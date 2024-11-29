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
  const [categories, setCategories] = useState<string[]>([]);
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
    fetchMenuItems();
  }, []);

  // Fetch categories dynamically
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get<string[]>(`${baseURL}/categories`);
        setCategories(['All', ...response.data]); // Add 'All' as the default option
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const filteredItems = menuItems.filter((item: MenuItem) =>
    (category === 'All' || item.category === category) &&
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCartItemQuantity = (menuItemId: number) => {
    const cartItem = cart.find(item => item.menu_item_id === menuItemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const toggleIngredients = async (menuItemId: number) => {
    if (visibleIngredientIds.includes(menuItemId)) {
      // Hide ingredients
      setVisibleIngredientIds(visibleIngredientIds.filter(id => id !== menuItemId));
    } else {
      // Show ingredients
      // Fetch ingredients if not already fetched
      if (!ingredientsData[menuItemId]) {
        try {
          const response = await axios.get<Ingredient[]>(`${baseURL}/ingredients/${menuItemId}`);
          setIngredientsData(prevData => ({ ...prevData, [menuItemId]: response.data }));
        } catch (error) {
          console.error('Error fetching ingredients:', error);
        }
      }
      setVisibleIngredientIds([...visibleIngredientIds, menuItemId]);
    }
  };

  return (
    <div className="menu-container">
      <h2>Menu</h2>

      {isLoadingCategories ? (
        <p>Loading categories...</p>
      ) : (
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
      )}

      {isLoadingMenu ? (
        <p>Loading menu items...</p>
      ) : (
        <div className="menu-items">
          {filteredItems.map(item => {
            const quantity = getCartItemQuantity(item.menu_item_id);
            return (
              <div key={item.menu_item_id} className="menu-item">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <p>Price: ${item.price}</p>
                {quantity === 0 ? (
                  <button onClick={() => addToCart({ ...item, quantity: 1 })}>Add to Cart</button>
                ) : (
                  <div className="quantity-controls">
                    <button onClick={() => updateCartItemQuantity(item.menu_item_id, quantity - 1)}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => updateCartItemQuantity(item.menu_item_id, quantity + 1)}>+</button>
                  </div>
                )}
                <button onClick={() => toggleIngredients(item.menu_item_id)}>Ingredients</button>
                {visibleIngredientIds.includes(item.menu_item_id) && ingredientsData[item.menu_item_id] && (
                  <div className="ingredients-list">
                    <h4>Ingredients:</h4>
                    <ul>
                      {ingredientsData[item.menu_item_id].map(ingredient => (
                        <li key={ingredient.ingredient_name}>
                          {ingredient.ingredient_name}: {ingredient.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link to="/cart" className="cart-link">
        <button>Go to Cart</button>
      </Link>
    </div>
  );
};

export default Menu;
