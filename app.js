// --- DATABASE LAYER & SEED DATA ---
const DEFAULT_PRODUCTS = [
  { id: 1, name: "Rosal Rojo Premium", price: 180, stock: 12, category: "Rosas", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300" },
  { id: 2, name: "Ramo de Tulipanes Amarillos", price: 220, stock: 4, category: "Tulipanes", image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?w=300" },
  { id: 3, name: "Girasol Silvestre Individual", price: 85, stock: 25, category: "Girasoles", image: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=300" },
  { id: 4, name: "Orquídea Blanca Imperial", price: 340, stock: 2, category: "Orquideas", image: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=300" },
  { id: 5, name: "Guirnalda Eucalipto y Flor Blanca", price: 290, stock: 8, category: "Follaje", image: "https://images.unsplash.com/photo-1508784932223-3b37a47c8701?w=300" },
  { id: 6, name: "Hortensia Azul Cobalto", price: 195, stock: 15, category: "Rosas", image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=300" },
  { id: 7, name: "Lirio Blanco de Campo", price: 145, stock: 9, category: "Tulipanes", image: "https://images.unsplash.com/photo-1560717789-0ac7c58ac90a?w=300" },
  { id: 8, name: "Ramo Rosas Rosa Claro", price: 210, stock: 18, category: "Rosas", image: "https://images.unsplash.com/photo-1533604085449-65a88f700684?w=300" },
  { id: 9, name: "Girasoles en Canasta Rústica", price: 310, stock: 3, category: "Girasoles", image: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=300" },
  { id: 10, name: "Orquídea Phalaenopsis Púrpura", price: 360, stock: 5, category: "Orquideas", image: "https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=300" },
  { id: 11, name: "Enredadera Helecho Artificial", price: 120, stock: 30, category: "Follaje", image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=300" },
  { id: 12, name: "Ramo de Tulipanes Morados", price: 230, stock: 7, category: "Tulipanes", image: "https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=300" }
];

const DEFAULT_USERS = [
  { id: "1", name: "María Gómez", alias: "Mary", phone: "5551234567", city: "Guadalajara", email: "maria@example.com", debt: 1500, creditLimit: 5000, creditHistory: [
    { type: 'deuda', amount: 2000, date: '2026-05-15', description: 'Pedido #1001' },
    { type: 'abono', amount: 500, date: '2026-05-28', description: 'Abono en efectivo' }
  ] },
  { id: "2", name: "Juan Pérez", alias: "Juanito", phone: "3339876543", city: "Zapopan", email: "juan@example.com", debt: 0, creditLimit: 2000, creditHistory: [] }
];

const DEFAULT_ORDERS = [
  { id: "1001", clientName: "María Gómez", phone: "5551234567", city: "Guadalajara", items: [{ id: 1, name: "Rosal Rojo Premium", price: 180, qty: 3 }], total: 540, paymentMethod: "pedido", status: "pendiente", date: "2026-06-01T14:30:00" }
];

const DEFAULT_SETTINGS = {
  gamesEnabled: true,
  criticalStockThreshold: 5
};

const DEFAULT_CATEGORIES = ["Rosas", "Tulipanes", "Girasoles", "Orquideas", "Follaje"];

const SUPABASE_URL = "https://viwvfkiinycvppiknfta.supabase.co";
const SUPABASE_KEY = "sb_publishable_G5XUi3TX8nGPmd4_muEusw_v88oN7T4";
let supabaseClient = null;
// Flag to prevent syncFromCloud from overwriting local changes while syncToCloud is in progress
let isSyncingToCloud = false;
try {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  console.warn("Supabase init failed, running in offline mode:", err);
}

class AppDB {
  static init() {
    try {
      if (localStorage.getItem('flowers_db_version') !== '1.2') {
        localStorage.setItem('flowers_products', JSON.stringify(DEFAULT_PRODUCTS));
        localStorage.setItem('flowers_users', JSON.stringify(DEFAULT_USERS));
        localStorage.setItem('flowers_orders', JSON.stringify(DEFAULT_ORDERS));
        localStorage.setItem('flowers_settings', JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem('flowers_categories', JSON.stringify(DEFAULT_CATEGORIES));
        localStorage.setItem('flowers_db_version', '1.2');
      }
      // Upgrade path for users missing categories
      if (!localStorage.getItem('flowers_categories')) {
        localStorage.setItem('flowers_categories', JSON.stringify(DEFAULT_CATEGORIES));
      }
    } catch (err) {
      console.error("Error setting default localStorage keys:", err);
    }
    
    try {
      // Sync from cloud and listen for real-time changes
      syncFromCloud().catch(err => console.error("syncFromCloud failed:", err));
    } catch (err) {
      console.error("Failed to start syncFromCloud:", err);
    }

    try {
      setupRealtime();
    } catch (err) {
      console.error("Failed to setup realtime channel:", err);
    }
  }

  static get(key) {
    return JSON.parse(localStorage.getItem('flowers_' + key));
  }

  static set(key, val) {
    const oldVal = JSON.parse(localStorage.getItem('flowers_' + key)) || [];
    localStorage.setItem('flowers_' + key, JSON.stringify(val));
    // Dispatch general event to trigger reactivity
    window.dispatchEvent(new Event('db_updated'));
    
    // Sync changes to Supabase in the background
    syncToCloud(key, val, oldVal);
  }
}

async function syncFromCloud() {
  if (!supabaseClient) return;
  // Skip cloud sync if we are currently pushing local changes to avoid race conditions
  if (isSyncingToCloud) {
    console.log('[Sync] Skipping syncFromCloud — local sync in progress');
    return;
  }
  try {
    // 1. Fetch categories
    const { data: categories } = await supabaseClient.from('categories').select('name');
    if (categories) {
      localStorage.setItem('flowers_categories', JSON.stringify(categories.map(c => c.name)));
    }

    // 2. Fetch products
    const { data: products } = await supabaseClient.from('products').select('*').order('id', { ascending: true });
    if (products) {
      localStorage.setItem('flowers_products', JSON.stringify(products));
    }

    // 3. Fetch users
    const { data: users } = await supabaseClient.from('users').select('*');
    if (users) {
      const mappedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        alias: u.alias,
        phone: u.phone,
        city: u.city,
        email: u.email,
        debt: parseFloat(u.debt || 0),
        creditLimit: parseFloat(u.credit_limit || 0),
        creditHistory: u.credit_history || []
      }));
      localStorage.setItem('flowers_users', JSON.stringify(mappedUsers));
    }

    // 4. Fetch orders
    const { data: orders } = await supabaseClient.from('orders').select('*');
    if (orders) {
      const mappedOrders = orders.map(o => ({
        id: o.id,
        clientName: o.client_name,
        clientAlias: o.client_alias,
        phone: o.phone,
        city: o.city,
        items: o.items || [],
        total: parseFloat(o.total || 0),
        paymentMethod: o.payment_method,
        status: o.status,
        date: o.date
      }));
      localStorage.setItem('flowers_orders', JSON.stringify(mappedOrders));
    }

    // 5. Fetch settings
    const { data: settings } = await supabaseClient.from('settings').select('*').eq('id', 'app_settings').single();
    if (settings) {
      localStorage.setItem('flowers_settings', JSON.stringify({
        gamesEnabled: settings.games_enabled,
        criticalStockThreshold: settings.critical_stock_threshold
      }));
    }

    // Dispatch event to refresh views
    window.dispatchEvent(new Event('db_updated'));
  } catch (err) {
    console.error("Error syncing from Supabase:", err);
  }
}

async function syncToCloud(key, val, oldVal) {
  if (!supabaseClient) return;
  isSyncingToCloud = true;
  try {
    if (key === 'orders') {
      // Check for deleted orders
      if (val.length < oldVal.length) {
        const activeIds = new Set(val.map(item => String(item.id)));
        const deletedItems = oldVal.filter(item => !activeIds.has(String(item.id)));
        for (const item of deletedItems) {
          const { error } = await supabaseClient.from('orders').delete().eq('id', item.id);
          if (error) console.error('[Sync] Error deleting order:', error);
        }
      }
      if (val.length > 0) {
        const mapped = val.map(o => ({
          id: o.id,
          client_name: o.clientName,
          client_alias: o.clientAlias || '',
          phone: o.phone,
          city: o.city,
          items: o.items,
          total: o.total,
          payment_method: o.paymentMethod || 'pedido',
          status: o.status,
          date: o.date
        }));
        const { error } = await supabaseClient.from('orders').upsert(mapped, { onConflict: 'id' });
        if (error) console.error('[Sync] Error upserting orders:', error);
      }
    } else if (key === 'users') {
      // Check for deleted users
      if (val.length < oldVal.length) {
        const activeIds = new Set(val.map(item => String(item.id)));
        const deletedItems = oldVal.filter(item => !activeIds.has(String(item.id)));
        for (const item of deletedItems) {
          const { error } = await supabaseClient.from('users').delete().eq('id', item.id);
          if (error) console.error('[Sync] Error deleting user:', error);
        }
      }
      if (val.length > 0) {
        const mapped = val.map(u => ({
          id: u.id,
          name: u.name,
          alias: u.alias || '',
          phone: u.phone || '',
          city: u.city || '',
          email: u.email,
          debt: u.debt || 0,
          credit_limit: u.creditLimit || 5000,
          credit_history: u.creditHistory || []
        }));
        const { error } = await supabaseClient.from('users').upsert(mapped, { onConflict: 'id' });
        if (error) console.error('[Sync] Error upserting users:', error);
      }
    } else if (key === 'products') {
      // Check for deleted products
      if (val.length < oldVal.length) {
        const activeIds = new Set(val.map(item => String(item.id)));
        const deletedItems = oldVal.filter(item => !activeIds.has(String(item.id)));
        for (const item of deletedItems) {
          const { error } = await supabaseClient.from('products').delete().eq('id', item.id);
          if (error) console.error('[Sync] Error deleting product:', error);
        }
      }
      if (val.length > 0) {
        const mapped = val.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          category: p.category,
          image: p.image
        }));
        const { error } = await supabaseClient.from('products').upsert(mapped, { onConflict: 'id' });
        if (error) console.error('[Sync] Error upserting products:', error);
      }
    } else if (key === 'categories') {
      // Categories: 'name' is the primary key (referenced by products.category FK)
      
      // Step 1: Delete only removed categories (ones in oldVal but not in val)
      const currentNames = new Set(val.map(c => c.toLowerCase()));
      const removedCats = oldVal.filter(c => !currentNames.has(c.toLowerCase()));
      for (const cat of removedCats) {
        const { error } = await supabaseClient.from('categories').delete().eq('name', cat);
        if (error) {
          // 409 = foreign key conflict (category still used by a product), log but don't crash
          console.warn(`[Sync] Could not delete category "${cat}" (may be in use by products):`, error.message);
        }
      }
      
      // Step 2: Upsert all current categories
      if (val.length > 0) {
        const mapped = val.map(c => ({ name: c }));
        const { error } = await supabaseClient.from('categories').upsert(mapped, { onConflict: 'name' });
        if (error) console.error('[Sync] Error upserting categories:', error);
      }
    } else if (key === 'settings') {
      // Sync settings as a single row
      const { error } = await supabaseClient.from('settings').upsert({
        id: 'app_settings',
        games_enabled: val.gamesEnabled,
        critical_stock_threshold: val.criticalStockThreshold
      }, { onConflict: 'id' });
      if (error) console.error('[Sync] Error upserting settings:', error);
    }
  } catch (err) {
    console.error(`[Sync] Exception syncing ${key} to Supabase:`, err);
  } finally {
    // Release the lock after a short delay to let realtime events from our own
    // changes pass through without triggering a conflicting syncFromCloud
    setTimeout(() => {
      isSyncingToCloud = false;
    }, 2000);
  }
}

let _realtimeDebounceTimer = null;
function setupRealtime() {
  if (!supabaseClient) return;
  supabaseClient.channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      // Debounce realtime events to avoid rapid-fire sync calls
      // that can overwrite in-flight local changes
      clearTimeout(_realtimeDebounceTimer);
      _realtimeDebounceTimer = setTimeout(() => {
        if (!isSyncingToCloud) {
          syncFromCloud();
        }
      }, 1500);
    })
    .subscribe();
}

