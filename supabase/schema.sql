-- Run this in Supabase Dashboard > SQL Editor.
-- The PHP API uses the server-only Supabase key; never put that key in the Android app.

create table if not exists public.users (
  id uuid primary key,
  full_name varchar(100) not null,
  username varchar(50) not null unique,
  password_hash varchar(255) not null default '',
  email varchar(255),
  google_sub varchar(255),
  auth_provider varchar(20) not null default 'password',
  role varchar(20) not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_unique on public.users (lower(email)) where email is not null and email <> '';
create unique index if not exists users_google_sub_unique on public.users (google_sub) where google_sub is not null and google_sub <> '';

create table if not exists public.product_categories (
  id integer primary key,
  name varchar(100) not null
);

create table if not exists public.products (
  id integer primary key,
  category_id integer not null references public.product_categories(id),
  name varchar(100) not null,
  price numeric(10,2) not null,
  options_json jsonb,
  is_active boolean not null default true
);

create table if not exists public.expense_categories (
  id integer primary key,
  name varchar(100) not null
);

create table if not exists public.sales (
  id uuid primary key,
  receipt_no varchar(40) not null,
  user_id uuid not null references public.users(id),
  customer_name varchar(255),
  device_id varchar(64) not null,
  payment_method varchar(20) not null,
  total_amount numeric(10,2) not null,
  sale_date timestamptz not null,
  sync_status varchar(10) not null default 'synced',
  is_deleted boolean not null default false,
  updated_at timestamptz
);

create index if not exists sales_date_idx on public.sales(sale_date);
create table if not exists public.sale_items (
  id uuid primary key,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id integer not null references public.products(id),
  item_name varchar(255),
  category_id integer,
  options_json jsonb,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create table if not exists public.expenses (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  category_id integer not null references public.expense_categories(id),
  description varchar(255) not null,
  amount numeric(10,2) not null,
  expense_date date not null,
  sync_status varchar(10) not null default 'synced',
  is_deleted boolean not null default false,
  updated_by uuid,
  updated_at timestamptz
);

-- Upgrade existing tables created by an earlier version of the schema.
alter table public.users add column if not exists password_hash varchar(255) not null default '';
alter table public.users add column if not exists email varchar(255);
alter table public.users add column if not exists google_sub varchar(255);
alter table public.users add column if not exists auth_provider varchar(20) not null default 'password';
alter table public.users add column if not exists role varchar(20) not null default 'staff';
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists created_at timestamptz not null default now();

alter table public.products add column if not exists options_json jsonb;
alter table public.products add column if not exists is_active boolean not null default true;

alter table public.sales add column if not exists customer_name varchar(255);
alter table public.sales add column if not exists sync_status varchar(10) not null default 'synced';
alter table public.sales add column if not exists is_deleted boolean not null default false;
alter table public.sales add column if not exists updated_at timestamptz;

alter table public.sale_items add column if not exists item_name varchar(255);
alter table public.sale_items add column if not exists category_id integer;
alter table public.sale_items add column if not exists options_json jsonb;

alter table public.expenses add column if not exists sync_status varchar(10) not null default 'synced';
alter table public.expenses add column if not exists is_deleted boolean not null default false;
alter table public.expenses add column if not exists updated_by uuid;
alter table public.expenses add column if not exists updated_at timestamptz;

-- Repair databases created with the previous foreign keys to auth.users.
-- SizzleFlow authenticates through its PHP bridge and stores its application
-- users in public.users, so transaction ownership must reference that table.
-- This replaces each foreign key with an equivalent constraint; it does not
-- delete transactions or leave the tables without referential integrity.
do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'sales_user_id_fkey'
      and n.nspname = 'public'
      and t.relname = 'sales'
      and pg_get_constraintdef(c.oid) not like '%REFERENCES public.users(id)%'
  ) then
    alter table public.sales drop constraint sales_user_id_fkey;
    alter table public.sales
      add constraint sales_user_id_fkey foreign key (user_id) references public.users(id);
  end if;

  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'expenses_user_id_fkey'
      and n.nspname = 'public'
      and t.relname = 'expenses'
      and pg_get_constraintdef(c.oid) not like '%REFERENCES public.users(id)%'
  ) then
    alter table public.expenses drop constraint expenses_user_id_fkey;
    alter table public.expenses
      add constraint expenses_user_id_fkey foreign key (user_id) references public.users(id);
  end if;
