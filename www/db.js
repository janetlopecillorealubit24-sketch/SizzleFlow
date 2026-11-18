// Local (offline) database using IndexedDB. Works without internet.
const DB_NAME = 'sizzleflow', DB_VER = 4;

const SEED = {
  categories:[
    {id:1,name:'Meals'},{id:2,name:'Silog Meals'},{id:3,name:'Snacks'},{id:4,name:'Fries'},
    {id:5,name:'Fruit Soda Series'},{id:6,name:'Yakult Series'},{id:7,name:'Special Drinks'},{id:8,name:'Snack Combos'}
  ],
  expCats:[[1,'Ingredients'],[2,'Supplies and Packaging'],[3,'Utilities'],[4,'Transportation'],[5,'Salaries'],[6,'Others']].map(c=>({id:c[0],name:c[1]})),
  products:[
    [1,1,'Chicken Pastil',55],[2,1,'Pork Tonkatsu',69],[3,1,'Fried Chicken',55],[4,1,'Pork Sisig (Regular)',59],[5,1,'Pork Sisig with Egg',69],
    [6,2,'Hotsilog',39],[7,2,'Lumpiasilog',39],[8,2,'Siomaisilog',39],[9,2,'Hamsilog',39],[10,2,'Porksilog',59],[11,2,'Tapsilog',69],
    [12,3,'Regular Burger',20],[13,3,'Cheese Burger',25],[14,3,'Burger With Egg',35],[15,3,'Hotdog Sandwich',25],[16,3,'Cheesy Hotdog Sandwich',35],
    [17,4,'Fries',30,{type:'fries',flavors:['Cheese','Sour Cream','Barbecue']}],
    [18,5,'Fruit Soda',29,{type:'flavorSize',flavors:['Strawberry','Lychee','Green Apple','Lemon','Blueberry'],sizes:[{name:'12oz',price:29},{name:'16oz',price:39}]}],
    [19,6,'Yakult Series',44,{type:'flavorSize',flavors:['Strawberry','Lychee','Green Apple','Lemon','Blueberry'],sizes:[{name:'12oz',price:44},{name:'16oz',price:54}]}],
    [20,7,'Iced Coffee Latte',49,{type:'size',sizes:[{name:'12oz',price:49},{name:'16oz',price:59}]}],
    [21,7,'Matcha Latte',49,{type:'size',sizes:[{name:'12oz',price:49},{name:'16oz',price:59}]}],
    [22,7,'Lemonade',39,{type:'size',sizes:[{name:'12oz',price:39},{name:'16oz',price:49}]}],
    [23,7,'Oreo Matcha Latte',59,{type:'size',sizes:[{name:'12oz',price:59},{name:'16oz',price:69}]}],
    [24,8,'Combo A',45,{type:'combo',requires:['sodaFlavor'],included:'Regular Burger + Fruit Soda',price:45}],
    [25,8,'Combo B',50,{type:'combo',requires:['sodaFlavor'],included:'Hotdog Sandwich + Fruit Soda',price:50}],
    [26,8,'Combo C',55,{type:'combo',requires:['friesFlavor','sodaFlavor'],included:'Fries + Fruit Soda',price:55}],
    [27,8,'Combo D',45,{type:'combo',requires:['friesFlavor'],included:'Regular Burger + Fries',price:45}],
    [28,8,'Combo E',50,{type:'combo',requires:['friesFlavor'],included:'Hotdog Sandwich + Fries',price:50}]
  ].map(p=>({id:p[0],category_id:p[1],name:p[2],price:p[3],options:p[4]||null,photo:'',is_active:1}))
};

let _db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      ['users','categories','products','sales','expenses','expense_categories'].forEach(n=>{
        if(!d.objectStoreNames.contains(n)) d.createObjectStore(n,{keyPath:'id'});
      });
      if (e.oldVersion < 4) {
        const users = e.target.transaction.objectStore('users');
        ['5a285dbb-7c3b-45c8-9250-fdd0552e53d0','7ee5f7bd-016f-4e07-8cef-992927fff97b','c10bdc6c-bdca-4af7-aae8-a9f5ffd39c67','a7aead31-9074-49c2-8600-f6e63290c3d2','0e1c3d25-1b50-4b96-813a-fa615697c304','07088ee6-3062-4660-bd3d-7e47f84eca2f','633ee170-9853-40d0-90fd-f40063612667', ...[1,2,3,4,5,6].map(n=>'staff-'+n)].forEach(id=>users.delete(id));
      }
    };
    r.onsuccess = async e => {
      _db = e.target.result;
      if ((await all('expense_categories')).length === 0)
        for (const c of SEED.expCats) await put('expense_categories',c);
      if ((await all('categories')).length === 0) {
        for (const c of SEED.categories) await put('categories',c);
        for (const p of SEED.products) await put('products',p);
      }
      resolve(_db);
    };
    r.onerror = () => reject(r.error);
  });
}
const store = (n,m='readonly') => _db.transaction(n,m).objectStore(n);
const wrap = req => new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
const all = n => wrap(store(n).getAll());
const del = (n,k) => wrap(store(n,'readwrite').delete(k));
const put = (n,v) => wrap(store(n,'readwrite').put(v));

async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
