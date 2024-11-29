CREATE TABLE Customer (
    first_name varchar(20) NOT NULL,
    last_name varchar(20) NOT NULL,
    phone_number varchar(11) NOT NULL,
    email varchar(60) PRIMARY KEY
);

CREATE TABLE FoodTable (
    table_id INT PRIMARY KEY,
    access_code INT NOT NULL UNIQUE,
    capacity INT CHECK (capacity > 0)
);

CREATE TABLE MenuItem (
    menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
    price DECIMAL(10, 2) NOT NULL,
    name varchar(40) NOT NULL,
    description varchar(200),
    category varchar(20)
);

CREATE TABLE Ingredient (
    menu_item_id INT NOT NULL,
    ingredient_name VARCHAR(20) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (menu_item_id, ingredient_name),
    FOREIGN KEY (menu_item_id) REFERENCES MenuItem(menu_item_id)
);

CREATE TABLE FoodOrder (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT REFERENCES FoodTable(table_id),
    payment_reference varchar(4) NOT NULL,
    email varchar(60) REFERENCES Customer(email)
    
);

CREATE TABLE OrderItem (
    order_id INT REFERENCES FoodOrder(order_id),
    menu_item_id INT REFERENCES MenuItem(menu_item_id),
    PRIMARY KEY (order_id, menu_item_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    special_instructions varchar(100),
    stat varchar(10) NOT NULL
);

INSERT INTO FoodTable (table_id, access_code, capacity) VALUES
(1, 12345, 2),
(2, 12346, 4),
(3, 12347, 2),
(4, 12348, 6),
(5, 12349, 4),
(6, 12350, 8),
(7, 12351, 4),
(8, 12352, 2),
(9, 12353, 10),
(10, 12354, 6),
(11, 12355, 8),
(12, 12356, 4);

INSERT INTO MenuItem (price, name, description, category) VALUES
(9.99, 'Margherita Pizza', 'Classic pizza with tomato, mozzarella, and basil.', 'Vegetarian'),
(14.99, 'Pepperoni Pizza', 'Pizza topped with pepperoni and mozzarella.', 'Non Veg'),
(7.99, 'Caesar Salad', 'Fresh lettuce, croutons, and Caesar dressing.', 'Vegetarian'),
(4.99, 'Garlic Bread', 'Toasted bread with garlic and butter.', 'Vegetarian'),
(12.99, 'Chicken Alfredo Pasta', 'Pasta with creamy Alfredo sauce and chicken.', 'Non Veg'),
(8.99, 'Vegan Buddha Bowl', 'Quinoa, fresh vegetables, and tahini dressing.', 'Vegan'),
(10.99, 'Halal Grilled Kebab', 'Grilled lamb kebab with spices.', 'Halal'),
(11.99, 'Hamburger', 'Juicy beef patty with lettuce, tomato, and cheese in a bun.', 'Non Veg');

INSERT INTO Ingredient (menu_item_id, ingredient_name, quantity)
VALUES
(1, 'Tomato', 3),
(1, 'Mozzarella', 2),
(1, 'Basil', 5),
(2, 'Tomato', 3),
(2, 'Mozzarella', 2),
(2, 'Pepperoni', 10),
(3, 'Lettuce', 1),
(3, 'Croutons', 1),
(3, 'Caesar Dressing', 1),
(4, 'Bread', 2),
(4, 'Garlic', 3),
(4, 'Butter', 1),
(5, 'Pasta', 1),
(5, 'Chicken', 2),
(5, 'Alfredo Sauce', 1),
(6, 'Quinoa', 1),
(6, 'Carrot', 2),
(6, 'Tahini Dressing', 1),
(7, 'Lamb', 2),
(7, 'Spices', 1),
(7, 'Garlic', 1),
(8, 'Beef Patty', 1),
(8, 'Lettuce', 1),
(8, 'Tomato', 2),
(8, 'Cheese', 1),
(8, 'Bun', 2);