end $$;

-- Seed the shared catalog so sale_items can satisfy product foreign keys.
insert into public.product_categories (id, name) values
  (1,'Meals'), (2,'Silog Meals'), (3,'Snacks'), (4,'Fries'),
  (5,'Fruit Soda Series'), (6,'Yakult Series'), (7,'Special Drinks'), (8,'Snack Combos')
on conflict (id) do nothing;

insert into public.products (id, category_id, name, price, options_json, is_active) values
  (1,1,'Chicken Pastil',55,null,true),(2,1,'Pork Tonkatsu',69,null,true),(3,1,'Fried Chicken',55,null,true),(4,1,'Pork Sisig (Regular)',59,null,true),(5,1,'Pork Sisig with Egg',69,null,true),
  (6,2,'Hotsilog',39,null,true),(7,2,'Lumpiasilog',39,null,true),(8,2,'Siomaisilog',39,null,true),(9,2,'Hamsilog',39,null,true),(10,2,'Porksilog',59,null,true),(11,2,'Tapsilog',69,null,true),
  (12,3,'Regular Burger',20,null,true),(13,3,'Cheese Burger',25,null,true),(14,3,'Burger With Egg',35,null,true),(15,3,'Hotdog Sandwich',25,null,true),(16,3,'Cheesy Hotdog Sandwich',35,null,true),
  (17,4,'Fries',30,'{"type":"fries","flavors":["Cheese","Sour Cream","Barbecue"]}',true),
  (18,5,'Fruit Soda',29,'{"type":"flavorSize","flavors":["Strawberry","Lychee","Green Apple","Lemon","Blueberry"],"sizes":[{"name":"12oz","price":29},{"name":"16oz","price":39}]}',true),
  (19,6,'Yakult Series',44,'{"type":"flavorSize","flavors":["Strawberry","Lychee","Green Apple","Lemon","Blueberry"],"sizes":[{"name":"12oz","price":44},{"name":"16oz","price":54}]}',true),
  (20,7,'Iced Coffee Latte',49,'{"type":"size","sizes":[{"name":"12oz","price":49},{"name":"16oz","price":59}]}',true),
  (21,7,'Matcha Latte',49,'{"type":"size","sizes":[{"name":"12oz","price":49},{"name":"16oz","price":59}]}',true),
  (22,7,'Lemonade',39,'{"type":"size","sizes":[{"name":"12oz","price":39},{"name":"16oz","price":49}]}',true),
  (23,7,'Oreo Matcha Latte',59,'{"type":"size","sizes":[{"name":"12oz","price":59},{"name":"16oz","price":69}]}',true),
  (24,8,'Combo A',45,'{"type":"combo","requires":["sodaFlavor"],"included":"Regular Burger + Fruit Soda","price":45}',true),
  (25,8,'Combo B',50,'{"type":"combo","requires":["sodaFlavor"],"included":"Hotdog Sandwich + Fruit Soda","price":50}',true),
  (26,8,'Combo C',55,'{"type":"combo","requires":["friesFlavor","sodaFlavor"],"included":"Fries + Fruit Soda","price":55}',true),
  (27,8,'Combo D',45,'{"type":"combo","requires":["friesFlavor"],"included":"Regular Burger + Fries","price":45}',true),
  (28,8,'Combo E',50,'{"type":"combo","requires":["friesFlavor"],"included":"Hotdog Sandwich + Fries","price":50}',true)
on conflict (id) do nothing;

insert into public.expense_categories (id, name) values
  (1,'Ingredients'), (2,'Supplies and Packaging'), (3,'Utilities'),
  (4,'Transportation'), (5,'Salaries'), (6,'Others')
on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.expense_categories enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