try {
  AppDB.init();
} catch (e) {
  console.error("Critical error during AppDB.init():", e);
}

// --- RETRO AUDIO SYNTHESIS ENGINE ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

window.playArcadeSound = function(type) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'collect') {
      // Retro bounce/jump coin sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'pop') {
      // Light POP sound when adding to cart
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'remove') {
      // Inverse slide down sound when removing from cart
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      // Uplifting arpeggio chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(261.6, now); // C4
      osc.frequency.setValueAtTime(329.6, now + 0.08); // E4
      osc.frequency.setValueAtTime(392.0, now + 0.16); // G4
      osc.frequency.setValueAtTime(523.3, now + 0.24); // C5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'hit') {
      // Game over retro buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch(e) {
    console.warn("Web Audio API not supported/allowed:", e);
  }
};

// --- APP CONTROLLER AND DATA MANIPULATION ---
const state = {
  currentView: 'client', // 'client', 'admin'
  clientTab: 'catalog', // 'catalog', 'profile', 'game'
  adminTab: 'overview', // 'overview', 'products', 'orders', 'users', 'settings'
  cart: {}, // productId -> qty
  currentUser: JSON.parse(localStorage.getItem('flowers_active_session')) || null, // Logged in user object
  editingProduct: null, // Product object being edited in CRUD
  selectedOrder: null, // Order details popup
  gameScore: 0,
  searchTerm: '',
  selectedCategory: 'todas',
  isSoundMuted: false,
  ordersFilter: 'pendiente'
};

// Helper: Get cart details
function getCartItems() {
  const products = AppDB.get('products');
  const items = [];
  let total = 0;
  for (const [id, qty] of Object.entries(state.cart)) {
    const p = products.find(prod => prod.id == id);
    if (p && qty > 0) {
      const itemTotal = p.price * qty;
      items.push({ ...p, qty, itemTotal });
      total += itemTotal;
    }
  }
  return { items, total };
}

// Particle physical flying animation
function animateToCart(originElement, totalElementId) {
  if (!originElement) return;
  const rect = originElement.getBoundingClientRect();
  const destElement = document.getElementById(totalElementId);
  if (!destElement) return;
  const destRect = destElement.getBoundingClientRect();

  // Create floating particle
  const particle = document.createElement('div');
  particle.className = 'flying-flower-particle';
  particle.innerHTML = '🌸';
  particle.style.left = `${rect.left + rect.width / 2}px`;
  particle.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(particle);

  // Setup animations using CSS variables
  const dx = (destRect.left + destRect.width / 2) - (rect.left + rect.width / 2);
  const dy = (destRect.top + destRect.height / 2) - (rect.top + rect.height / 2);

  particle.style.setProperty('--dx', `${dx}px`);
  particle.style.setProperty('--dy', `${dy}px`);
  particle.style.animation = 'flyToCart 1.0s cubic-bezier(0.25, 1, 0.5, 1) forwards';

  // Sound POP
  if (!state.isSoundMuted) window.playArcadeSound('pop');

  // Sparkle effects on impact
  setTimeout(() => {
    particle.remove();
    // Add brief pop animation to the destination
    destElement.classList.add('pop-shake');
    setTimeout(() => destElement.classList.remove('pop-shake'), 300);
  }, 1000);
}

// --- RENDERING ROUTINES ---

