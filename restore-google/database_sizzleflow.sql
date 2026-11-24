-- SizzleFlow database for XAMPP (MySQL / MariaDB)
-- How to use: open phpMyAdmin > Import > choose this file > Go.
-- It creates the database `sizzleflow`, all tables, and sample data.

CREATE DATABASE IF NOT EXISTS sizzleflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sizzleflow;

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NULL,
  google_sub    VARCHAR(255) NULL,
  auth_provider VARCHAR(20)  NOT NULL DEFAULT 'password',
  role          VARCHAR(20)  NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_categories (
  id   INT          NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id          INT           NOT NULL PRIMARY KEY,
  category_id INT           NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  options_json TEXT         NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  FOREIGN KEY (category_id) REFERENCES product_categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expense_categories (
  id   INT          NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  id             CHAR(36)      NOT NULL PRIMARY KEY,
  receipt_no     VARCHAR(40)   NOT NULL,
  user_id        CHAR(36)      NOT NULL,
  customer_name  VARCHAR(255)  NULL,
  device_id      VARCHAR(64)   NOT NULL,
  payment_method VARCHAR(20)   NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  sale_date      DATETIME      NOT NULL,
  sync_status    VARCHAR(10)   NOT NULL DEFAULT 'synced',
  is_deleted     TINYINT(1)    NOT NULL DEFAULT 0,
  updated_at     DATETIME      NULL,
  INDEX idx_sales_date (sale_date),
  INDEX idx_sales_receipt (receipt_no),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
  id         CHAR(36)      NOT NULL PRIMARY KEY,
  sale_id    CHAR(36)      NOT NULL,
  product_id INT           NOT NULL,
  item_name  VARCHAR(255)  NULL,
  category_id INT          NULL,
  options_json TEXT        NULL,
  quantity   INT           NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal   DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id           CHAR(36)      NOT NULL PRIMARY KEY,
  user_id      CHAR(36)      NOT NULL,
  category_id  INT           NOT NULL,
  description  VARCHAR(255)  NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  expense_date DATE          NOT NULL,
  sync_status  VARCHAR(10)   NOT NULL DEFAULT 'synced',
  is_deleted   TINYINT(1)    NOT NULL DEFAULT 0,
  updated_by   CHAR(36)      NULL,
  updated_at   DATETIME      NULL,
  INDEX idx_expenses_date (expense_date),
  FOREIGN KEY (user_id)     REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- SAMPLE MENU DATA (replace the menu and prices with SIP & SIZZLE's real ones)
-- ---------------------------------------------------------------

INSERT IGNORE INTO product_categories (id, name) VALUES
(1, 'Meals'), (2, 'Silog Meals'), (3, 'Snacks'), (4, 'Fries'),
(5, 'Fruit Soda Series'), (6, 'Yakult Series'), (7, 'Special Drinks'), (8, 'Snack Combos');

INSERT IGNORE INTO products (id, category_id, name, price, options_json, is_active) VALUES
(1,1,'Chicken Pastil',55,NULL,1),(2,1,'Pork Tonkatsu',69,NULL,1),(3,1,'Fried Chicken',55,NULL,1),(4,1,'Pork Sisig (Regular)',59,NULL,1),(5,1,'Pork Sisig with Egg',69,NULL,1),
(6,2,'Hotsilog',39,NULL,1),(7,2,'Lumpiasilog',39,NULL,1),(8,2,'Siomaisilog',39,NULL,1),(9,2,'Hamsilog',39,NULL,1),(10,2,'Porksilog',59,NULL,1),(11,2,'Tapsilog',69,NULL,1),
(12,3,'Regular Burger',20,NULL,1),(13,3,'Cheese Burger',25,NULL,1),(14,3,'Burger With Egg',35,NULL,1),(15,3,'Hotdog Sandwich',25,NULL,1),(16,3,'Cheesy Hotdog Sandwich',35,NULL,1),
(17,4,'Fries',30,'{"type":"fries","flavors":["Cheese","Sour Cream","Barbecue"]}',1),
(18,5,'Fruit Soda',29,'{"type":"flavorSize","flavors":["Strawberry","Lychee","Green Apple","Lemon","Blueberry"],"sizes":[{"name":"12oz","price":29},{"name":"16oz","price":39}]}',1),
(19,6,'Yakult Series',44,'{"type":"flavorSize","flavors":["Strawberry","Lychee","Green Apple","Lemon","Blueberry"],"sizes":[{"name":"12oz","price":44},{"name":"16oz","price":54}]}',1),
(20,7,'Iced Coffee Latte',49,'{"type":"size","sizes":[{"name":"12oz","price":49},{"name":"16oz","price":59}]}',1),
(21,7,'Matcha Latte',49,'{"type":"size","sizes":[{"name":"12oz","price":49},{"name":"16oz","price":59}]}',1),
(22,7,'Lemonade',39,'{"type":"size","sizes":[{"name":"12oz","price":39},{"name":"16oz","price":49}]}',1),
(23,7,'Oreo Matcha Latte',59,'{"type":"size","sizes":[{"name":"12oz","price":59},{"name":"16oz","price":69}]}',1),
(24,8,'Combo A',45,'{"type":"combo","requires":["sodaFlavor"],"included":"Regular Burger + Fruit Soda","price":45}',1),
(25,8,'Combo B',50,'{"type":"combo","requires":["sodaFlavor"],"included":"Hotdog Sandwich + Fruit Soda","price":50}',1),
(26,8,'Combo C',55,'{"type":"combo","requires":["friesFlavor","sodaFlavor"],"included":"Fries + Fruit Soda","price":55}',1),
(27,8,'Combo D',45,'{"type":"combo","requires":["friesFlavor"],"included":"Regular Burger + Fries","price":45}',1),
(28,8,'Combo E',50,'{"type":"combo","requires":["friesFlavor"],"included":"Hotdog Sandwich + Fries","price":50}',1);

INSERT IGNORE INTO expense_categories (id, name) VALUES
(1, 'Ingredients'),
(2, 'Supplies and Packaging'),
(3, 'Utilities'),
(4, 'Transportation'),
(5, 'Salaries'),
(6, 'Others');
