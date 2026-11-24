// SizzleFlow PWA - full version: sales, expenses, history, reports, sync, printing.
const $ = s => document.querySelector(s);
const peso = n => '₱' + Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const plain = n => 'PHP ' + Number(n).toFixed(2);
const pad = n => String(n).padStart(2,'0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ymdhms = d => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'id-'+Date.now()+Math.random().toString(16).slice(2);
const esc = t => String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const initials = name => String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('') || '?';
const avatarHtml = (user, className='profile-avatar') => user?.profile_photo
  ? `<img class="${className} profile-avatar-image" src="${esc(user.profile_photo)}" alt="${esc(user.full_name || 'Profile')} profile picture">`
  : `<span class="${className}">${initials(user?.full_name)}</span>`;
const eyeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>';
const eyeOffIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-3.1 3.8M6.1 6.1C3.5 8.1 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8"/></svg>';
function bindPasswordToggles(){
  document.querySelectorAll('[data-password-toggle]').forEach(button => button.onclick = () => {
    const input = document.getElementById(button.dataset.passwordToggle), visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.innerHTML = visible ? eyeIcon : eyeOffIcon;
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
}
const isOwner = () => S.user && S.user.role === 'owner';

const S = { user:null, tab:'sale', saleView:'catalog', menuView:'products', menuCat:0, menuEdit:'', cat:0, cart:{}, customerName:'', pay:'Cash', products:[], cats:[], expCats:[],
  from:ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to:ymd(new Date()), hdate:ymd(new Date()) };
const OFFICIAL_CATALOG_VERSION = 'sip-sizzle-official-v1';
const GOOGLE_CLIENT_ID = '531466811982-a9llaigspe91paod25s9em9oi9uuk9e4.apps.googleusercontent.com';
const isNative = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

/* ---------- settings ---------- */
const cfg = {
  // Native builds must use the public HTTPS API configured in runtime-config.js.
  // Browser builds can continue using the local API when opened from XAMPP.
  get url(){ return localStorage.getItem('sf_url') || window.SIZZLEFLOW_API_URL || (isNative() ? '' : new URL('../api', location.href).href.replace(/\/+$/,'')); },
  set url(v){ localStorage.setItem('sf_url', v.replace(/\/+$/,'')); },
  get key(){ return localStorage.getItem('sf_key') || 'change-this-secret-key'; },
  set key(v){ localStorage.setItem('sf_key', v); },
  get printMode(){ return localStorage.getItem('sf_print') || (isNative() ? 'native' : 'browser'); },
  get printerAddr(){ return localStorage.getItem('sf_printer_addr') || ''; },
  set printerAddr(v){ localStorage.setItem('sf_printer_addr', v); },
  get printerName(){ return localStorage.getItem('sf_printer_name') || ''; },
  set printerName(v){ localStorage.setItem('sf_printer_name', v); },
  set printMode(v){ localStorage.setItem('sf_print', v); }
};
function deviceId(){
  let d = localStorage.getItem('sf_device');
  if (!d) { d = 'web-' + uuid().slice(0,8); localStorage.setItem('sf_device', d); }
  return d;
}

async function loadCatalog(){
  S.products = (await all('products')).filter(p=>+p.is_active).map(p=>{
    if(typeof p.options === 'string'){
      try { p.options = JSON.parse(p.options); } catch { p.options = null; }
    }
    return p;
  });
  S.cats = await all('categories');
  S.expCats = await all('expense_categories');
}
async function installOfficialCatalog(){
  if (localStorage.getItem('sf_catalog_version')===OFFICIAL_CATALOG_VERSION) return;
  for (const p of await all('products')) await del('products',p.id);
  for (const c of await all('categories')) await del('categories',c.id);
  for (const c of SEED.categories) await put('categories',c);
  for (const p of SEED.products) await put('products',p);
  localStorage.setItem('sf_catalog_version',OFFICIAL_CATALOG_VERSION);
}
async function init(){
  const splashStarted = performance.now();
  try {
    await openDB(); await installOfficialCatalog(); await loadCatalog();
    const saved = sessionStorage.getItem('sf_user');
    if (saved) { S.user = JSON.parse(saved); S.tab = 'dash'; }
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  } finally {
    const splash = document.querySelector('#splash-screen');
    if (splash) {
      const showTime = performance.now() - splashStarted;
      setTimeout(() => { splash.classList.add('is-hidden'); setTimeout(() => splash.remove(), 450); }, Math.max(0, 3000 - showTime));
    }
  }
}
function render(){ S.user ? renderMain() : renderLogin(); }

/* ---------- login ---------- */
function renderLogin(mode='login'){
  const signup = mode === 'signup';
  $('#app').innerHTML = `
  <div class="login-page"><div class="login card"><img class="login-logo" src="images/logo-transparent.png?v=2" alt="Sip &amp; Sizzle logo">
    <p class="muted auth-subtitle">${signup?'Create your SizzleFlow account':'SizzleFlow sales system'}</p>
    ${signup?'<input id="fullName" placeholder="Full name" autocomplete="name" autofocus>':''}
    <input id="u" type="email" placeholder="Email" autocapitalize="none" autocomplete="email" ${signup?'':'autofocus'}>
    <div class="password-field"><input id="p" type="password" placeholder="Password" autocomplete="${signup?'new-password':'current-password'}"><button class="password-toggle" type="button" data-password-toggle="p" aria-label="Show password">${eyeOffIcon}</button></div>
    ${signup?`<div class="password-field"><input id="pConfirm" type="password" placeholder="Confirm password" autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle="pConfirm" aria-label="Show confirm password">${eyeOffIcon}</button></div>`:''}
    <div class="err" id="err"></div><button class="btn" id="go">${signup?'Create account':'Log in'}</button>
    <div class="auth-divider"><span>or</span></div>
    <div id="googleButton" class="google-button-wrap"></div>
    <button class="auth-link" id="switchAuth" type="button">${signup?'Already have an account? Log in':'New here? Create an account'}</button>
  </div></div>`;
  const go = async () => {
    const email = $('#u').value.trim().toLowerCase(), password = $('#p').value;
    if (signup) {
      const fullName = $('#fullName').value.trim(), confirm = $('#pConfirm').value;
      if (!fullName || !email || !password) { $('#err').textContent = 'Please complete all fields.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#err').textContent = 'Please enter a valid email address.'; return; }
      if (password.length < 6) { $('#err').textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm) { $('#err').textContent = 'Passwords do not match.'; return; }
      const users = await all('users');
      if (users.some(x=>String(x.email||'').toLowerCase()===email)) { $('#err').textContent = 'That email is already registered.'; return; }
      const base = (email.split('@')[0].replace(/[^a-z0-9_-]/g,'').slice(0,42) || 'user');
      let username = base, n = 1;
      while (users.some(x=>String(x.username).toLowerCase()===username.toLowerCase())) username = `${base}${n++}`;
      const u = {id:uuid(),full_name:fullName,username,password_hash:await sha256(password),role:'staff',is_active:1,email,auth_provider:'password',created_at:ymdhms(new Date())};
      await put('users',u); S.user=u; S.tab='dash'; sessionStorage.setItem('sf_user',JSON.stringify(u)); render(); return;
    }
    const hash = await sha256(password), u = (await all('users')).find(x=>(String(x.email||'').toLowerCase()===email || String(x.username).toLowerCase()===email) && x.password_hash===hash && +x.is_active!==0);
    if (!u) { $('#err').textContent = 'Wrong username or password.'; return; }
    S.user = u; S.tab = 'dash'; sessionStorage.setItem('sf_user', JSON.stringify(u)); render();
  };
  $('#go').onclick = go; $('#p').onkeydown = e => { if (e.key==='Enter') go(); };
  $('#pConfirm')?.addEventListener('keydown', e => { if (e.key==='Enter') go(); });
  bindPasswordToggles();
  $('#switchAuth').onclick = () => renderLogin(signup?'login':'signup');
  setupGoogleAuth(signup);
}

function setupGoogleAuth(signup){
  const mount = $('#googleButton');
  if (!mount) return;
  if (isNative()) {
    mount.innerHTML = '<button class="btn alt" id="nativeGoogleButton" type="button" style="width:100%">Continue with Google</button>';
    $('#nativeGoogleButton').onclick = async () => {
      const button = $('#nativeGoogleButton');
      button.disabled = true; $('#err').textContent = 'Opening Google…';
      try {
        const socialLogin = window.Capacitor?.Plugins?.SocialLogin;
        if (!socialLogin) throw new Error('Google sign-in plugin is not available. Rebuild the Android app after syncing Capacitor.');
        await socialLogin.initialize({google:{webClientId:GOOGLE_CLIENT_ID,mode:'online',skipAuthOnlyAuthorizationAfterSignIn:true}});
        const result = await Promise.race([
          socialLogin.login({provider:'google'}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Google sign-in timed out. Check the Android OAuth client, package name, and SHA-1.')), 20000))
        ]);
        const credential = result?.result?.idToken;
        if (!credential) throw new Error('Google did not return an ID token.');
        await finishGoogleLogin(credential);
      } catch (e) {
        $('#err').textContent = /cancel/i.test(e.message||'') ? '' : (e.message || 'Google sign-in failed.');
        button.disabled = false;
      }
    };
    return;
  }
  const wait = () => {
    if (!window.google?.accounts?.id) { setTimeout(wait, 100); return; }
    google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID, callback:async response=>{
      $('#err').textContent = 'Signing in with Google…';
      try { await finishGoogleLogin(response.credential); }
      catch (e) { $('#err').textContent = e.message || 'Google sign-in failed.'; }
    }});
    google.accounts.id.renderButton(mount,{theme:'outline',size:'large',width:320,text:signup?'signup_with':'signin_with',shape:'rectangular'});
  };
  wait();
}

async function finishGoogleLogin(credential){
  if (!cfg.url) throw new Error('Google account selected, but no cloud server is configured. Set SIZZLEFLOW_API_URL in runtime-config.js and rebuild the app.');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(cfg.url+'/google_auth.php',{method:'POST',headers:hdrs(),body:JSON.stringify({credential}),signal:controller.signal});
    clearTimeout(timeout);
    const raw = await res.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(`Server returned invalid JSON (HTTP ${res.status}): ${raw.slice(0,160) || 'empty response'}`); }
    if (!res.ok || !data.user) throw new Error(data.error||'Google sign-in failed.');
    await put('users',data.user); S.user=data.user; S.tab='dash'; sessionStorage.setItem('sf_user',JSON.stringify(data.user)); render();
  } catch (e) {
    if (/Failed to fetch|NetworkError|Load failed|AbortError|aborted/i.test(e.message||'')) {
      throw new Error(cfg.url
        ? `Google account selected, but SizzleFlow could not reach its cloud server at ${cfg.url}. Check your internet connection or contact support.`
        : 'Google account selected, but SizzleFlow has no cloud server configured. Set SIZZLEFLOW_API_URL in runtime-config.js and rebuild the app.');
    }
    throw e;
  }
}