// Render client flower listing
function renderCatalog() {
  const listEl = document.getElementById('client-product-list');
  if (!listEl) return;

  const products = AppDB.get('products') || [];
  const settings = AppDB.get('settings') || {};

  // Filter based on search & category
  const filtered = products.filter(p => {
    if (p.stock <= 0) return false; // Invisible if stock = 0
    const matchesSearch = p.name.toLowerCase().includes(state.searchTerm.toLowerCase());
    const matchesCategory = state.selectedCategory === 'todas' || p.category === state.selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="no-products-msg">No hay modelos disponibles de momento 🌸</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    const inCart = state.cart[p.id] || 0;
    const isCritical = p.stock <= settings.criticalStockThreshold;
    const badge = isCritical 
      ? `<span class="stock-badge critical">¡Solo quedan ${p.stock}! ⚡</span>`
      : `<span class="stock-badge">Stock: ${p.stock}</span>`;

    return `
      <div class="product-card" id="prod-card-${p.id}" onclick="handleCardClick(event, ${p.id}, this)">
        <div class="product-image-container">
          <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
          ${badge}
          ${inCart > 0 ? `
            <div class="quantity-controller floating-overlay">
              <button onclick="updateCartQty(${p.id}, -1)" class="btn-qty">-</button>
              <span class="qty-display">${inCart}</span>
              <button onclick="updateCartQty(${p.id}, 1, this)" class="btn-qty" ${inCart >= p.stock ? 'disabled' : ''}>+</button>
            </div>
          ` : ''}
        </div>
        <div class="product-info">
          <h3 class="product-title">${p.name}</h3>
          <p class="product-price">$${p.price.toFixed(2)}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Render category filter chips
function renderCategoryFilters() {
  const filterEl = document.getElementById('category-scroll-container');
  if (!filterEl) return;

  const dbCategories = AppDB.get('categories') || [];
  const categories = ['todas', ...dbCategories];

  filterEl.innerHTML = categories.map(cat => {
    const active = state.selectedCategory === cat ? 'active' : '';
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `
      <button class="category-chip ${active}" onclick="selectCategory('${cat}')">
        ${cat === 'todas' ? '🌸 Todas' : label}
      </button>
    `;
  }).join('');
}

// Update Cart Quantity
window.updateCartQty = function(id, diff, element = null) {
  const products = AppDB.get('products');
  const p = products.find(prod => prod.id == id);
  if (!p) return;

  const current = state.cart[id] || 0;
  const target = current + diff;

  if (target <= 0) {
    delete state.cart[id];
  } else if (target <= p.stock) {
    state.cart[id] = target;
  } else if (diff > 0) {
    openModal('out-of-stock-modal');
  }

  // Update the global cart bar first so the DOM elements are created in the page
  updateGlobalCartBar();

  // Animate target to total bar if adding, or play remove sound if decreasing
  if (diff > 0 && element && target <= p.stock) {
    animateToCart(element, 'bottom-bar-total');
  } else if (diff < 0 && !state.isSoundMuted) {
    window.playArcadeSound('remove');
  }

  renderCatalog();
  renderCartModalContent();
};

window.handleCardClick = function(event, id, cardEl) {
  // If clicked inside the controller or add button, let their direct handlers execute
  if (event.target.closest('.quantity-controller') || event.target.closest('.btn-add-cart')) {
    return;
  }
  const imgEl = cardEl.querySelector('.product-image');
  updateCartQty(id, 1, imgEl || cardEl);
};

function selectCategory(cat) {
  state.selectedCategory = cat;
  renderCategoryFilters();
  renderCatalog();
  
  // Smoothly center the active chip in the horizontal scroll menu
  setTimeout(() => {
    const container = document.getElementById('category-scroll-container');
    if (container) {
      const activeChip = container.querySelector('.category-chip.active');
      if (activeChip) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, 50);
}

window.searchProducts = function(query) {
  state.searchTerm = query;
  renderCatalog();
};

// Global Float Cart Update
function updateGlobalCartBar() {
  const bar = document.getElementById('floating-bottom-bar');
  if (!bar) return;

  const { items, total } = getCartItems();
  const totalCount = items.reduce((acc, it) => acc + it.qty, 0);

  if (totalCount > 0) {
    bar.classList.add('visible');
    bar.innerHTML = `
      <div class="bottom-bar-content" onclick="openModal('cart-modal')">
        <div class="bottom-bar-info">
          <span class="cart-icon">🛒</span>
          <span class="cart-count">${totalCount} prod.</span>
        </div>
        <div class="bottom-bar-price" id="bottom-bar-total">
          Total: $${total.toFixed(2)}
        </div>
        <button class="btn-checkout-flow">Ver Pedido</button>
      </div>
    `;
  } else {
    bar.classList.remove('visible');
  }
}

// Render dynamic cart contents inside Checkout preview
function renderCartModalContent() {
  const container = document.getElementById('cart-items-list');
  if (!container) return;

  const { items, total } = getCartItems();
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-cart-text">El carrito está vacío 🌸</div>`;
    document.getElementById('checkout-action-btn').disabled = true;
    closeModal('cart-modal');
    return;
  }

  document.getElementById('checkout-action-btn').disabled = false;
  container.innerHTML = items.map(it => `
    <div class="cart-item-row">
      <div class="cart-item-detail">
        <span class="cart-item-name">${it.name}</span>
        <span class="cart-item-subtotal">$${it.price.toFixed(2)} c/u</span>
      </div>
      <div class="cart-item-right">
        <div class="quantity-controller smaller">
          <button onclick="updateCartQty(${it.id}, -1)" class="btn-qty">-</button>
          <span class="qty-display">${it.qty}</span>
          <button onclick="updateCartQty(${it.id}, 1)" class="btn-qty" ${it.qty >= it.stock ? 'disabled' : ''}>+</button>
        </div>
        <span class="cart-item-total">$${it.itemTotal.toFixed(2)}</span>
      </div>
    </div>
  `).join('') + `
    <div class="cart-total-summary">
      <span>Subtotal de Compra:</span>
      <span class="glowing-total">$${total.toFixed(2)}</span>
    </div>
  `;
}

// Open checkout form modal
window.proceedToCheckout = function() {
  closeModal('cart-modal');
  openModal('checkout-form-modal');
  
  // Fill profile fields if user logged in
  const nameInput = document.getElementById('checkout-name');
  const phoneInput = document.getElementById('checkout-phone');
  const cityInput = document.getElementById('checkout-city');

  if (state.currentUser) {
    nameInput.value = state.currentUser.name;
    phoneInput.value = state.currentUser.phone;
    cityInput.value = state.currentUser.city;
    // Disable inputs for user profiles to avoid accidental edits, or let edit? Keep read-only if logged
    nameInput.readOnly = true;
    phoneInput.readOnly = true;
    cityInput.readOnly = true;
    document.getElementById('checkout-user-badge').style.display = 'block';
  } else {
    nameInput.value = '';
    phoneInput.value = '';
    cityInput.value = '';
    nameInput.readOnly = false;
    phoneInput.readOnly = false;
    cityInput.readOnly = false;
    document.getElementById('checkout-user-badge').style.display = 'none';
  }
};

// Place Order
window.submitOrder = function(e) {
  e.preventDefault();
  
  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const city = document.getElementById('checkout-city').value.trim();

  if (!name || !phone || !city) {
    alert("Por favor llena todos los campos obligatorios.");
    return;
  }

  const { items, total } = getCartItems();
  const products = AppDB.get('products');

  // 1. Deduct stock
  items.forEach(it => {
    const p = products.find(prod => prod.id == it.id);
    if (p) p.stock = Math.max(0, p.stock - it.qty);
  });
  AppDB.set('products', products);

  // 2. Create order object
  const orders = AppDB.get('orders');
  const newOrderId = String(1001 + orders.length);
  const newOrder = {
    id: newOrderId,
    clientName: name,
    clientAlias: state.currentUser ? (state.currentUser.alias || '') : '',
    phone,
    city,
    items: items.map(it => ({ id: it.id, name: it.name, price: it.price, qty: it.qty })),
    total,
    paymentMethod: "pedido", // Default value
    status: "pendiente",
    date: new Date().toISOString()
  };

  orders.push(newOrder);
  AppDB.set('orders', orders);

  // Clear Cart
  state.cart = {};
  updateGlobalCartBar();
  renderCatalog();
  closeModal('checkout-form-modal');

  // Trigger Success Screen Modal
  openModal('success-modal');
  if (!state.isSoundMuted) window.playArcadeSound('success');

  // Build WhatsApp prefilled message
  const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
  if (whatsappShareBtn) {
    const whatsappUrl = buildWhatsappLink(newOrder);
    whatsappShareBtn.onclick = () => {
      window.open(whatsappUrl, '_blank');
    };
  }
};

function buildWhatsappLink(order) {
  let msg = `🌸 *NUEVO PEDIDO DE LAS FANTASIAS DEL MARCO* 🌸\n`;
  msg += `*Pedido #:* ${order.id}\n`;
  msg += `*Cliente:* ${order.clientName}\n`;
  msg += `*Teléfono:* ${order.phone}\n`;
  msg += `*Ciudad:* ${order.city}\n\n`;
  msg += `*DETALLE DEL PEDIDO:*\n`;
  order.items.forEach(it => {
    msg += `• ${it.qty}x ${it.name} ($${it.price.toFixed(2)} c/u) = $${(it.price * it.qty).toFixed(2)}\n`;
  });
  msg += `\n*TOTAL: $${order.total.toFixed(2)}*\n\n`;
  msg += `Generado desde la App. ¡Espero tu confirmación! 🌺`;

  return `https://wa.me/5215555555555?text=${encodeURIComponent(msg)}`; // Simulated admin WhatsApp
}

// --- PROFILE & USER SESSIONS ---
window.toggleProfileLogin = function() {
  const container = document.getElementById('profile-content-container');
  if (!container) return;

  if (state.currentUser) {
    // Show active user profile
    const u = state.currentUser;
    const allOrders = AppDB.get('orders') || [];
    const userOrders = allOrders.filter(o => 
      (o.phone && o.phone === u.phone) || 
      (o.clientName && o.clientName.toLowerCase() === u.name.toLowerCase()) || 
      (u.alias && o.clientAlias && o.clientAlias.toLowerCase() === u.alias.toLowerCase())
    );

    container.innerHTML = `
      <div class="user-card glass-panel">
        <div class="user-profile-header">
          <div class="user-avatar">👤</div>
          <div>
            <h3>${u.name} ${u.alias ? `(${u.alias})` : ''}</h3>
            <p>${u.email}</p>
          </div>
        </div>
        <div class="user-details">
          <p><strong>Teléfono:</strong> ${u.phone}</p>
          <p><strong>Ciudad:</strong> ${u.city}</p>
        </div>
        
        <div class="credit-summary-section">
          <h4>Estado de Crédito</h4>
          <div class="debt-box" style="border-color: var(--success); background: rgba(52, 211, 153, 0.05); margin-bottom: 8px;">
            <span class="label" style="color: var(--success);">Crédito Disponible:</span>
            <span class="value" style="color: var(--success); font-weight: 800; font-size: 1.1rem;">$${((u.creditLimit || 0) - u.debt).toFixed(2)}</span>
          </div>
          <div style="font-size: 0.75rem; margin-bottom: 16px; display: flex; justify-content: space-between; color: var(--text-secondary); padding: 0 4px;">
            <span>Límite Autorizado: $${(u.creditLimit || 0).toFixed(2)}</span>
            <span>Deuda Actual: $${u.debt.toFixed(2)}</span>
          </div>

          <h5>Historial de Movimientos</h5>
          <div class="credit-logs-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 16px;">
            ${u.creditHistory.length === 0 ? `<p class="empty-text">No hay movimientos registrados.</p>` : 
              u.creditHistory.map(h => {
                const isOrder = h.description.startsWith('Pedido #');
                const orderId = isOrder ? h.description.split('#')[1].trim() : null;
                const clickAttr = isOrder ? `onclick="viewClientOrderDetail('${orderId}')"` : '';
                const clickClass = isOrder ? 'clickable' : '';
                return `
                <div class="history-item ${h.type} ${clickClass}" ${clickAttr}>
                  <div class="history-meta">
                    <span class="date">${h.date}</span>
                    <span class="desc">${h.description} ${isOrder ? '<span style="font-size: 0.8rem; opacity: 0.6; margin-left: 4px;">👆</span>' : ''}</span>
                  </div>
                  <span class="amount">${h.type === 'deuda' ? '+' : '-'}$${h.amount.toFixed(2)}</span>
                </div>
                `;
              }).join('')
            }
          </div>

          <h5 style="margin-top: 16px;">Historial de Pedidos Realizados</h5>
          <div class="credit-logs-list" style="max-height: 200px; overflow-y: auto;">
            ${userOrders.length === 0 ? `<p class="empty-text">No tienes pedidos registrados todavía.</p>` : 
              userOrders.map(o => {
                const dateStr = new Date(o.date).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const statusLabels = {
                  pendiente: '<span class="badge-status pending" style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Pendiente</span>',
                  completado: '<span class="badge-status completed" style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Completado</span>',
                  cancelado: '<span class="badge-status cancelled" style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Cancelado</span>'
                };
                return `
                <div class="history-item clickable" onclick="viewClientOrderDetail('${o.id}')" style="cursor: pointer; padding: 10px 8px;">
                  <div class="history-meta">
                    <span class="date">${dateStr}</span>
                    <span class="desc">Pedido #${o.id} <span style="font-size: 0.75rem; opacity: 0.6;">(Ver detalle 👆)</span></span>
                    <div style="margin-top: 4px;">${statusLabels[o.status] || o.status}</div>
                  </div>
                  <span class="amount" style="font-weight: bold; color: var(--text-primary);">$${o.total.toFixed(2)}</span>
                </div>
                `;
              }).join('')
            }
          </div>
        </div>

        <button onclick="logoutUser()" class="btn-logout" style="margin-top: 16px;">Cerrar Sesión</button>
      </div>
    `;
  } else {
    // Show register & login views
    container.innerHTML = `
      <div class="auth-tabs">
        <button class="auth-tab-btn active" onclick="switchAuthTab('login')">Ingresar</button>
        <button class="auth-tab-btn" onclick="switchAuthTab('register')">Registrarme</button>
      </div>
      <div class="auth-form-container glass-panel">
        <!-- Login Form -->
        <form id="login-form" onsubmit="loginUser(event)">
          <div class="form-group">
            <label for="login-email">Correo Electrónico</label>
            <input type="email" id="login-email" required placeholder="tu@correo.com">
          </div>
          <button type="submit" class="btn-submit-form">Iniciar Sesión 🚀</button>
        </form>

        <!-- Register Form -->
        <form id="register-form" onsubmit="registerUser(event)" style="display:none;">
          <div class="form-group">
            <label for="reg-name">Nombre Completo</label>
            <input type="text" id="reg-name" required placeholder="Ej. María Gómez">
          </div>
          <div class="form-group">
            <label for="reg-alias">Alias o Apodo</label>
            <input type="text" id="reg-alias" placeholder="Ej. Mari Flores (Opcional)">
          </div>
          <div class="form-group">
            <label for="reg-phone">Teléfono</label>
            <input type="tel" id="reg-phone" required placeholder="10 dígitos">
          </div>
          <div class="form-group">
            <label for="reg-city">Ciudad</label>
            <input type="text" id="reg-city" required placeholder="Ej. Guadalajara">
          </div>
          <div class="form-group">
            <label for="reg-email">Correo Electrónico</label>
            <input type="email" id="reg-email" required placeholder="tu@correo.com">
          </div>
          <button type="submit" class="btn-submit-form">Crear Cuenta 🌸</button>
        </form>
      </div>
    `;
  }
}

window.switchAuthTab = function(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const tabs = document.querySelectorAll('.auth-tab-btn');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }
};

window.loginUser = function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const users = AppDB.get('users') || [];

  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (found) {
    state.currentUser = found;
    localStorage.setItem('flowers_active_session', JSON.stringify(found));
    toggleProfileLogin();
    updateGlobalCartBar();
  } else {
    alert("Usuario no registrado. Regístrate en la pestaña lateral.");
  }
};

window.registerUser = function(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const alias = document.getElementById('reg-alias').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const city = document.getElementById('reg-city').value.trim();
  const email = document.getElementById('reg-email').value.trim();

  const users = AppDB.get('users') || [];
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    alert("Este correo ya está registrado.");
    return;
  }

  const newUser = {
    id: String(Date.now()),
    name,
    alias,
    phone,
    city,
    email,
    debt: 0,
    creditHistory: []
  };

  users.push(newUser);
  AppDB.set('users', users);
  state.currentUser = newUser;
  localStorage.setItem('flowers_active_session', JSON.stringify(newUser));
  toggleProfileLogin();
  updateGlobalCartBar();
};

window.logoutUser = function() {
  if (!confirm("¿Estás seguro de que deseas cerrar tu sesión?")) {
    return;
  }
  state.currentUser = null;
  localStorage.removeItem('flowers_active_session');
  toggleProfileLogin();
  updateGlobalCartBar();
};

// --- GAME INTEGRATION ---
let miniGameInstance = null;