/* ---------- shell ---------- */
const TABS = [['dash','Dashboard'],['menu','Menu'],['sale','New Sale'],['hist','History'],['exp','Expenses']];
const NAV_ICONS = {
  dash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h7V3H3v10Zm11 8h7V3h-7v18ZM3 21h7v-4H3v4Zm11 0h7v-4h-7v4Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v3H4V5Zm0 5.5h16v3H4v-3ZM4 16h16v3H4v-3Z"/></svg>',
  sale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l1 4H6l1-4Zm-2 6h14l-1 12H6L5 9Zm4 3v6m4-6v6"/></svg>',
  hist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2m6-2a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>',
  exp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4V5Zm3 4h10M7 13h3m2 0h5m-10 3h3m2 0h5"/></svg>',
  rep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9m7 10V5m7 14v-7"/></svg>'
};
function renderMain(){
  $('#app').innerHTML = `
  <header class="app-header"><img class="brand-mark" src="images/logo-transparent.png?v=2" alt="Sip &amp; Sizzle"><div class="header-user"><button class="profile-trigger" id="profileToggle" aria-label="Open profile menu" aria-expanded="false">${avatarHtml(S.user)}</button><div class="profile-dropdown" id="profileDropdown"><div class="profile-summary"><b>${esc(S.user.full_name)}</b><span>${esc(S.user.username)} - ${esc(S.user.role)}</span></div><button class="profile-option" data-profile>Profile</button><button class="profile-option" data-settings>Settings</button><button class="profile-option logout-option" data-logout>Log out</button></div></div></header>
  <main id="view"></main>
  <nav class="bottom-nav" aria-label="Main navigation">${TABS.map(([k,l])=>`<button class="bottom-nav-item ${S.tab===k?'on':''}" data-t="${k}" aria-label="${l}" aria-current="${S.tab===k?'page':'false'}">${NAV_ICONS[k]}<span>${l==='New Sale'?'Sale':l}</span></button>`).join('')}</nav>`;
  document.querySelectorAll('.bottom-nav-item').forEach(b=>b.onclick=()=>{S.tab=b.dataset.t; renderMain();});
  ({sale:renderSale,menu:renderMenu,dash:renderDash,hist:renderHist,exp:renderExp,rep:renderRep,set:renderSet,profile:renderProfile})[S.tab]();
  const profileToggle = $('#profileToggle'), profileDropdown = $('#profileDropdown');
  profileToggle.onclick = e => { e.stopPropagation(); const open = profileDropdown.classList.toggle('open'); profileToggle.setAttribute('aria-expanded', String(open)); };
  $('#profileDropdown').onclick = e => e.stopPropagation();
  document.addEventListener('click', () => { profileDropdown.classList.remove('open'); profileToggle.setAttribute('aria-expanded','false'); }, {once:true});
  $('[data-profile]').onclick = () => { S.tab='profile'; renderMain(); };
  $('[data-settings]').onclick = () => { S.tab='set'; renderMain(); };
  $('[data-logout]').onclick = () => { S.user=null; S.cart={}; sessionStorage.removeItem('sf_user'); render(); };
}

function renderProfile(){
  const googleAccount = S.user.auth_provider === 'google';
  $('#view').innerHTML = `<div class="card profile-card"><h3 style="margin-top:0">Profile</h3><div class="profile-picture-wrap"><button type="button" class="profile-picture-trigger" id="profilePictureTrigger" aria-label="${S.user.profile_photo?'Manage':'Add'} profile picture">${avatarHtml(S.user,'profile-page-avatar')}</button><input id="profilePhoto" type="file" accept="image/*" hidden></div><form id="profileForm" class="profile-form"><label>Full name<input id="profileName" value="${esc(S.user.full_name||'')}" required></label><label>Username<input value="${esc(S.user.username||'')}" readonly></label><label>Email<input id="profileEmail" type="email" value="${esc(S.user.email||'')}" placeholder="you@example.com"></label><div class="profile-form-actions"><button class="btn" type="submit">Save profile</button><button class="btn alt" type="button" id="profileBack">Back</button></div></form><hr><section class="password-change"><button class="btn alt" type="button" id="changePasswordButton">Change password</button><div id="passwordPanel" hidden>${googleAccount?'<p class="muted">This account uses Google sign-in. Change your password through Google.</p>':`<h4>Change password</h4><form id="passwordForm"><div class="password-field"><input id="currentPassword" type="password" placeholder="Current password" autocomplete="current-password"><button class="password-toggle" type="button" data-password-toggle="currentPassword" aria-label="Show current password">${eyeOffIcon}</button></div><div class="password-field"><input id="newPassword" type="password" placeholder="New password" autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle="newPassword" aria-label="Show new password">${eyeOffIcon}</button></div><div class="password-field"><input id="confirmNewPassword" type="password" placeholder="Confirm new password" autocomplete="new-password"><button class="password-toggle" type="button" data-password-toggle="confirmNewPassword" aria-label="Show confirm new password">${eyeOffIcon}</button></div><div class="err" id="passwordErr"></div><button class="btn" type="submit">Update password</button></form>`}</div></section></div>`;
  const photoInput=$('#profilePhoto'), savePhoto=async file=>{if(!file)return; S.user={...S.user,profile_photo:await readPhoto(file),updated_at:ymdhms(new Date())}; await put('users',S.user); sessionStorage.setItem('sf_user',JSON.stringify(S.user)); renderProfile();};
  const showPhotoPopup=()=>{const modal=document.createElement('div'); modal.className='photo-modal-backdrop'; modal.innerHTML=`<div class="photo-modal"><h3>Profile picture</h3><button class="profile-option" data-photo-view>View</button><button class="profile-option" data-photo-change>Change</button><button class="profile-option logout-option" data-photo-delete>Delete</button><button class="btn alt" data-photo-cancel>Cancel</button></div>`; document.body.appendChild(modal); modal.querySelector('[data-photo-cancel]').onclick=()=>modal.remove(); modal.querySelector('[data-photo-view]').onclick=()=>{modal.innerHTML=`<div class="photo-modal photo-view-modal"><img src="${esc(S.user.profile_photo)}" alt="Profile picture"><button class="btn alt" data-photo-close>Close</button></div>`; modal.querySelector('[data-photo-close]').onclick=()=>modal.remove();}; modal.querySelector('[data-photo-change]').onclick=()=>{modal.remove();photoInput.click();}; modal.querySelector('[data-photo-delete]').onclick=async()=>{S.user={...S.user,profile_photo:'',updated_at:ymdhms(new Date())};await put('users',S.user);sessionStorage.setItem('sf_user',JSON.stringify(S.user));modal.remove();renderProfile();};};
  $('#profilePictureTrigger').onclick=()=>S.user.profile_photo?showPhotoPopup():photoInput.click(); photoInput.onchange=()=>savePhoto(photoInput.files[0]);
  $('#profileForm').onsubmit = async e => { e.preventDefault(); const photo = await readPhoto(photoInput.files[0]); S.user={...S.user,full_name:$('#profileName').value.trim(),email:$('#profileEmail').value.trim(),profile_photo:photo||S.user.profile_photo||'',updated_at:ymdhms(new Date())}; await put('users',S.user); sessionStorage.setItem('sf_user',JSON.stringify(S.user)); S.tab='profile'; renderMain(); };
  $('#changePasswordButton').onclick = () => { $('#passwordPanel').hidden=false; $('#changePasswordButton').hidden=true; $('#currentPassword')?.focus(); };
  bindPasswordToggles();
  if (!googleAccount) $('#passwordForm').onsubmit = async e => { e.preventDefault(); const current=$('#currentPassword').value, next=$('#newPassword').value, confirm=$('#confirmNewPassword').value, error=$('#passwordErr'); if (!current || !next || !confirm) { error.textContent='Please complete all password fields.'; return; } if (next.length < 6) { error.textContent='New password must be at least 6 characters.'; return; } if (next !== confirm) { error.textContent='New passwords do not match.'; return; } if (await sha256(current) !== S.user.password_hash) { error.textContent='Current password is incorrect.'; return; } S.user={...S.user,password_hash:await sha256(next),updated_at:ymdhms(new Date())}; await put('users',S.user); sessionStorage.setItem('sf_user',JSON.stringify(S.user)); error.className='success'; error.textContent='Password updated successfully.'; $('#passwordForm').reset(); };
  $('#profileBack').onclick = () => { S.tab='dash'; renderMain(); };
}