function renderGameTab() {
  const container = document.getElementById('games-tab-content');
  if (!container) return;

  const settings = AppDB.get('settings') || {};
  if (!settings.gamesEnabled) {
    container.innerHTML = `
      <div class="game-disabled-screen">
        <div class="lock-icon">🔒</div>
        <h3>Zona de Juegos Apagada</h3>
        <p>El administrador ha desactivado temporalmente los minijuegos. ¡Vuelve pronto!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="game-wrapper">
      <div class="game-hud">
        <span class="game-score">Puntos: <strong id="arcade-score">0</strong></span>
        <button id="btn-toggle-sound" onclick="toggleMuteSound()">🔊 Sonido</button>
      </div>
      <div class="canvas-container">
        <canvas id="game-canvas"></canvas>
        <div id="game-start-overlay" class="game-overlay">
          <h2>Pacman Floral 🐝</h2>
          <p>Mueve a la abejita tocando la pantalla en la dirección deseada para recolectar flores. ¡Evita las arañas rojas! 🕷️</p>
          <button class="btn-play-game" onclick="startGameArcade()">Jugar Ahora 🎮</button>
        </div>
      </div>
      <div class="mobile-joystick-dpad">
        <button class="dpad-btn up" onclick="triggerDpadMove('w')">▲</button>
        <div class="dpad-row">
          <button class="dpad-btn left" onclick="triggerDpadMove('a')">◀</button>
          <button class="dpad-btn right" onclick="triggerDpadMove('d')">▶</button>
        </div>
        <button class="dpad-btn down" onclick="triggerDpadMove('s')">▼</button>
      </div>
    </div>
  `;

  // Init canvas object
  miniGameInstance = new window.FlowerGame(
    'game-canvas',
    (score) => {
      document.getElementById('arcade-score').innerText = score;
    },
    (finalScore) => {
      alert(`¡Juego terminado! Puntos conseguidos: ${finalScore} 🏆`);
      document.getElementById('game-start-overlay').style.display = 'flex';
    }
  );
}

window.startGameArcade = function() {
  if (miniGameInstance) {
    document.getElementById('game-start-overlay').style.display = 'none';
    miniGameInstance.start();
  }
};

window.triggerDpadMove = function(key) {
  if (miniGameInstance && miniGameInstance.gameActive) {
    // Dispatch synthesized keyboard event
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }
};

window.toggleMuteSound = function() {
  state.isSoundMuted = !state.isSoundMuted;
  const btn = document.getElementById('btn-toggle-sound');
  if (btn) {
    btn.innerText = state.isSoundMuted ? '🔇 Muto' : '🔊 Sonido';
  }
};

// --- ADMIN DASHBOARD PANEL FUNCTIONS ---

function switchAdminTab(tab) {
  state.adminTab = tab;
  const links = document.querySelectorAll('.admin-sidebar-link');
  links.forEach(l => {
    if (l.dataset.tab === tab) l.classList.add('active');
    else l.classList.remove('active');
  });

  // Hide all contents
  const contents = document.querySelectorAll('.admin-tab-content');
  contents.forEach(c => c.style.display = 'none');

  const activeContent = document.getElementById(`admin-tab-${tab}`);
  if (activeContent) activeContent.style.display = 'block';

  // Specific content renders
  if (tab === 'overview') renderAdminOverview();
  else if (tab === 'products') renderAdminProducts();
  else if (tab === 'orders') renderAdminOrders();
  else if (tab === 'users') renderAdminUsers();
  else if (tab === 'settings') renderAdminSettings();
}
window.switchAdminTab = switchAdminTab;

// Admin Tab: Overview & Analytics
function renderAdminOverview() {
  const orders = AppDB.get('orders') || [];
  const products = AppDB.get('products') || [];
  const settings = AppDB.get('settings') || {};

  // Count pending
  const pendingOrders = orders.filter(o => o.status === 'pendiente');
  document.getElementById('overview-pending-count').innerText = pendingOrders.length;

  // Alerts: Stock bajo y agotado
  const alertContainer = document.getElementById('overview-stock-alerts');
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= settings.criticalStockThreshold);
  const outOfStock = products.filter(p => p.stock === 0);

  let alertHTML = '';
  if (outOfStock.length > 0) {
    alertHTML += outOfStock.map(p => `
      <div class="stock-alert-item danger">
        ❌ <strong>Agotado:</strong> El producto <u>${p.name}</u> está en 0 de stock. Oculto de la app de clientes.
      </div>
    `).join('');
  }
  if (lowStock.length > 0) {
    alertHTML += lowStock.map(p => `
      <div class="stock-alert-item warning">
        ⚠️ <strong>Inventario Bajo:</strong> El producto <u>${p.name}</u> tiene solo ${p.stock} unidades.
      </div>
    `).join('');
  }
  if (lowStock.length === 0 && outOfStock.length === 0) {
    alertHTML = `<p class="empty-alerts">Todo en orden con el inventario 🌸</p>`;
  }
  alertContainer.innerHTML = alertHTML;

  // Draw chart of Sales by Payment Method
  renderSalesChart(orders);
}

// Analytics Sales Bar Chart Render using Canvas
function renderSalesChart(orders) {
  const canvas = document.getElementById('analytics-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Clear and resize canvas
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = 180;

  // Data aggregations
  let totalContado = 0;
  let totalCredito = 0;
  orders.forEach(o => {
    if (o.paymentMethod === 'credito') totalCredito += o.total;
    else totalContado += o.total;
  });

  const maxVal = Math.max(totalContado, totalCredito, 100);
  const chartHeight = 120;
  const marginY = 30;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Contado Bar
  const barWidth = 80;
  const hContado = (totalContado / maxVal) * chartHeight;
  ctx.fillStyle = '#10b981'; // Mint Green
  ctx.fillRect(50, canvas.height - hContado - marginY, barWidth, hContado);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Contado: $${totalContado}`, 50 + barWidth/2, canvas.height - hContado - marginY - 8);
  ctx.fillText('Contado', 50 + barWidth/2, canvas.height - marginY + 16);

  // Credito Bar
  const hCredito = (totalCredito / maxVal) * chartHeight;
  ctx.fillStyle = '#8b5cf6'; // Orchid Violet
  ctx.fillRect(180, canvas.height - hCredito - marginY, barWidth, hCredito);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Crédito: $${totalCredito}`, 180 + barWidth/2, canvas.height - hCredito - marginY - 8);
  ctx.fillText('Crédito', 180 + barWidth/2, canvas.height - marginY + 16);
}

// Admin Tab: Products CRUD
function renderAdminProducts() {
  const products = AppDB.get('products') || [];
  const listEl = document.getElementById('admin-products-table-body');
  if (!listEl) return;

  listEl.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image}" class="table-prod-img" alt="${p.name}"></td>
      <td><strong>${p.name}</strong><br><small class="text-muted">${p.category}</small></td>
      <td>$${p.price.toFixed(2)}</td>
      <td>
        <span class="stock-display ${p.stock === 0 ? 'empty' : (p.stock <= 5 ? 'low' : 'ok')}">
          ${p.stock} pz
        </span>
      </td>
      <td>
        <button class="btn-action-sm edit" onclick="openEditProductModal(${p.id})">Editar</button>
        <button class="btn-action-sm delete" onclick="deleteProduct(${p.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

window.openAddProductModal = function() {
  state.editingProduct = null;
  fillProductCategorySelect();
  document.getElementById('product-modal-title').innerText = 'Nuevo Producto 🌸';
  document.getElementById('prod-form-id').value = '';
  document.getElementById('prod-form-name').value = '';
  document.getElementById('prod-form-price').value = '';
  document.getElementById('prod-form-stock').value = '';
  
  const cats = AppDB.get('categories') || [];
  if (cats.length > 0) {
    document.getElementById('prod-form-category').value = cats[0];
  }
  
  document.getElementById('prod-form-image-preview').style.backgroundImage = '';
  document.getElementById('prod-form-image-data').value = '';

  openModal('admin-product-modal');
};

window.openEditProductModal = function(id) {
  const products = AppDB.get('products');
  const p = products.find(prod => prod.id == id);
  if (!p) return;

  state.editingProduct = p;
  fillProductCategorySelect();
  document.getElementById('product-modal-title').innerText = 'Editar Producto 📝';
  document.getElementById('prod-form-id').value = p.id;
  document.getElementById('prod-form-name').value = p.name;
  document.getElementById('prod-form-price').value = p.price;
  document.getElementById('prod-form-stock').value = p.stock;
  document.getElementById('prod-form-category').value = p.category;
  document.getElementById('prod-form-image-preview').style.backgroundImage = `url(${p.image})`;
  document.getElementById('prod-form-image-data').value = p.image;

  openModal('admin-product-modal');
};

// Handle admin image uploads
window.handleProductImageUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    document.getElementById('prod-form-image-preview').style.backgroundImage = `url(${base64})`;
    document.getElementById('prod-form-image-data').value = base64;
  };
  reader.readAsDataURL(file);
};

window.saveProduct = function(e) {
  e.preventDefault();
  const id = document.getElementById('prod-form-id').value;
  const name = document.getElementById('prod-form-name').value.trim();
  const price = parseFloat(document.getElementById('prod-form-price').value);
  const stock = parseInt(document.getElementById('prod-form-stock').value);
  const category = document.getElementById('prod-form-category').value;
  let image = document.getElementById('prod-form-image-data').value;

  if (!image) {
    // Default image if empty
    image = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300';
  }

  const products = AppDB.get('products') || [];

  if (id) {
    // Edit
    const index = products.findIndex(p => p.id == id);
    if (index !== -1) {
      products[index] = { id: parseInt(id), name, price, stock, category, image };
    }
  } else {
    // Create new
    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: nextId, name, price, stock, category, image });
  }

  AppDB.set('products', products);
  closeModal('admin-product-modal');
  renderAdminProducts();
  renderCatalog();
};

window.deleteProduct = function(id) {
  if (confirm("¿Estás seguro de eliminar este producto del inventario?")) {
    let products = AppDB.get('products') || [];
    products = products.filter(p => p.id != id);
    AppDB.set('products', products);
    renderAdminProducts();
    renderCatalog();
  }
};

// Admin Tab: Orders Management
function renderAdminOrders() {
  const orders = AppDB.get('orders') || [];
  const listEl = document.getElementById('admin-orders-table-body');
  if (!listEl) return;

  const filtered = orders.filter(o => o.status === state.ordersFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">No hay pedidos en esta sección.</td></tr>`;
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const formattedDate = new Date(o.date).toLocaleDateString() + ' ' + new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusLabels = {
      pendiente: '<span class="badge-status pending">Pendiente</span>',
      completado: '<span class="badge-status completed">Completado</span>',
      cancelado: '<span class="badge-status cancelled">Cancelado</span>'
    };

    return `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td>
          ${o.clientName}
          ${o.clientAlias ? `<br><span style="font-size:0.75rem; color:var(--primary); font-weight:600;">(${o.clientAlias})</span>` : ''}
          <br><small>${o.city}</small>
        </td>
        <td>${formattedDate}</td>
        <td>$${o.total.toFixed(2)}<br><small class="text-muted">${o.paymentMethod.toUpperCase()}</small></td>
        <td>${statusLabels[o.status] || o.status}</td>
        <td>
          <button class="btn-action-sm view" onclick="viewOrderDetails('${o.id}')">Ver Detalle</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterAdminOrders = function(status) {
  state.ordersFilter = status;
  
  const btnPending = document.getElementById('btn-order-filter-pendiente');
  const btnCompleted = document.getElementById('btn-order-filter-completado');
  const btnCancelled = document.getElementById('btn-order-filter-cancelado');
  
  if (btnPending && btnCompleted && btnCancelled) {
    const inactiveStyle = "background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-primary);";
    const activeStyle = "background: var(--primary-glow); color: white; border: none;";
    
    btnPending.style = status === 'pendiente' ? activeStyle : inactiveStyle;
    btnCompleted.style = status === 'completado' ? activeStyle : inactiveStyle;
    btnCancelled.style = status === 'cancelado' ? activeStyle : inactiveStyle;
  }

  const btnPrint = document.getElementById('btn-print-pending-orders');
  const btnDelete = document.getElementById('btn-delete-completed-orders');
  if (btnPrint && btnDelete) {
    if (status === 'pendiente') {
      btnPrint.style.display = 'block';
      btnDelete.style.display = 'none';
    } else if (status === 'completado') {
      btnPrint.style.display = 'none';
      btnDelete.style.display = 'block';
    } else {
      btnPrint.style.display = 'none';
      btnDelete.style.display = 'none';
    }
  }
  
  renderAdminOrders();
};

window.deleteCompletedOrders = function() {
  const orders = AppDB.get('orders') || [];
  const completedOrders = orders.filter(o => o.status === 'completado');
  
  if (completedOrders.length === 0) {
    alert("No hay pedidos completados para eliminar.");
    return;
  }
  
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente los ${completedOrders.length} pedidos completados? Esta acción se sincronizará con la base de datos.`)) {
    return;
  }
  
  const remaining = orders.filter(o => o.status !== 'completado');
  AppDB.set('orders', remaining);
  showToast(`Se eliminaron ${completedOrders.length} pedidos completados`);
  renderAdminOrders();
};