/* ---------- menu management ---------- */
function menuPhoto(p){ return p.photo ? `<img class="prod-photo" src="${p.photo}" alt="">` : '<div class="prod-photo empty-photo">No photo</div>'; }
function readPhoto(file){ return new Promise((resolve,reject)=>{ if(!file){resolve('');return;} const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
async function renderMenuLegacy(){
  const editId = S.menuEdit || '';
  const edit = editId ? S.products.find(p=>String(p.id)===String(editId)) : null;
  $('#view').innerHTML = `<div class="card"><h3 style="margin-top:0">Create a Menu</h3><p class="muted">Create categories first, then add multiple products to each category with a name, price, and picture. Saved products will appear in the menu list and New Sale screen.</p>
    <form id="menuForm"><input type="hidden" id="pid" value="${edit?esc(edit.id):''}">
    <select id="pcat" required>${S.cats.map(c=>`<option value="${c.id}" ${edit&&edit.category_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
    <input id="pname" placeholder="Menu item name" value="${edit?esc(edit.name):''}" required>
    <input id="pprice" type="number" min="0.01" step="0.01" placeholder="Price" value="${edit?edit.price:''}" required>
    <input id="pphoto" type="file" accept="image/*"><div class="muted">Photo is stored on this device and synced with the menu.</div>
    ${edit?`<div class="photo-preview">${menuPhoto(edit)}</div>`:''}<button class="btn" type="submit">${edit?'Update menu item':'Add menu item'}</button>${edit?'<button class="btn alt" type="button" id="cancelEdit">Cancel</button>':''}</form></div>
    <div class="card"><h3 style="margin-top:0">Categories</h3><form id="catForm" class="inline-form"><input id="catName" placeholder="New category name" required><button class="btn" type="submit">Add category</button></form><div class="category-list">${S.cats.map(c=>`<span class="category-chip"><span class="chip">${esc(c.name)}</span><button class="category-delete" data-cat-delete="${c.id}" aria-label="Delete ${esc(c.name)}">×</button></span>`).join('')}</div></div>
    <div class="card"><h3 style="margin-top:0">Products</h3>${S.products.map(p=>`<div class="menu-item"><div class="menu-item-info">${menuPhoto(p)}<div><b>${esc(p.name)}</b><div class="muted">${esc((S.cats.find(c=>c.id==p.category_id)||{}).name||'Uncategorized')} · ${peso(p.price)}</div></div></div><div><button class="chip" data-edit="${p.id}">Edit</button> <button class="chip danger" data-delete="${p.id}">Delete</button></div></div>`).join('')||'<p class="muted">No menu items yet.</p>'}</div>`;
  $('#menuForm').onsubmit = async e => { e.preventDefault(); const name=$('#pname').value.trim(), price=Number($('#pprice').value); if(!name||!(price>0)) return;
    const photo=await readPhoto($('#pphoto').files[0]); const id=$('#pid').value; const old=id&&S.products.find(p=>String(p.id)===id); await put('products',{id:id?Number(id):Date.now(),category_id:Number($('#pcat').value),name,price,options:old?.options||null,photo:photo||old?.photo||'',is_active:1,sync_status:'pending',updated_at:ymdhms(new Date())}); S.menuEdit=''; await loadCatalog(); renderMenu();
  };
  $('#catForm').onsubmit = async e => { e.preventDefault(); const name=$('#catName').value.trim(); if(!name)return; const id=Date.now(); await put('categories',{id,name,sync_status:'pending',updated_at:ymdhms(new Date())}); S.menuEdit=''; await loadCatalog(); renderMenu(); };
  document.querySelectorAll('[data-cat-delete]').forEach(b=>b.onclick=async()=>{
    const id=Number(b.dataset.catDelete), category=S.cats.find(c=>Number(c.id)===id);
    const products=S.products.filter(p=>Number(p.category_id)===id);
    const categoryName = category?.name || 'this category';
    const message = products.length
      ? `There are ${products.length} product(s) inside "${categoryName}". Are you sure you want to delete this category?\n\nThis will also delete all products inside it.`
      : `There are no products inside "${categoryName}". Are you sure you want to delete this category?`;
    if (!confirm(message)) return;
    for (const product of products) {
      product.is_active=0; product.sync_status='pending'; product.updated_at=ymdhms(new Date());
      await put('products',product);
    }
    await del('categories',id); await loadCatalog(); renderMenu();
  });
  if($('#cancelEdit')) $('#cancelEdit').onclick=()=>{S.menuEdit='';renderMenu();};
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{S.menuEdit=b.dataset.edit;renderMenu();});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{ if(!confirm('Remove this menu item?'))return; const p=S.products.find(x=>String(x.id)===b.dataset.delete); p.is_active=0;p.sync_status='pending';p.updated_at=ymdhms(new Date());await put('products',p);await loadCatalog();renderMenu(); });
}

// Mobile menu management: use focused Products and Categories screens.
async function renderMenu(){
  const editId = S.menuEdit || '';
  const edit = editId ? S.products.find(p=>String(p.id)===String(editId)) : null;
  if (edit) S.menuView='products';
  const productList = S.products.filter(p=>!S.menuCat || Number(p.category_id)===Number(S.menuCat));
  const tabs = `<div class="menu-tabs"><button class="menu-tab ${S.menuView==='products'?'on':''}" data-menu-tab="products">Products</button><button class="menu-tab ${S.menuView==='categories'?'on':''}" data-menu-tab="categories">Categories</button></div>`;
  let content = '';
  if (edit || S.menuEdit === 'new') {
    content = `<div class="card menu-form-card"><button class="back-link" id="cancelMenuForm">‹ Back to products</button><h2 style="margin:0 0 4px">${edit?'Edit product':'Add product'}</h2><p class="muted">Add the item details shown to staff during a sale.</p>
      <form id="menuForm"><input type="hidden" id="pid" value="${edit?esc(edit.id):''}">
      <select id="pcat" required>${S.cats.map(c=>`<option value="${c.id}" ${edit&&edit.category_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
      <input id="pname" placeholder="Menu item name" value="${edit?esc(edit.name):''}" required>
      <input id="pprice" type="number" min="0.01" step="0.01" placeholder="Price" value="${edit?edit.price:''}" required>
      <input id="pphoto" type="file" accept="image/*"><div class="muted">Photo is stored on this device and synced with the menu.</div>
      ${edit?`<div class="photo-preview">${menuPhoto(edit)}</div>`:''}<button class="btn" type="submit">${edit?'Update menu item':'Save product'}</button></form></div>`;
  } else if (S.menuView === 'categories') {
    content = `<div class="card"><h2 style="margin:0 0 4px">Categories</h2><p class="muted">Group products so they are easier to find during a sale.</p><form id="catForm" class="inline-form"><input id="catName" placeholder="New category name" required><button class="btn" type="submit">Add</button></form><div class="menu-category-list">${S.cats.map(c=>`<div class="menu-category-row"><span>${esc(c.name)}</span><button class="category-delete" data-cat-delete="${c.id}" aria-label="Delete ${esc(c.name)}">×</button></div>`).join('')||'<p class="muted">No categories yet.</p>'}</div></div>`;
  } else {
    content = `<div class="menu-toolbar"><div><h2>Products</h2><p class="muted">${S.products.length} menu item(s)</p></div><button class="btn" id="addMenuProduct">Add product</button></div>
      <div class="chips menu-filter"><button class="chip ${!S.menuCat?'on':''}" data-menu-cat="0">All</button>${S.cats.map(c=>`<button class="chip ${S.menuCat===c.id?'on':''}" data-menu-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="menu-product-list">${productList.map(p=>`<div class="menu-product-row"><div><b>${esc(p.name)}</b><div class="muted">${esc((S.cats.find(c=>c.id==p.category_id)||{}).name||'Uncategorized')} · ${peso(p.price)}</div></div><div class="menu-row-actions"><button class="chip" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}">Edit</button><button class="chip danger" data-delete="${p.id}" aria-label="Delete ${esc(p.name)}">Delete</button></div></div>`).join('')||'<div class="card"><p class="muted">No menu items in this category.</p></div>'}</div>`;
  }
  $('#view').innerHTML = `<div class="menu-page"><div class="sale-heading"><div><h2>Menu</h2><p class="muted">Manage products and categories.</p></div></div>${tabs}${content}</div>`;
  document.querySelectorAll('[data-menu-tab]').forEach(b=>b.onclick=()=>{S.menuView=b.dataset.menuTab;S.menuEdit='';renderMenu();});
  document.querySelectorAll('[data-menu-cat]').forEach(b=>b.onclick=()=>{S.menuCat=+b.dataset.menuCat;renderMenu();});
  if ($('#addMenuProduct')) $('#addMenuProduct').onclick=()=>{S.menuEdit='new';renderMenu();};
  if ($('#cancelMenuForm')) $('#cancelMenuForm').onclick=()=>{S.menuEdit='';renderMenu();};
  if ($('#menuForm')) $('#menuForm').onsubmit=async e=>{e.preventDefault();const name=$('#pname').value.trim(),price=Number($('#pprice').value);if(!name||!(price>0)||!S.cats.length)return;const photo=await readPhoto($('#pphoto').files[0]),id=$('#pid').value,old=id&&S.products.find(p=>String(p.id)===id);await put('products',{id:id?Number(id):Date.now(),category_id:Number($('#pcat').value),name,price,options:old?.options||null,photo:photo||old?.photo||'',is_active:1,sync_status:'pending',updated_at:ymdhms(new Date())});S.menuEdit='';await loadCatalog();renderMenu();};
  if ($('#catForm')) $('#catForm').onsubmit=async e=>{e.preventDefault();const name=$('#catName').value.trim();if(!name)return;await put('categories',{id:Date.now(),name,sync_status:'pending',updated_at:ymdhms(new Date())});await loadCatalog();renderMenu();};
  document.querySelectorAll('[data-cat-delete]').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.catDelete),category=S.cats.find(c=>Number(c.id)===id),products=S.products.filter(p=>Number(p.category_id)===id),categoryName=category?.name||'this category';const message=products.length?`There are ${products.length} product(s) inside "${categoryName}". Are you sure you want to delete this category?\n\nThis will also delete all products inside it.`:`There are no products inside "${categoryName}". Are you sure you want to delete this category?`;if(!confirm(message))return;for(const product of products){product.is_active=0;product.sync_status='pending';product.updated_at=ymdhms(new Date());await put('products',product);}await del('categories',id);await loadCatalog();renderMenu();});
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{S.menuEdit=b.dataset.edit;renderMenu();});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this menu item?'))return;const p=S.products.find(x=>String(x.id)===b.dataset.delete);p.is_active=0;p.sync_status='pending';p.updated_at=ymdhms(new Date());await put('products',p);await loadCatalog();renderMenu();});
}

/* ---------- new sale ---------- */
const FLAVORS = ['Strawberry','Lychee','Green Apple','Lemon','Blueberry'];
const FRIES_FLAVORS = ['Cheese','Sour Cream','Barbecue'];
const cartTotal = () => Object.values(S.cart).reduce((t,line)=>t+line.quantity*line.unit_price,0);
const optionText = options => Object.values(options||{}).filter(Boolean).join(' · ');
const lineName = line => `${line.name}${optionText(line.options)?' – '+optionText(line.options):''}`;
function productPrice(p, size){ return p.options?.sizes?.find(s=>s.name===size)?.price ?? Number(p.price); }
const comboLineName = line => [line.name, line.included, optionText(line.options)].filter(Boolean).join(' - ');
function variationForm(p){
  const o=p.options||{};
  if(!o.type) return '';
  const soda = `<label>Fruit Soda flavor<select id="vSoda"><option value="">Select flavor</option>${FLAVORS.map(f=>`<option>${f}</option>`).join('')}</select></label>`;
  const friesFlavors = Array.isArray(o.flavors) && o.flavors.length ? o.flavors : FRIES_FLAVORS;
  const fries = `<label>Fries flavor<select id="vFries"><option value="">Select flavor</option>${friesFlavors.map(f=>`<option>${esc(f)}</option>`).join('')}</select></label>`;
  const size = Array.isArray(o.sizes) ? `<label>Size<select id="vSize"><option value="">Select size</option>${o.sizes.map(s=>`<option value="${esc(s.name)}">${esc(s.name)} – ${peso(s.price)}</option>`).join('')}</select></label>` : '';
  if(o.type==='fries') return fries;
  if(o.type==='flavorSize') return soda+size;
  if(o.type==='size') return size;
  if(o.type==='combo') return `${o.requires.includes('sodaFlavor')?soda:''}${o.requires.includes('friesFlavor')?fries:''}`;
  return '';
}
function addProductToCart(p, options={}){
  const key = `${p.id}|${Object.entries(options).sort().map(x=>x.join('=')).join('|')}`;
  if(!S.cart[key]) S.cart[key]={key,product_id:p.id,name:p.name,category_id:p.category_id,
    included:p.options?.type==='combo' ? (p.options.included||'') : '', options,
    unit_price:options.size?productPrice(p,options.size):Number(p.price),quantity:0};
  S.cart[key].quantity++;
  renderSale();
}
function chooseProduct(p){
  if(!p.options?.type){ addProductToCart(p); return; }
  const form=variationForm(p);
  const modal=document.createElement('div'); modal.className='variation-backdrop';
  modal.innerHTML=`<div class="variation-modal"><h3>${esc(p.name)}</h3><div class="muted">Choose the required options</div><div class="variation-fields">${form}</div><div class="variation-actions"><button class="btn alt" id="cancelVariation">Cancel</button><button class="btn" id="addVariation">Add to order</button></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector('#cancelVariation').onclick=()=>modal.remove();
  modal.querySelector('#addVariation').onclick=()=>{
    const o={}; const soda=modal.querySelector('#vSoda'), fries=modal.querySelector('#vFries'), size=modal.querySelector('#vSize');
    if(soda){if(!soda.value){alert('Please select a Fruit Soda flavor.');return;}o.sodaFlavor=soda.value;}
    if(fries){if(!fries.value){alert('Please select a Fries flavor.');return;}o.friesFlavor=fries.value;}
    if(size){if(!size.value){alert('Please select a size.');return;}o.size=size.value;}
    modal.remove(); addProductToCart(p,o);
  };
}
function renderSaleLegacy(){
  const list = S.products.filter(p=>!S.cat || p.category_id===S.cat);
  const lines = Object.values(S.cart).map(line=>`<div class="row sale-line"><div>${esc(comboLineName(line))}<div class="muted">${peso(line.unit_price)} each</div></div>
      <div class="qty"><button data-m="${line.key}">−</button> ${line.quantity} <button data-a="${line.key}">+</button></div><b>${peso(line.quantity*line.unit_price)}</b></div>`).join('') || '<p class="muted">Tap an item to add it.</p>';
  $('#view').innerHTML = `<div class="chips"><button class="chip ${!S.cat?'on':''}" data-c="0">All</button>
    ${S.cats.map(c=>`<button class="chip ${S.cat===c.id?'on':''}" data-c="${c.id}">${esc(c.name)}</button>`).join('')}</div>
  <div class="grid">${list.map(p=>`<button class="prod" data-product="${p.id}">${p.photo?`<img class="prod-photo" src="${p.photo}" alt="">`:''}<b>${esc(p.name)}</b><span>${p.options?.sizes?`${peso(p.options.sizes[0].price)} – ${peso(p.options.sizes.at(-1).price)}`:peso(p.price)}</span></button>`).join('')}</div>
  <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Order</h3><input id="customerName" placeholder="Customer name (optional)" value="${esc(S.customerName)}">${lines}
    <div class="total"><span>Total</span><span>${peso(cartTotal())}</span></div>
    <div class="pay">${['Cash','GCash'].map(m=>`<button class="btn ${S.pay===m?'':'alt'}" data-p="${m}">${m}</button>`).join('')}</div>
    <button class="btn" id="done" style="margin-top:8px" ${cartTotal()?'':'disabled'}>Complete sale &amp; print receipt</button>
    <button class="btn alt" id="clear" style="margin-top:6px">Clear order</button></div>`;
  const v = $('#view');
  v.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{S.cat=+b.dataset.c;renderSale();});
  v.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>chooseProduct(S.products.find(p=>p.id==b.dataset.product)));
  v.querySelectorAll('[data-m]').forEach(b=>{b.onclick=()=>{const line=S.cart[b.dataset.m];if(--line.quantity<=0)delete S.cart[b.dataset.m];renderSale();};});
  v.querySelectorAll('[data-a]').forEach(b=>{b.onclick=()=>{S.cart[b.dataset.a].quantity++;renderSale();};});
  v.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.pay=b.dataset.p;renderSale();});
  $('#customerName').oninput = e => { S.customerName=e.target.value; };
  $('#clear').onclick = () => { S.cart={}; S.customerName=''; renderSale(); };
  $('#done').onclick = completeSale;
}
// Mobile sale layout: keep product browsing and checkout on separate screens.
function renderSale(){
  const list = S.products.filter(p=>!S.cat || p.category_id===S.cat);
  const lines = Object.values(S.cart).map(line=>`<div class="row sale-line"><div>${esc(comboLineName(line))}<div class="muted">${peso(line.unit_price)} each</div></div>
    <div class="qty"><button data-m="${line.key}">-</button> ${line.quantity} <button data-a="${line.key}">+</button></div><b>${peso(line.quantity*line.unit_price)}</b></div>`).join('') || '<p class="muted">Tap an item to add it.</p>';
  if (S.saleView === 'order') {
    $('#view').innerHTML = `<div class="sale-order-page"><button class="back-link" id="backToSale">‹ Back to menu</button><div class="card"><h2 style="margin:0 0 4px">Your order</h2><p class="muted" style="margin-top:0">Review the items before completing the sale.</p>${lines}
      <div class="total"><span>Total</span><span>${peso(cartTotal())}</span></div>
      <label class="field-label">Customer name (optional)<input id="customerName" placeholder="Customer name" value="${esc(S.customerName)}"></label>
      <div class="payment-heading">Payment method</div><div class="pay">${['Cash','GCash'].map(m=>`<button class="btn ${S.pay===m?'':'alt'}" data-p="${m}">${m}</button>`).join('')}</div>
      <button class="btn" id="done" style="margin-top:12px" ${cartTotal()?'':'disabled'}>Complete sale &amp; print receipt</button>
      <button class="btn alt" id="clear" style="margin-top:6px">Clear order</button></div></div>`;
  } else {
    $('#view').innerHTML = `<div class="sale-catalog"><div class="sale-heading"><div><h2>New sale</h2><p class="muted">Tap a product to add it to the order.</p></div></div>
      <div class="chips"><button class="chip ${!S.cat?'on':''}" data-c="0">All</button>
        ${S.cats.map(c=>`<button class="chip ${S.cat===c.id?'on':''}" data-c="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="grid">${list.map(p=>`<button class="prod" data-product="${p.id}">${p.photo?`<img class="prod-photo" src="${p.photo}" alt="">`:''}<b>${esc(p.name)}</b><span>${p.options?.sizes?`${peso(p.options.sizes[0].price)} - ${peso(p.options.sizes.at(-1).price)}`:peso(p.price)}</span></button>`).join('')}</div>
      ${Object.keys(S.cart).length ? `<div class="cart-summary-bar"><div><b>${Object.values(S.cart).reduce((n,line)=>n+line.quantity,0)} item(s)</b><span>${peso(cartTotal())}</span></div><button class="btn" id="viewOrder">View order</button></div>` : '<div class="empty-cart-hint">Your order is empty. Tap a product to begin.</div>'}</div>`;
  }
  const v = $('#view');
  v.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{S.cat=+b.dataset.c;renderSale();});
  v.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>chooseProduct(S.products.find(p=>p.id==b.dataset.product)));
  v.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const line=S.cart[b.dataset.m];if(--line.quantity<=0)delete S.cart[b.dataset.m];renderSale();});
  v.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{S.cart[b.dataset.a].quantity++;renderSale();});
  v.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.pay=b.dataset.p;renderSale();});
  if ($('#viewOrder')) $('#viewOrder').onclick=()=>{S.saleView='order';renderSale();};
  if ($('#backToSale')) $('#backToSale').onclick=()=>{S.saleView='catalog';renderSale();};
  if ($('#customerName')) $('#customerName').oninput=e=>{S.customerName=e.target.value;};
  if ($('#clear')) $('#clear').onclick=()=>{S.cart={};S.customerName='';S.saleView='catalog';renderSale();};
  if ($('#done')) $('#done').onclick=completeSale;
}

async function nextReceiptNo(){
  const prefix = 'SS-' + ymd(new Date()).replace(/-/g,'') + '-';
  return prefix + String((await all('sales')).filter(s=>s.receipt_no.startsWith(prefix)).length + 1).padStart(3,'0');
}
async function completeSale(){
  const now = new Date(), id = uuid();
  const items = Object.values(S.cart).map(line=>({id:uuid(),sale_id:id,product_id:line.product_id,name:comboLineName(line),category_id:line.category_id,options:line.options,quantity:line.quantity,unit_price:line.unit_price,subtotal:line.quantity*line.unit_price}));
  const sale = {id, receipt_no:await nextReceiptNo(), user_id:S.user.id, cashier:S.user.full_name, customer_name:S.customerName.trim(), device_id:deviceId(),
    payment_method:S.pay, total_amount:cartTotal(), sale_date:ymdhms(now), sync_status:'pending', is_deleted:0, updated_at:ymdhms(now), items};
  await put('sales', sale); S.cart = {}; S.customerName=''; S.saleView='catalog'; renderSale();
  await printReceipt(sale);
}

/* ---------- data helpers ---------- */
const liveSales = async (from,to) => (await all('sales')).filter(s=>!+s.is_deleted && s.sale_date.slice(0,10)>=from && s.sale_date.slice(0,10)<=to);
const liveExp = async (from,to) => (await all('expenses')).filter(e=>!+e.is_deleted && e.expense_date>=from && e.expense_date<=to);
const sum = (a,k) => a.reduce((t,x)=>t+Number(x[k]),0);
function topItems(sales){
  const m = {}; sales.forEach(s=>(s.items||[]).forEach(i=>{ m[i.name]=m[i.name]||{q:0,t:0}; m[i.name].q+=i.quantity; m[i.name].t+=i.subtotal; }));
  return Object.entries(m).sort((a,b)=>b[1].t-a[1].t);
}
const stat = (l,v) => `<div class="card" style="flex:1;min-width:140px"><div class="muted">${l}</div><div class="total" style="margin:4px 0"><span>${v}</span></div></div>`;

function dashboardTrendChart(sales, expenses, now){
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-(6-i)); return {key:ymd(d),label:d.toLocaleDateString('en-US',{weekday:'short'}),sales:0,expenses:0}; });
  sales.forEach(s=>{const d=days.find(x=>x.key===s.sale_date.slice(0,10));if(d)d.sales+=Number(s.total_amount);});
  expenses.forEach(e=>{const d=days.find(x=>x.key===e.expense_date);if(d)d.expenses+=Number(e.amount);});
  const max=Math.max(1,...days.flatMap(d=>[d.sales,d.expenses])), w=700, h=250, left=42, bottom=38, top=18, plotH=h-top-bottom, groupW=(w-left-10)/days.length;
  const y=v=>top+plotH-(v/max)*plotH;
  const grid=[0,.25,.5,.75,1].map(p=>{const yy=top+plotH-p*plotH;return `<line x1="${left}" y1="${yy}" x2="${w-8}" y2="${yy}" class="chart-grid-line"/><text x="${left-7}" y="${yy+4}" text-anchor="end" class="chart-axis-label">${peso(max*p).replace('â‚±','')}</text>`;}).join('');
  const bars=days.map((d,i)=>{const x=left+i*groupW+groupW*.22,bw=Math.min(22,groupW*.24);return `<g><title>${d.key}: Sales ${peso(d.sales)}, Expenses ${peso(d.expenses)}</title><rect x="${x}" y="${y(d.sales)}" width="${bw}" height="${top+plotH-y(d.sales)}" rx="3" class="chart-bar sales-bar"/><rect x="${x+bw+4}" y="${y(d.expenses)}" width="${bw}" height="${top+plotH-y(d.expenses)}" rx="3" class="chart-bar expense-bar"/><text x="${left+i*groupW+groupW/2}" y="${h-14}" text-anchor="middle" class="chart-axis-label">${d.label}</text></g>`;}).join('');
  return `<div class="chart-wrap"><div class="chart-legend"><span><i class="legend-dot sales-dot"></i>Sales</span><span><i class="legend-dot expense-dot"></i>Expenses</span></div><svg class="dashboard-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Sales and expenses for the last seven days">${grid}${bars}</svg></div>`;
}

function topItemsChart(sales){
  const items=topItems(sales).slice(0,5), max=Math.max(1,...items.map(([,v])=>v.t));
  return items.length ? `<div class="top-chart">${items.map(([name,v])=>`<div class="top-chart-row"><div class="top-chart-label" title="${esc(name)}"><span>${esc(name)}</span><b>${peso(v.t)}</b></div><div class="top-chart-track"><span style="width:${Math.max(4,(v.t/max)*100)}%"></span></div></div>`).join('')}</div>` : '<p class="muted">No sales yet.</p>';
}

/* ---------- dashboard ---------- */
async function renderDash(){
  const now = new Date(), t = ymd(now), mStart = ymd(new Date(now.getFullYear(),now.getMonth(),1)), trendStartDate = new Date(now);
  trendStartDate.setDate(trendStartDate.getDate()-6);
  const trendStart = ymd(trendStartDate), ts = await liveSales(t,t), te = await liveExp(t,t), ms = await liveSales(mStart,t), me = await liveExp(mStart,t), trendSales = await liveSales(trendStart,t), trendExpenses = await liveExp(trendStart,t);
  const cash = sum(ts.filter(s=>s.payment_method==='Cash'),'total_amount'), gc = sum(ts.filter(s=>s.payment_method==='GCash'),'total_amount');
  $('#view').innerHTML = `<h3>Today</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
    ${stat('Sales',peso(sum(ts,'total_amount')))}${stat('Expenses',peso(sum(te,'amount')))}${stat('Net',peso(sum(ts,'total_amount')-sum(te,'amount')))}</div>
    <div class="card muted">${ts.length} orders · Cash ${peso(cash)} · GCash ${peso(gc)}</div>
    <h3>This month</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
    ${stat('Sales',peso(sum(ms,'total_amount')))}${stat('Expenses',peso(sum(me,'amount')))}${stat('Net',peso(sum(ms,'total_amount')-sum(me,'amount')))}</div>
    <div class="card"><b>Best sellers (month)</b>${topItems(ms).slice(0,5).map(([n,v])=>`<div class="row"><span>${esc(n)}</span><span>${v.q} pcs · ${peso(v.t)}</span></div>`).join('')||'<p class="muted">No sales yet.</p>'}</div>
    <div class="card dashboard-chart-card"><div class="chart-heading"><b>Sales vs expenses</b><span class="muted">Last 7 days</span></div>${dashboardTrendChart(trendSales,trendExpenses,now)}</div>
    <div class="card dashboard-chart-card"><div class="chart-heading"><b>Top products</b><span class="muted">This month</span></div>${topItemsChart(ms)}</div>
    <div class="card muted" id="pend"></div>`;
  const ps = (await all('sales')).filter(s=>s.sync_status==='pending').length, pe = (await all('expenses')).filter(e=>e.sync_status==='pending').length;
  $('#pend').textContent = ps+pe ? `${ps} sale(s) and ${pe} expense(s) waiting to sync. Go to Settings > Sync now.` : 'Everything is synced.';
}

/* ---------- history ---------- */
async function renderHist(){
  const sales = (await liveSales(S.hdate,S.hdate)).sort((a,b)=>b.sale_date.localeCompare(a.sale_date));
  $('#view').innerHTML = `<div class="card"><input type="date" id="hd" value="${S.hdate}">
    <div class="total"><span>${sales.length} sale(s)</span><span>${peso(sum(sales,'total_amount'))}</span></div></div>
    <div class="card">${sales.map(s=>`<div class="row"><div><b>${esc(s.receipt_no)}</b>
      <div class="muted">${s.sale_date.slice(11,16)} · ${s.payment_method} · ${esc(s.cashier||'')} · ${s.sync_status}</div>
      <div class="muted">${(s.items||[]).map(i=>i.quantity+'x '+esc(i.name)).join(', ')}</div></div>
      <div style="text-align:right"><b>${peso(s.total_amount)}</b><br>
      <button class="chip" data-r="${s.id}">Reprint</button>${isOwner()?` <button class="chip" data-v="${s.id}">Void</button>`:''}</div></div>`).join('')
      || '<p class="muted">No sales on this date.</p>'}</div>`;
  $('#hd').onchange = e => { S.hdate = e.target.value; renderHist(); };
  document.querySelectorAll('[data-r]').forEach(b=>b.onclick=async()=>printReceipt((await all('sales')).find(x=>x.id===b.dataset.r)));
  document.querySelectorAll('[data-v]').forEach(b=>b.onclick=async()=>{
    if (!confirm('Void this sale? It will no longer count in totals.')) return;
    const s = (await all('sales')).find(x=>x.id===b.dataset.v);
    s.is_deleted = 1; s.sync_status = 'pending'; s.updated_at = ymdhms(new Date()); await put('sales',s); renderHist();
  });
}

/* ---------- expenses ---------- */
async function renderExp(){
  const t = ymd(new Date()), list = (await liveExp(S.from,S.to)).sort((a,b)=>b.expense_date.localeCompare(a.expense_date));
  $('#view').innerHTML = `<div class="card"><h3 style="margin-top:0">Add expense</h3>
    <select id="ec">${S.expCats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <input id="ed" placeholder="Description (e.g. cooking oil)"><input id="ea" type="number" step="0.01" placeholder="Amount">
    <input id="edt" type="date" value="${t}"><div class="err" id="eerr"></div><button class="btn" id="eadd">Save expense</button></div>
    <div class="card"><div style="display:flex;gap:6px"><input type="date" id="f" value="${S.from}"><input type="date" id="t" value="${S.to}"></div>
    <div class="total"><span>${list.length} expense(s)</span><span>${peso(sum(list,'amount'))}</span></div>
    ${list.map(e=>`<div class="row"><div><b>${esc(e.description)}</b><div class="muted">${e.expense_date} · ${esc((S.expCats.find(c=>c.id==e.category_id)||{}).name||'')} · ${e.sync_status}</div></div>
      <div><b>${peso(e.amount)}</b> <button class="chip" data-d="${e.id}">Delete</button></div></div>`).join('')||'<p class="muted">No expenses in this range.</p>'}</div>`;
  $('#eadd').onclick = async () => {
    const desc = $('#ed').value.trim(), amt = parseFloat($('#ea').value);
    if (!desc || !(amt>0)) { $('#eerr').textContent = 'Enter a description and an amount above 0.'; return; }
    await put('expenses',{id:uuid(),user_id:S.user.id,category_id:+$('#ec').value,description:desc,amount:amt,expense_date:$('#edt').value,
      sync_status:'pending',is_deleted:0,updated_by:S.user.id,updated_at:ymdhms(new Date())});
    renderExp();
  };
  $('#f').onchange = e => { S.from = e.target.value; renderExp(); };
  $('#t').onchange = e => { S.to = e.target.value; renderExp(); };
  document.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{
    if (!confirm('Delete this expense?')) return;
    const e = (await all('expenses')).find(x=>x.id===b.dataset.d);
    e.is_deleted = 1; e.sync_status = 'pending'; e.updated_at = ymdhms(new Date()); e.updated_by = S.user.id; await put('expenses',e); renderExp();
  });
}

/* ---------- reports ---------- */
async function renderRep(){
  const sales = await liveSales(S.from,S.to), exps = await liveExp(S.from,S.to);
  const byCat = {}; exps.forEach(e=>{const n=(S.expCats.find(c=>c.id==e.category_id)||{}).name||'Other'; byCat[n]=(byCat[n]||0)+Number(e.amount);});
  const byDay = {}; sales.forEach(s=>{const d=s.sale_date.slice(0,10); byDay[d]=(byDay[d]||0)+Number(s.total_amount);});
  $('#view').innerHTML = `<button class="back-link" id="backToSettings">‹ Back to settings</button><div class="card"><div style="display:flex;gap:6px"><input type="date" id="f" value="${S.from}"><input type="date" id="t" value="${S.to}"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${stat('Sales',peso(sum(sales,'total_amount')))}${stat('Expenses',peso(sum(exps,'amount')))}${stat('Net income',peso(sum(sales,'total_amount')-sum(exps,'amount')))}</div>
    <div class="card"><b>Sales per day</b>${Object.entries(byDay).sort().map(([d,v])=>`<div class="row"><span>${d}</span><span>${peso(v)}</span></div>`).join('')||'<p class="muted">No sales.</p>'}</div>
    <div class="card"><b>Items sold</b>${topItems(sales).map(([n,v])=>`<div class="row"><span>${esc(n)}</span><span>${v.q} pcs · ${peso(v.t)}</span></div>`).join('')||'<p class="muted">No sales.</p>'}</div>
    <div class="card"><b>Expenses by category</b>${Object.entries(byCat).map(([n,v])=>`<div class="row"><span>${esc(n)}</span><span>${peso(v)}</span></div>`).join('')||'<p class="muted">No expenses.</p>'}</div>
    <button class="btn alt" id="csv">Download sales CSV</button>`;
  $('#backToSettings').onclick = () => { S.tab='set'; renderMain(); };
  $('#f').onchange = e => { S.from = e.target.value; renderRep(); };
  $('#t').onchange = e => { S.to = e.target.value; renderRep(); };
  $('#csv').onclick = () => {
    const rows = [['Receipt','Date','Cashier','Payment','Total'], ...sales.map(s=>[s.receipt_no,s.sale_date,s.cashier||'',s.payment_method,s.total_amount])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')],{type:'text/csv'}));
    a.download = `sales_${S.from}_to_${S.to}.csv`; a.click();
  };
}

/* ---------- settings + sync ---------- */
async function renderSet(){
  const ps = (await all('sales')).filter(s=>s.sync_status==='pending').length, pe = (await all('expenses')).filter(e=>e.sync_status==='pending').length;
  $('#view').innerHTML = `<div class="card settings-report-card"><h3 style="margin-top:0">Reports</h3><p class="muted">Review sales, expenses, and net income for a selected date range.</p><button class="btn" id="openReport">Open reports</button></div>
    <div class="card"><h3 style="margin-top:0">Server</h3>
    <input id="su" value="${esc(cfg.url)}" placeholder="https://api.your-domain.com/SizzleFlow/api"><input id="sk" value="${esc(cfg.key)}" placeholder="API key">
    <button class="btn alt" id="save">Save</button> <div class="muted" style="margin:6px 0">${ps} sale(s) and ${pe} expense(s) waiting to sync.</div>
    <button class="btn alt" id="test">Test server</button><button class="btn" id="sync" style="margin-top:6px">Sync now</button>
    <div id="smsg" class="muted" style="margin-top:8px"></div></div>
    <div class="card"><h3 style="margin-top:0">Receipt printing</h3>
    <select id="pm"><option value="browser">Browser print (any printer / test on laptop)</option>
    <option value="native">Bluetooth thermal printer (Android app)</option>
    <option value="ble">Web Bluetooth (Chrome only, BLE)</option><option value="rawbt">RawBT app (Android)</option></select>
    <select id="pstyle" style="margin-top:6px"><option value="image">Print as picture (Phomemo / portable printers)</option><option value="text">Print as text (standard ESC/POS receipt printers)</option></select>
    <button class="btn alt" id="pair">Find &amp; connect Bluetooth printer</button>
    <div id="plist" style="margin-top:6px"></div>
    <button class="btn alt" id="tp" style="margin-top:6px">Print test receipt</button><div id="pmsg" class="muted" style="margin-top:8px"></div></div>`;
  $('#openReport').onclick = () => { S.tab='rep'; renderMain(); };
  $('#pstyle').value = localStorage.getItem('sf_print_style') || 'image'; $('#pstyle').onchange = e => localStorage.setItem('sf_print_style', e.target.value);
  $('#pm').value = cfg.printMode; $('#pm').onchange = e => cfg.printMode = e.target.value;
  const keep = () => { cfg.url = $('#su').value.trim(); cfg.key = $('#sk').value.trim(); };
  $('#save').onclick = () => { keep(); $('#smsg').textContent = 'Saved.'; };
  $('#test').onclick = async () => { keep(); $('#smsg').textContent = 'Testing…'; $('#smsg').textContent = (await apiPing()) ? '✅ Server reachable and key accepted.' : '❌ Cannot reach the server, or the API key does not match config.php.'; };
  $('#sync').onclick = async () => { keep(); $('#smsg').textContent = 'Syncing…';
    try { const r = await syncNow(); $('#smsg').textContent = `✅ Sent ${r.s} sale(s), ${r.e} expense(s). Downloaded ${r.downloadedSales} sale(s), ${r.downloadedExpenses} expense(s).`; }
    catch (e) { $('#smsg').textContent = '❌ ' + e.message; } };
  $('#pair').onclick = async () => {
    try {
      if (cfg.printMode==='native') { $('#pmsg').textContent = 'Searching… (paired printers show first)'; await nativeScan($('#plist'), $('#pmsg')); }
      else { await bleConnect(true); $('#pmsg').textContent = '✅ Printer connected.'; }
    } catch (e) { $('#pmsg').textContent = '❌ ' + e.message; }
  };
  if (cfg.printerName) $('#pmsg').textContent = 'Saved printer: ' + cfg.printerName;
  $('#tp').onclick = () => printReceipt({receipt_no:'TEST-001',sale_date:ymdhms(new Date()),cashier:S.user.full_name,payment_method:'Cash',total_amount:100,items:[{name:'Test item',quantity:2,unit_price:50,subtotal:100}]});
}
const hdrs = () => ({'Content-Type':'application/json','X-API-KEY':cfg.key});
async function apiPing(){ if (!cfg.url) return false; try { return (await fetch(cfg.url+'/ping.php',{headers:hdrs()})).ok; } catch { return false; } }
async function apiCall(file, opt={}){
  if (!cfg.url) throw new Error('Cloud server is not configured. Set SIZZLEFLOW_API_URL in runtime-config.js.');
  let r; try { r = await fetch(cfg.url+'/'+file,{headers:hdrs(),...opt}); } catch { throw new Error('Cannot reach the cloud server. Check your internet connection.'); }
  if (r.status===401) throw new Error('API key rejected. Make sure it matches API_KEY in config.php.');
  const raw = await r.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(`Server returned invalid JSON (HTTP ${r.status}): ${raw.slice(0,160) || 'empty response'}`); }
  if (!r.ok) throw new Error(data.error || 'Server error ' + r.status);
  return data;
}
async function syncNow(){
  const sales = (await all('sales')).filter(s=>s.sync_status==='pending'), exps = (await all('expenses')).filter(e=>e.sync_status==='pending');
  let s=0, e=0;
  if (sales.length || exps.length) {
    const res = await apiCall('sync_push.php',{method:'POST',body:JSON.stringify({device_id:deviceId(),user:S.user,
      sales:sales.map(({cashier,...x})=>({...x,items:x.items.map(i=>i)})),
      categories:await all('categories'), products:await all('products'), expenses:exps})});
    for (const id of res.synced_sales||[]) { const x = sales.find(a=>a.id===id); x.sync_status='synced'; await put('sales',x); s++; }
    for (const id of res.synced_expenses||[]) { const x = exps.find(a=>a.id===id); x.sync_status='synced'; await put('expenses',x); e++; }
  }
  const c = await apiCall('sync_pull.php');
  const localUsers = await all('users');
  for (const u of c.users||[]) { const local = localUsers.find(x=>String(x.id)===String(u.id))||{}; await put('users',{...local,...u}); }
  // Download records from other devices. A locally pending record is newer
  // than its last cloud version, so retain it until its upload succeeds.
  const localSales = new Map((await all('sales')).map(x=>[String(x.id),x]));
  for (const sale of c.sales||[]) {
    const local = localSales.get(String(sale.id));
    if (local?.sync_status === 'pending') continue;
    await put('sales',{...local,...sale,items:(sale.items||[]).map(item=>({...item})),sync_status:'synced'});
  }
  const localExpenses = new Map((await all('expenses')).map(x=>[String(x.id),x]));
  for (const expense of c.expenses||[]) {
    const local = localExpenses.get(String(expense.id));
    if (local?.sync_status === 'pending') continue;
    await put('expenses',{...local,...expense,sync_status:'synced'});
  }
  // The official menu is installed locally from SEED and is the source of truth.
  // Do not let an older server catalog replace it during sync.
  for (const x of c.expense_categories||[]) await put('expense_categories',{id:+x.id,name:x.name});
  await loadCatalog();
  return {s,e,downloadedSales:(c.sales||[]).length,downloadedExpenses:(c.expenses||[]).length};
}

/* ---------- receipt + printing ---------- */
function receiptText(s){
  const w = 32, line = '-'.repeat(w), c = t => ' '.repeat(Math.max(0,(w-t.length)>>1)) + t;
  const lr = (a,b) => a + ' '.repeat(Math.max(1,w-a.length-b.length)) + b;
  return [c('SIP & SIZZLE'), c('Official Receipt'), line, 'Receipt: '+s.receipt_no, 'Date: '+s.sale_date, 'Cashier: '+(s.cashier||''), line,
    ...(s.customer_name ? ['Customer: '+s.customer_name] : []),
    ...s.items.map(i=>i.name+'\n'+lr(`  ${i.quantity} x ${plain(i.unit_price)}`, plain(i.subtotal))),
    line, lr('TOTAL',plain(s.total_amount)), 'Payment: '+s.payment_method, line, c('Thank you!'), '', '', ''].join('\n');
}
const escpos = s => new Uint8Array([0x1b,0x40, ...new TextEncoder().encode(receiptText(s).replace(/[^\x00-\x7f]/g,'?')), 0x1d,0x56,0x42,0x00]);
async function printReceipt(s){
  try {
    if (cfg.printMode==='native') { await nativePrint(s); return; }
    if (cfg.printMode==='ble') { await blePrint(escpos(s)); return; }
    if (cfg.printMode==='rawbt') {
      let bin=''; escpos(s).forEach(b=>bin+=String.fromCharCode(b));
      location.href = 'intent:base64,' + btoa(bin) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;'; return;
    }
  } catch (e) { alert('Printing failed: ' + e.message + '\nUsing browser print instead.'); }
  $('#receipt').textContent = receiptText(s); window.print();
}
let bleChar = null;
async function bleConnect(forcePick){
  if (!navigator.bluetooth) throw new Error('This browser has no Web Bluetooth. Use Chrome on Android or desktop, or choose RawBT.');
  if (bleChar && bleChar.service.device.gatt.connected && !forcePick) return bleChar;
  const dev = await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[
    '000018f0-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2','49535343-fe7d-4ae5-8fa9-9fafd205e455','0000ff00-0000-1000-8000-00805f9b34fb']});
  const server = await dev.gatt.connect();
  for (const sv of await server.getPrimaryServices())
    for (const ch of await sv.getCharacteristics())
      if (ch.properties.write || ch.properties.writeWithoutResponse) { bleChar = ch; return ch; }
  throw new Error('No writable printer channel found. This printer may be classic Bluetooth: use RawBT.');
}
async function blePrint(bytes){
  const ch = await bleConnect(false);
  for (let i=0;i<bytes.length;i+=100) {
    const part = bytes.slice(i,i+100);
    ch.properties.writeWithoutResponse ? await ch.writeValueWithoutResponse(part) : await ch.writeValue(part);
    await new Promise(r=>setTimeout(r,30));
  }
}

/* ---------- native Bluetooth printing (Capacitor, Android) ---------- */
const TP = () => { const p = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorThermalPrinter; if (!p) throw new Error('Printer plugin missing. Run: npx cap sync android, then rebuild the app.'); return p; };
async function nativeScan(listEl, msgEl){
  const tp = TP(), found = new Map();
  const draw = () => {
    listEl.innerHTML = [...found.values()].map(d => `<button class="chip" data-addr="${esc(d.address)}" data-name="${esc(d.name||'Printer')}" style="display:block;margin:4px 0">${esc(d.name||'Unknown')} (${esc(d.address)})</button>`).join('');
    listEl.querySelectorAll('[data-addr]').forEach(b => b.onclick = async () => {
      msgEl.textContent = 'Connecting…';
      try { await tp.stopScan().catch(()=>{}); const r = await tp.connect({address:b.dataset.addr}); if (r === null) throw new Error('Could not connect. Turn the printer on and try again.');
        cfg.printerAddr = b.dataset.addr; cfg.printerName = b.dataset.name; msgEl.textContent = '✅ Connected to ' + b.dataset.name + '. Tap "Print test receipt".'; listEl.innerHTML=''; }
      catch (e) { msgEl.textContent = '❌ ' + e.message; }
    });
  };
  await tp.addListener('discoverDevices', r => { (r.devices||[]).forEach(d => d.address && found.set(d.address, d)); draw(); });
  await tp.startScan();
  setTimeout(() => { tp.stopScan().catch(()=>{}); if (!found.size) msgEl.textContent = '❌ No printers found. Turn Bluetooth on, switch the printer on, allow the Nearby devices/Location permission, then try again.'; else msgEl.textContent = 'Tap your printer below.'; }, 8000);
}
let nativeBusy = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function nativeEnsureConnected(){
  const tp = TP();
  try { await tp.stopScan(); } catch {}
  try { const r = await tp.isConnected(); if (r && r.state) return; } catch {}
  let lastErr;
  for (let n = 0; n < 3; n++) {
    try { await tp.disconnect(); } catch {}       // clear any stuck/half-open connection
    await sleep(n ? 1500 : 600);
    try { const r = await tp.connect({address:cfg.printerAddr}); if (r) return; lastErr = new Error('Printer not reachable. Is it on and in range?'); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Could not connect to the printer.');
}
async function nativePrint(s){
  if (nativeBusy) await nativeBusy.catch(()=>{});   // never run two prints/connects at once
  nativeBusy = nativePrintInner(s);
  try { await nativeBusy; } finally { nativeBusy = null; }
}
async function nativePrintInner(s){
  if ((localStorage.getItem('sf_print_style')||'image') === 'image') return nativePrintImage(s);
  return nativePrintText(s);
}
async function nativePrintText(s){
  const tp = TP();
  if (!cfg.printerAddr) throw new Error('No printer saved. Go to Settings > Find & connect Bluetooth printer.');
  await nativeEnsureConnected();
  const w = 32, line = '-'.repeat(w);
  const clean = t => String(t==null?'':t).replace(/[^\x20-\x7e]/g,'?');
  const lr = (a,b) => clean(a) + ' '.repeat(Math.max(1,w-clean(a).length-clean(b).length)) + clean(b);
  // Native plugin methods take option objects and queue; write() sends everything to the printer.
  await tp.begin({});
  await tp.align({alignment:'center'});
  await tp.bold({enabled:true});
  await tp.text({text:'SIP & SIZZLE\n'});
  await tp.bold({enabled:false});
  await tp.text({text:'Official Receipt\n'});
  await tp.align({alignment:'left'});
  await tp.text({text:line+'\n'});
  await tp.text({text:'Receipt: '+clean(s.receipt_no)+'\nDate: '+clean(s.sale_date)+'\nCashier: '+clean(s.cashier)+'\n'});
  if (s.customer_name) await tp.text({text:'Customer: '+clean(s.customer_name)+'\n'});
  await tp.text({text:line+'\n'});
  for (const i of s.items) await tp.text({text: clean(i.name)+'\n'+lr('  '+i.quantity+' x '+plain(i.unit_price), plain(i.subtotal))+'\n'});
  await tp.text({text:line+'\n'});
  await tp.bold({enabled:true});
  await tp.text({text: lr('TOTAL', plain(s.total_amount))+'\n'});
  await tp.bold({enabled:false});
  await tp.text({text:'Payment: '+clean(s.payment_method)+'\n'+line+'\n'});
  await tp.align({alignment:'center'});
  await tp.text({text:'Thank you!\n\n\n'});
  await tp.feedCutPaper({half:false});
  await tp.write({});
}

/* Phomemo-style portable printers only understand bitmaps, so draw the receipt on a canvas and send it as an image. */
function loadImg(src){ return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
async function receiptCanvas(s){
  const W = 384, pad = 8, fs = 22, lh = 28, font = `bold ${fs}px "Courier New", monospace`;
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = W; g.font = font;
  const rows = [];
  const add = (t, al='left') => rows.push({t:String(t==null?'':t), al});
  const pair = (a,b) => rows.push({a:String(a), b:String(b)});
  const wrap = (t, al) => { const words = String(t).split(' '); let cur=''; for (const w of words) { const n = cur ? cur+' '+w : w; if (g.measureText(n).width > W-2*pad && cur) { add(cur, al); cur = w; } else cur = n; } add(cur, al); };
  add('SIP & SIZZLE','center'); add('Official Receipt','center'); add('-'.repeat(30),'center');
  wrap('Receipt: '+s.receipt_no); wrap('Date: '+s.sale_date); wrap('Cashier: '+(s.cashier||''));
  if (s.customer_name) wrap('Customer: '+s.customer_name);
  add('-'.repeat(30),'center');
  s.items.forEach(i => { wrap(i.name); pair('  '+i.quantity+' x '+plain(i.unit_price), plain(i.subtotal)); });
  add('-'.repeat(30),'center'); pair('TOTAL', plain(s.total_amount)); wrap('Payment: '+s.payment_method);
  add('-'.repeat(30),'center'); add('Thank you!','center'); add(''); add('');
  c.height = pad + rows.length * lh + pad;
  g.fillStyle = '#fff'; g.fillRect(0,0,W,c.height); g.fillStyle = '#000'; g.font = font; g.textBaseline = 'top';
  let y = pad;
  rows.forEach(r => {
    if (r.a !== undefined) { g.textAlign='left'; g.fillText(r.a, pad, y); g.textAlign='right'; g.fillText(r.b, W-pad, y); }
    else { g.textAlign = r.al; g.fillText(r.t, r.al==='center' ? W/2 : pad, y); }
    y += lh;
  });
  return c;
}
async function nativePrintImage(s){
  const tp = TP();
  if (!cfg.printerAddr) throw new Error('No printer saved. Go to Settings > Find & connect Bluetooth printer.');
  await nativeEnsureConnected();
  const canvas = await receiptCanvas(s);
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  await tp.begin({});
  await tp.align({alignment:'center'});
  await tp.dpi({dpi:200});
  await tp.limitWidth({width:48.5});
  await tp.image({image:b64});
  await tp.text({text:'\n\n\n'});
  await tp.write({});
}

init();