function sendWhatsAppTicket(orderId) {
  const o = AppDB.get('orders').find(x => x.id === orderId);
  if (!o) return;
  const adminPhone = "526861234567"; // Set your admin phone here
  const text = `Hola, acabo de realizar el pedido #${o.id} por $${o.total.toFixed(2)}.`;
  window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

// === CLIENT ORDER DETAIL VIEWER ===
window.viewClientOrderDetail = function(orderId) {
  const orders = AppDB.get('orders') || [];
  const order = orders.find(o => o.id == orderId);
  
  if (!order) {
    alert("No se encontró el detalle de este pedido.");
    return;
  }
  
  document.getElementById('client-order-detail-id').innerText = order.id;
  
  const itemsContainer = document.getElementById('client-order-detail-items');
  itemsContainer.innerHTML = '';
  
  order.items.forEach(item => {
    itemsContainer.innerHTML += `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">
        <span>${item.qty}x ${item.name}</span>
        <span>$${(item.price * item.qty).toFixed(2)}</span>
      </div>
    `;
  });
  
  itemsContainer.innerHTML += `
    <div style="display: flex; justify-content: space-between; padding-top: 8px; font-weight: bold; color: var(--primary);">
      <span>TOTAL</span>
      <span>$${order.total.toFixed(2)}</span>
    </div>
  `;
  
  openModal('client-order-detail-modal');
};

window.viewOrderDetails = function(id) {
  const orders = AppDB.get('orders');
  const o = orders.find(ord => ord.id === id);
  if (!o) return;

  state.selectedOrder = o;
  
  // Set modal details
  document.getElementById('order-detail-id').innerText = o.id;
  document.getElementById('order-edit-name').value = o.clientName;
  document.getElementById('order-edit-phone').value = o.phone;
  document.getElementById('order-edit-city').value = o.city;
  document.getElementById('order-edit-total').value = o.total;
  document.getElementById('order-edit-payment').value = o.paymentMethod || 'pedido';

  document.getElementById('order-detail-items').innerHTML = o.items.map(it => `
    <div class="order-detail-row" style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">
      <span>${it.name} (x${it.qty})</span>
      <span>$${(it.price * it.qty).toFixed(2)}</span>
    </div>
  `).join('');

  const selectStatus = document.getElementById('order-status-selector');
  selectStatus.value = o.status;

  openModal('admin-order-detail-modal');
};

window.saveOrderChanges = function(e) {
  e.preventDefault();
  if (!state.selectedOrder) return;

  const orders = AppDB.get('orders');
  const index = orders.findIndex(ord => ord.id === state.selectedOrder.id);
  if (index !== -1) {
    orders[index].clientName = document.getElementById('order-edit-name').value.trim();
    orders[index].phone = document.getElementById('order-edit-phone').value.trim();
    orders[index].city = document.getElementById('order-edit-city').value.trim();
    orders[index].total = parseFloat(document.getElementById('order-edit-total').value);
    orders[index].paymentMethod = document.getElementById('order-edit-payment').value;
    orders[index].status = document.getElementById('order-status-selector').value;

    AppDB.set('orders', orders);
    closeModal('admin-order-detail-modal');
    renderAdminOrders();
  }
};

window.deleteOrder = function() {
  if (!state.selectedOrder) return;
  if (confirm(`¿Estás seguro de que deseas eliminar el pedido #${state.selectedOrder.id}? Esta acción no se puede deshacer.`)) {
    const orders = AppDB.get('orders');
    const filteredOrders = orders.filter(ord => ord.id !== state.selectedOrder.id);
    AppDB.set('orders', filteredOrders);
    closeModal('admin-order-detail-modal');
    renderAdminOrders();
  }
};

// Admin Tab: Users & Credits Ledger
function renderAdminUsers() {
  const users = AppDB.get('users') || [];
  const listEl = document.getElementById('admin-users-table-body');
  if (!listEl) return;

  listEl.innerHTML = users.map(u => `
    <tr>
      <td>
        <strong>${u.name}</strong>
        ${u.alias ? `<br><span style="font-size:0.75rem; color:var(--primary); font-weight:600;">(${u.alias})</span>` : ''}
      </td>
      <td>${u.email}<br><small>${u.phone}</small></td>
      <td>
        Límite: $${(u.creditLimit || 0).toFixed(2)}<br>
        Deuda: $${u.debt.toFixed(2)}
      </td>
      <td>
        <button class="btn-action-sm edit" onclick="openCreditLogModal('${u.id}')">Abono/Cargo/Límite</button>
        <button class="btn-action-sm delete" style="background: rgba(248,113,113,0.1); color: var(--danger); border: 1px solid var(--danger); margin-left: 6px;" onclick="deleteUser('${u.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

window.deleteUser = function(userId) {
  if (confirm("¿Estás seguro de que deseas eliminar este cliente? Se borrarán sus datos y su historial de crédito.")) {
    let users = AppDB.get('users') || [];
    users = users.filter(u => u.id !== userId);
    AppDB.set('users', users);
    
    // Si el usuario eliminado tiene la sesión activa de cliente, cerrarla
    if (state.currentUser && state.currentUser.id === userId) {
      logoutUser();
    }
    
    renderAdminUsers();
  }
};

let activeCreditUserId = null;
window.openCreditLogModal = function(userId) {
  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === userId);
  if (!u) return;

  activeCreditUserId = userId;
  document.getElementById('credit-user-name').innerText = u.name;
  document.getElementById('credit-user-limit').innerText = (u.creditLimit || 0).toFixed(2);
  document.getElementById('credit-user-debt').innerText = u.debt.toFixed(2);
  document.getElementById('credit-amount').value = '';
  document.getElementById('credit-description').value = '';
  document.getElementById('credit-limit-input').value = u.creditLimit || 0;

  renderAdminCreditHistoryList(userId);
  openModal('admin-credit-ledger-modal');
};

window.saveCreditTransaction = function(e) {
  e.preventDefault();
  if (!activeCreditUserId) return;

  const type = document.getElementById('credit-trans-type').value; // 'abono', 'cargo'
  const amount = parseFloat(document.getElementById('credit-amount').value);
  const desc = document.getElementById('credit-description').value.trim() || (type === 'abono' ? 'Abono registrado' : 'Deuda cargada');

  if (isNaN(amount) || amount <= 0) {
    alert("Ingresa un monto válido mayor a 0.");
    return;
  }

  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === activeCreditUserId);
  if (u) {
    if (type === 'abono') {
      u.debt = Math.max(0, u.debt - amount);
    } else {
      u.debt += amount;
    }

    u.creditHistory.push({
      type: type === 'abono' ? 'abono' : 'deuda',
      amount,
      date: new Date().toISOString().split('T')[0],
      description: desc
    });

    AppDB.set('users', users);
    
    // UI Updates
    document.getElementById('credit-user-debt').innerText = u.debt.toFixed(2);
    document.getElementById('credit-amount').value = '';
    document.getElementById('credit-description').value = '';
    
    renderAdminCreditHistoryList(activeCreditUserId);
    renderAdminUsers();
    
    showToast("Movimiento Registrado ✓");
  }
};

window.updateCreditLimitOnly = function() {
  if (!activeCreditUserId) return;
  const newLimit = parseFloat(document.getElementById('credit-limit-input').value);
  if (isNaN(newLimit) || newLimit < 0) {
    alert("Ingresa un monto de límite válido mayor o igual a 0.");
    return;
  }

  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === activeCreditUserId);
  if (u) {
    u.creditLimit = newLimit;
    AppDB.set('users', users);

    // Sync active session if edited currently logged user
    if (state.currentUser && state.currentUser.id === activeCreditUserId) {
      state.currentUser = u;
      localStorage.setItem('flowers_active_session', JSON.stringify(u));
      toggleProfileLogin();
    }

    closeModal('admin-credit-ledger-modal');
    renderAdminUsers();
    alert(`Límite de crédito de ${u.name} actualizado a $${newLimit.toFixed(2)} ⚙️`);
  }
};


// Admin Tab: Settings Toggle
function renderAdminSettings() {
  const settings = AppDB.get('settings') || {};
  document.getElementById('settings-games-toggle').checked = settings.gamesEnabled;
  document.getElementById('settings-stock-limit').value = settings.criticalStockThreshold;
}

window.saveAdminSettings = function(e) {
  e.preventDefault();
  const gamesEnabled = document.getElementById('settings-games-toggle').checked;
  const criticalStockThreshold = parseInt(document.getElementById('settings-stock-limit').value);

  const settings = { gamesEnabled, criticalStockThreshold };
  AppDB.set('settings', settings);

  alert("Configuración guardada exitosamente 🌸");
  renderCatalog();
};

window.showToast = function(msg) {
  const toast = document.getElementById('admin-toast-notification');
  if (toast) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
};

window.renderAdminCreditHistoryList = function(userId) {
  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === userId);
  const container = document.getElementById('admin-credit-history-list');
  if (!u || !container) return;

  if (u.creditHistory.length === 0) {
    container.innerHTML = '<p style="text-align:center; font-size: 0.8rem; color: var(--text-secondary);">No hay movimientos registrados</p>';
    return;
  }

  // Reverse para mostrar los más recientes arriba
  const listHtml = [...u.creditHistory].reverse().map((h, reversedIndex) => {
    const originalIndex = u.creditHistory.length - 1 - reversedIndex;
    return `
    <div class="admin-history-item">
      <div class="admin-history-item-info">
        <span class="date">${h.date}</span>
        <span class="desc">${h.description}</span>
        <span class="amt ${h.type === 'abono' ? 'abono' : 'deuda'}">
          ${h.type === 'deuda' ? 'Cargo: +' : 'Abono: -'}$${h.amount.toFixed(2)}
        </span>
      </div>
      <div class="admin-history-actions">
        <button onclick="editCreditTransaction('${u.id}', ${originalIndex})" title="Editar">✏️</button>
        <button class="btn-delete" onclick="deleteCreditTransaction('${u.id}', ${originalIndex})" title="Eliminar">🗑️</button>
      </div>
    </div>
  `}).join('');
  
  container.innerHTML = listHtml;
};

window.deleteCreditTransaction = function(userId, index) {
  if(!confirm('¿Estás seguro de que deseas eliminar este movimiento? Esto recalculará la deuda.')) return;
  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === userId);
  if (!u) return;

  const h = u.creditHistory[index];
  if (h.type === 'abono') {
    u.debt += h.amount; // deshacer abono
  } else {
    u.debt = Math.max(0, u.debt - h.amount); // deshacer cargo
  }

  u.creditHistory.splice(index, 1);
  AppDB.set('users', users);
  
  document.getElementById('credit-user-debt').innerText = u.debt.toFixed(2);
  renderAdminCreditHistoryList(userId);
  renderAdminUsers();
  showToast("Movimiento Eliminado");
};

window.editCreditTransaction = function(userId, index) {
  const users = AppDB.get('users');
  const u = users.find(usr => usr.id === userId);
  if (!u) return;

  const h = u.creditHistory[index];
  const newAmount = parseFloat(prompt(`Ingresa el nuevo monto para "${h.description}"`, h.amount));
  
  if (isNaN(newAmount) || newAmount <= 0) return;

  // Deshacer impacto anterior
  if (h.type === 'abono') u.debt += h.amount;
  else u.debt = Math.max(0, u.debt - h.amount);

  // Aplicar nuevo impacto
  h.amount = newAmount;
  if (h.type === 'abono') u.debt = Math.max(0, u.debt - h.amount);
  else u.debt += h.amount;

  AppDB.set('users', users);
  
  document.getElementById('credit-user-debt').innerText = u.debt.toFixed(2);
  renderAdminCreditHistoryList(userId);
  renderAdminUsers();
  showToast("Movimiento Actualizado");
};

// === CATEGORIES MANAGEMENT ===
window.openCategoriesModal = function() {
  renderAdminCategoriesList();
  openModal('admin-categories-modal');
};

window.renderAdminCategoriesList = function() {
  const cats = AppDB.get('categories') || [];
  const listEl = document.getElementById('admin-categories-list');
  if (!listEl) return;
  
  if (cats.length === 0) {
    listEl.innerHTML = '<p style="text-align:center; font-size: 0.8rem; color: var(--text-secondary);">No hay categorías. Crea una.</p>';
    return;
  }
  
  listEl.innerHTML = cats.map((cat, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.02);">
      <span style="font-weight: 500;">${cat}</span>
      <button class="btn-delete" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='var(--danger)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'" onclick="deleteCategory(${index})" title="Eliminar">🗑️</button>
    </div>
  `).join('');
};

window.saveNewCategory = function(e) {
  e.preventDefault();
  const input = document.getElementById('new-category-name');
  const catName = input.value.trim();
  if (!catName) return;
  
  const cats = AppDB.get('categories') || [];
  if (!cats.map(c => c.toLowerCase()).includes(catName.toLowerCase())) {
    cats.push(catName);
    AppDB.set('categories', cats);
    input.value = '';
    renderAdminCategoriesList();
    renderCategoryFilters();
    showToast("Categoría añadida ✓");
  } else {
    alert("Esta categoría ya existe.");
  }
};

window.deleteCategory = function(index) {
  if (!confirm('¿Seguro que deseas eliminar esta categoría? (Los productos seguirán existiendo pero podrías no verlos si su categoría no existe)')) return;
  
  const cats = AppDB.get('categories') || [];
  cats.splice(index, 1);
  AppDB.set('categories', cats);
  
  renderAdminCategoriesList();
  renderCategoryFilters();
  showToast("Categoría eliminada ✓");
};

function fillProductCategorySelect() {
  const select = document.getElementById('prod-form-category');
  if (!select) return;
  const cats = AppDB.get('categories') || [];
  select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// --- SYSTEM MODAL TRIGGERS ---
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('visible');
    // If it is the cart modal, render details
    if (id === 'cart-modal') {
      renderCartModalContent();
    }
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('visible');
  }
};

// Switch global Role View
window.switchView = function(view) {
  if (view === 'admin') {
    const isAuth = localStorage.getItem('flowers_admin_authenticated') === 'true';
    if (!isAuth) {
      openModal('admin-login-modal');
      return;
    }
  }

  state.currentView = view;
  const clientView = document.getElementById('client-app-view');
  const adminView = document.getElementById('admin-app-view');
  const wrapper = document.getElementById('app-viewport-wrapper');

  if (view === 'admin') {
    clientView.style.display = 'none';
    adminView.style.display = 'flex';
    if (wrapper) wrapper.classList.add('admin-mode');
    switchAdminTab('overview');
  } else {
    clientView.style.display = 'flex';
    adminView.style.display = 'none';
    if (wrapper) wrapper.classList.remove('admin-mode');
    
    // Clear hash if we switch back
    if (window.location.hash === '#admin') {
      // Use history to replace state without triggering hashchange again
      history.replaceState(null, null, ' ');
    }
    
    // Refresh client catalog
    renderCatalog();
    renderCategoryFilters();
    updateGlobalCartBar();
    toggleProfileLogin();
  }
};

window.loginAdmin = function(e) {
  e.preventDefault();
  const userInput = document.getElementById('admin-user-input').value.trim();
  const passInput = document.getElementById('admin-pass-input').value.trim();

  // Credenciales seguras
  if (userInput === 'admin' && passInput === 'flores2026') {
    localStorage.setItem('flowers_admin_authenticated', 'true');
    closeModal('admin-login-modal');
    document.getElementById('admin-user-input').value = '';
    document.getElementById('admin-pass-input').value = '';
    switchView('admin');
  } else {
    alert("Usuario o contraseña de administrador incorrectos.");
  }
};

window.logoutAdmin = function() {
  localStorage.removeItem('flowers_admin_authenticated');
  switchView('client');
};

// Navigation Tab switcher inside Client App
window.switchClientTab = function(tab) {
  state.clientTab = tab;
  
  // Update footer links
  const footerLinks = document.querySelectorAll('.nav-bar-item');
  footerLinks.forEach(fl => {
    if (fl.dataset.tab === tab) fl.classList.add('active');
    else fl.classList.remove('active');
  });

  // Show selected view wrapper
  const views = document.querySelectorAll('.client-tab-view');
  views.forEach(v => v.style.display = 'none');

  const activeView = document.getElementById(`client-tab-${tab}`);
  if (activeView) activeView.style.display = 'block';

  // Specific renders
  if (tab === 'catalog') {
    renderCatalog();
    renderCategoryFilters();
  } else if (tab === 'profile') {
    toggleProfileLogin();
  } else if (tab === 'game') {
    renderGameTab();
  }
};

// --- PWA INSTALLATION PROMPT LOGIC ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const isDismissed = sessionStorage.getItem('flowers_pwa_dismissed') === 'true';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  
  if (!isDismissed && !isStandalone) {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.classList.add('visible');
    }
  }
});

window.triggerPwaInstall = function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    deferredPrompt = null;
    hidePwaBanner();
  });
};

window.dismissPwaInstall = function() {
  sessionStorage.setItem('flowers_pwa_dismissed', 'true');
  hidePwaBanner();
};

function hidePwaBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('visible');
  }
}

window.addEventListener('appinstalled', (evt) => {
  hidePwaBanner();
});

window.printPendingOrders = function() {
  const orders = AppDB.get('orders') || [];
  const pending = orders.filter(o => o.status === 'pendiente');
  if (pending.length === 0) {
    alert("No hay pedidos pendientes para imprimir.");
    return;
  }
  const users = AppDB.get('users') || [];

  // Create print area element if it doesn't exist
  let printArea = document.getElementById('print-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area';
    document.body.appendChild(printArea);
  }

  let totalGral = 0;
  let html = `
    <div class="print-header">
      <h1>REPORTE DE PEDIDOS PENDIENTES</h1>
      <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-MX')}</p>
      <p><strong>Total de pedidos pendientes:</strong> ${pending.length}</p>
    </div>
  `;

  pending.forEach(o => {
    const user = users.find(u => u.name === o.clientName || u.phone === o.phone);
    const alias = o.clientAlias || (user ? user.alias : '') || 'Sin alias';
    totalGral += o.total;

    html += `
      <div class="print-order-card">
        <div class="print-order-info">
          <h3>📦 PEDIDO #${o.id}</h3>
          <p><strong>Cliente:</strong> ${o.clientName}</p>
          <p><strong>Alias:</strong> ${alias}</p>
          <p><strong>Ciudad:</strong> ${o.city} | <strong>Teléfono:</strong> ${o.phone}</p>
        </div>
        <table class="print-items-table">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Producto</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${o.items.map(it => `
              <tr>
                <td>${it.qty} pz</td>
                <td>${it.name}</td>
                <td>$${it.price.toFixed(2)}</td>
                <td>$${(it.price * it.qty).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="print-order-total-row">
              <td colspan="3" style="text-align: right; font-weight: bold;">Total Pedido #${o.id}:</td>
              <td style="font-weight: bold;">$${o.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });

  html += `
    <div class="print-footer">
      <h2>📊 RESUMEN GENERAL DE IMPRESIÓN</h2>
      <p><strong>Cantidad de Pedidos:</strong> ${pending.length} pendientes</p>
      <p class="print-grand-total"><strong>Monto Total General:</strong> $${totalGral.toFixed(2)}</p>
    </div>
  `;

  printArea.innerHTML = html;
  window.print();
};

// Initial document triggers
function initializeApp() {
  // Sync view states based on URL path/hash/search parameter
  const isAdminRoute = window.location.hash === '#admin' || 
                       window.location.search.includes('admin') || 
                       window.location.pathname.endsWith('/admin');
  
  if (isAdminRoute) {
    switchView('admin');
  } else {
    switchView('client');
  }
  switchClientTab('catalog');

  // Monitor url hash changes to open admin if #admin is typed
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') {
      switchView('admin');
    }
  });
  
  // Global listener for reactive sync
  window.addEventListener('db_updated', () => {
    // When DB is updated externally (e.g. syncFromCloud), sync ALL visual elements
    if (state.currentView === 'client') {
      if (state.clientTab === 'catalog') {
        renderCatalog();
        renderCategoryFilters();
      }
      if (state.clientTab === 'profile') toggleProfileLogin();
      if (state.clientTab === 'game') renderGameTab();
    } else {
      if (state.adminTab === 'overview') renderAdminOverview();
      if (state.adminTab === 'products') renderAdminProducts();
      if (state.adminTab === 'orders') renderAdminOrders();
      if (state.adminTab === 'users') renderAdminUsers();
      if (state.adminTab === 'settings') renderAdminSettings();
      // Refresh category list if the modal is open
      renderAdminCategoriesList();
    }
  });

  // Cross-tab synchronization via local storage event
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('flowers_')) {
      if (state.currentUser) {
        const users = AppDB.get('users') || [];
        const refreshed = users.find(usr => usr.id === state.currentUser.id);
        if (refreshed) {
          state.currentUser = refreshed;
          localStorage.setItem('flowers_active_session', JSON.stringify(refreshed));
        }
      }
      window.dispatchEvent(new Event('db_updated'));
    }
  });

  // Swipe gestures to switch categories on mobile
  const catalogContainer = document.getElementById('client-product-list');
  if (catalogContainer) {
    let touchStartX = 0;
    let touchStartY = 0;

    catalogContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    catalogContainer.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Detect horizontal swipe gesture
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
        const products = AppDB.get('products') || [];
        const categories = ['todas', ...new Set(products.map(p => p.category))];
        const currentIndex = categories.indexOf(state.selectedCategory);

        if (diffX < 0) {
          // Swiped Left -> Next category
          const nextIndex = (currentIndex + 1) % categories.length;
          selectCategory(categories[nextIndex]);
        } else {
          // Swiped Right -> Previous category
          const prevIndex = (currentIndex - 1 + categories.length) % categories.length;
          selectCategory(categories[prevIndex]);
        }
      }
    }, { passive: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
