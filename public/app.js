/* ==========================================================================
   BATDONGSAN PRO - FRONTEND APPLICATION LOGIC
   ========================================================================== */

const API_BASE = '/api';
let currentUser = null;
let propertiesList = [];
let favoritesList = [];
let currentDetailProp = null;
let detailMapInstance = null;

// Currency Formatter (e.g. 2.2 tỷ VNĐ, 850 triệu VNĐ)
function formatPrice(price) {
  if (!price || isNaN(price)) return 'Thỏa thuận';
  if (price >= 1000000000) {
    const bill = price / 1000000000;
    return `${Number.isInteger(bill) ? bill : bill.toFixed(2)} tỷ`;
  }
  if (price >= 1000000) {
    const mill = price / 1000000;
    return `${Number.isInteger(mill) ? mill : mill.toFixed(0)} triệu`;
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// API Fetch Helper with Authorization Header
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Có lỗi xảy ra');
    }
    return data;
  } catch (err) {
    console.error(`API Error (${endpoint}):`, err);
    throw err;
  }
}

// APP INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadProperties();
  updateFavoritesCount();
  updateChatUnreadBadge();
});

// CHECK AUTHENTICATION STATUS
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    updateAuthUI(null);
    return;
  }

  try {
    const user = await fetchAPI('/auth/me');
    currentUser = user;
    updateAuthUI(user);
    updateChatUnreadBadge();
    if (user.role === 'admin') {
      switchView('admin');
    }
  } catch (err) {
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthUI(null);
  }
}

function updateAuthUI(user) {
  const guestActions = document.getElementById('guest-actions');
  const userActions = document.getElementById('user-actions');
  const navCatalog = document.getElementById('nav-catalog');
  const navFavorites = document.getElementById('nav-favorites');
  const navChat = document.getElementById('nav-chat');
  const navMyProps = document.getElementById('nav-my-props');
  const navAdmin = document.getElementById('nav-admin');
  const btnPost = document.querySelector('.btn-post');
  const dropdownMyPropsLink = document.getElementById('dropdown-my-props-link');
  const dropdownAdminLink = document.getElementById('dropdown-admin-link');

  if (user) {
    guestActions.style.display = 'none';
    userActions.style.display = 'flex';

    document.getElementById('user-avatar-img').src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    document.getElementById('user-display-name').textContent = user.name;
    document.getElementById('user-dropdown-email').textContent = user.email;

    const roleBadge = document.getElementById('user-role-badge');
    if (user.role === 'admin') {
      roleBadge.textContent = 'Quản trị viên (Admin)';
      roleBadge.style.background = '#fef3c7';
      roleBadge.style.color = '#d97706';

      // Admin mode
      if (navCatalog) navCatalog.style.display = 'flex';
      if (navFavorites) navFavorites.style.display = 'flex';
      if (navChat) navChat.style.display = 'flex';
      if (navMyProps) navMyProps.style.display = 'none';
      if (btnPost) btnPost.style.display = 'inline-flex';
      if (navAdmin) navAdmin.style.display = 'flex';
      if (dropdownMyPropsLink) dropdownMyPropsLink.style.display = 'none';
      if (dropdownAdminLink) dropdownAdminLink.style.display = 'flex';
      const mobNavPost = document.getElementById('mob-nav-post');
      if (mobNavPost) mobNavPost.style.display = 'flex';
    } else {
      roleBadge.textContent = 'Thành viên';
      roleBadge.style.background = '#dbeafe';
      roleBadge.style.color = '#2563eb';

      if (navCatalog) navCatalog.style.display = 'flex';
      if (navFavorites) navFavorites.style.display = 'flex';
      if (navChat) navChat.style.display = 'flex';
      if (navMyProps) navMyProps.style.display = 'none';
      if (btnPost) btnPost.style.display = 'none';
      if (navAdmin) navAdmin.style.display = 'none';
      if (dropdownMyPropsLink) dropdownMyPropsLink.style.display = 'none';
      if (dropdownAdminLink) dropdownAdminLink.style.display = 'none';
      const mobNavPost = document.getElementById('mob-nav-post');
      if (mobNavPost) mobNavPost.style.display = 'none';
    }
  } else {
    guestActions.style.display = 'flex';
    userActions.style.display = 'none';
    if (navCatalog) navCatalog.style.display = 'flex';
    if (navFavorites) navFavorites.style.display = 'flex';
    if (navChat) navChat.style.display = 'flex';
    if (navMyProps) navMyProps.style.display = 'none';
    if (btnPost) btnPost.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
    if (dropdownMyPropsLink) dropdownMyPropsLink.style.display = 'none';
    if (dropdownAdminLink) dropdownAdminLink.style.display = 'none';
    const mobNavPost = document.getElementById('mob-nav-post');
    if (mobNavPost) mobNavPost.style.display = 'none';
  }
}

function handleLogoClick() {
  if (currentUser && currentUser.role === 'admin') {
    switchView('admin');
  } else {
    switchView('catalog');
  }
}

// NAVIGATION VIEW SWITCHER
function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const navItem = document.getElementById(`nav-${viewName}`);
  if (navItem) navItem.classList.add('active');

  const mobNavItem = document.getElementById(`mob-nav-${viewName}`);
  if (mobNavItem) mobNavItem.classList.add('active');

  if (viewName === 'catalog') {
    loadProperties();
  } else if (viewName === 'favorites') {
    loadFavoritesView();
  } else if (viewName === 'my-properties') {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để xem tin đăng của bạn', 'error');
      openModal('login-modal');
      return;
    }
    loadMyPropertiesView();
  } else if (viewName === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Yêu cầu quyền Quản trị viên (Admin)', 'error');
      switchView('catalog');
      return;
    }
    loadAdminDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// USER DROPDOWN TOGGLE
function toggleUserDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const profileMenu = document.querySelector('.user-profile-menu');
  if (profileMenu && !profileMenu.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('show');
  }
});

// LOGOUT
function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  updateAuthUI(null);
  showToast('Đã đăng xuất thành công', 'info');
  switchView('catalog');
}

// ==========================================
// 1. PROPERTY CATALOG & ADVANCED SEARCH/FILTERS
// ==========================================

async function loadProperties() {
  const keyword = document.getElementById('filter-keyword').value.trim();
  const city = document.getElementById('filter-city').value;
  const type = document.getElementById('filter-type').value;
  const priceRange = document.getElementById('filter-price').value;
  const areaRange = document.getElementById('filter-area').value;

  const params = new URLSearchParams();
  if (keyword) params.append('keyword', keyword);
  if (city !== 'all') params.append('city', city);
  if (type !== 'all') params.append('type', type);

  if (priceRange !== 'all') {
    const [minP, maxP] = priceRange.split('-');
    params.append('min_price', minP);
    params.append('max_price', maxP);
  }

  if (areaRange !== 'all') {
    const [minA, maxA] = areaRange.split('-');
    params.append('min_area', minA);
    params.append('max_area', maxA);
  }

  try {
    const data = await fetchAPI(`/properties?${params.toString()}`);
    propertiesList = data;
    sortAndRenderCatalog();
  } catch (err) {
    showToast('Lỗi khi tải danh sách bất động sản', 'error');
  }
}

function handleSearchKeyup(e) {
  if (e.key === 'Enter') {
    applyFilters();
  }
}

function applyFilters() {
  loadProperties();
}

function applyPresetFilter(city, type, priceRange, areaRange) {
  document.getElementById('filter-keyword').value = '';
  document.getElementById('filter-city').value = city;
  document.getElementById('filter-type').value = type;
  document.getElementById('filter-price').value = priceRange;
  document.getElementById('filter-area').value = areaRange;
  applyFilters();
}

function resetFilters() {
  document.getElementById('filter-keyword').value = '';
  document.getElementById('filter-city').value = 'all';
  document.getElementById('filter-type').value = 'all';
  document.getElementById('filter-price').value = 'all';
  document.getElementById('filter-area').value = 'all';
  applyFilters();
}

function sortAndRenderCatalog() {
  const sortType = document.getElementById('sort-select').value;
  let sorted = [...propertiesList];

  if (sortType === 'price-asc') {
    sorted.sort((a, b) => a.price - b.price);
  } else if (sortType === 'price-desc') {
    sorted.sort((a, b) => b.price - a.price);
  } else if (sortType === 'area-desc') {
    sorted.sort((a, b) => b.area - a.area);
  } else {
    // newest
    sorted.sort((a, b) => b.id - a.id);
  }

  const container = document.getElementById('property-grid');
  const countText = document.getElementById('catalog-count-text');
  
  countText.textContent = `Tìm thấy ${sorted.length} bất động sản phù hợp`;

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px solid #e2e8f0;">
        <i class="fa-solid fa-house-circle-exclamation" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 16px;"></i>
        <h3>Không tìm thấy bất động sản nào</h3>
        <p style="color: #64748b; margin-top: 6px;">Vui lòng thử lại với từ khóa hoặc bộ lọc khác.</p>
        <button class="btn btn-outline" onclick="resetFilters()" style="margin-top: 16px;">
          <i class="fa-solid fa-rotate-left"></i> Đặt lại bộ lọc
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = sorted.map(prop => createPropertyCardHTML(prop)).join('');
}

// RENDER PROPERTY CARD HTML
function createPropertyCardHTML(prop) {
  const imgUrl = Array.isArray(prop.images) && prop.images.length > 0
    ? prop.images[0]
    : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

  const favClass = prop.is_favorite ? 'active' : '';

  return `
    <div class="property-card" onclick="openDetailModal(${prop.id})">
      <div class="card-image-wrapper">
        <img src="${imgUrl}" alt="${prop.title}" class="card-img" loading="lazy">
        <span class="card-type-tag">${prop.type}</span>
        <button class="card-fav-btn ${favClass}" onclick="toggleFavoriteCard(${prop.id}, event)">
          <i class="fa-${prop.is_favorite ? 'solid' : 'regular'} fa-heart"></i>
        </button>
      </div>
      <div class="card-body">
        <div class="card-price-row">
          <span class="card-price">${formatPrice(prop.price)}</span>
          <span class="card-area"><i class="fa-solid fa-ruler-combined"></i> ${prop.area} m²</span>
        </div>
        <h3 class="card-title">${prop.title}</h3>
        <p class="card-location"><i class="fa-solid fa-location-dot"></i> ${prop.district ? prop.district + ', ' : ''}${prop.city}</p>
        <div class="card-footer">
          <div class="card-seller">
            <img src="${prop.seller_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" class="card-seller-avatar">
            <span>${prop.seller_name || 'Người bán'}</span>
          </div>
          <span><i class="fa-solid fa-eye"></i> Xem chi tiết</span>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 2. PROPERTY DETAIL MODAL & LEAFLET MAP
// ==========================================

async function openDetailModal(id) {
  try {
    const prop = await fetchAPI(`/properties/${id}`);
    currentDetailProp = prop;

    document.getElementById('detail-title').textContent = prop.title;
    document.getElementById('detail-address').innerHTML = `<i class="fa-solid fa-location-dot text-danger"></i> ${prop.address}`;
    document.getElementById('detail-price').textContent = formatPrice(prop.price);
    
    const pricePerM2 = Math.round((prop.price / prop.area) / 1000000);
    document.getElementById('detail-price-per-m2').textContent = `~${pricePerM2} triệu/m²`;
    document.getElementById('detail-area').textContent = `${prop.area} m²`;
    document.getElementById('detail-type-badge').textContent = prop.type;
    document.getElementById('detail-description').textContent = prop.description;

    // Seller Info & Phone Call Link
    document.getElementById('detail-seller-name').textContent = prop.seller_name;
    document.getElementById('detail-seller-avatar').src = prop.seller_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    document.getElementById('detail-phone-num').textContent = prop.phone;
    document.getElementById('detail-phone-btn').href = `tel:${prop.phone}`;

    // Favorite Button state
    const favBtn = document.getElementById('detail-fav-btn');
    if (prop.is_favorite) {
      favBtn.className = 'btn btn-accent btn-block';
      favBtn.innerHTML = `<i class="fa-solid fa-heart"></i> Đã lưu Yêu thích`;
    } else {
      favBtn.className = 'btn btn-outline btn-block';
      favBtn.innerHTML = `<i class="fa-regular fa-heart"></i> Lưu vào Yêu thích`;
    }

    // Gallery Images Setup
    const images = Array.isArray(prop.images) && prop.images.length > 0
      ? prop.images
      : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80'];

    document.getElementById('detail-main-img').src = images[0];

    const thumbsContainer = document.getElementById('detail-thumbs');
    thumbsContainer.innerHTML = images.map((img, idx) => `
      <img src="${img}" class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="changeMainImage('${img}', this)">
    `).join('');

    openModal('detail-modal');

    // Initialize or Update Leaflet Map after modal opens
    setTimeout(() => {
      initDetailMap(prop.lat || 16.0544, prop.lng || 108.2022, prop.title);
    }, 200);

  } catch (err) {
    showToast('Lỗi khi mở chi tiết bất động sản', 'error');
  }
}

function changeMainImage(url, element) {
  document.getElementById('detail-main-img').src = url;
  document.querySelectorAll('.thumb-img').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
}

function initDetailMap(lat, lng, title) {
  const mapContainer = document.getElementById('detail-map');
  if (!mapContainer) return;

  if (detailMapInstance) {
    detailMapInstance.remove();
    detailMapInstance = null;
  }

  detailMapInstance = L.map('detail-map').setView([lat, lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(detailMapInstance);

  L.marker([lat, lng])
    .addTo(detailMapInstance)
    .bindPopup(`<b>${title}</b>`)
    .openPopup();
}

// ==========================================
// 3. FAVORITES FUNCTIONALITY
// ==========================================

async function toggleFavoriteCard(propId, event) {
  event.stopPropagation();
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để lưu bất động sản yêu thích', 'error');
    openModal('login-modal');
    return;
  }

  try {
    const res = await fetchAPI(`/favorites/${propId}`, { method: 'POST' });
    showToast(res.message, res.is_favorite ? 'success' : 'info');
    
    // Refresh properties and count
    await loadProperties();
    await updateFavoritesCount();

    if (document.getElementById('view-favorites').classList.contains('active')) {
      loadFavoritesView();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleCurrentDetailFavorite() {
  if (!currentDetailProp) return;
  await toggleFavoriteCard(currentDetailProp.id, { stopPropagation: () => {} });
  openDetailModal(currentDetailProp.id);
}

async function updateFavoritesCount() {
  const badge = document.getElementById('fav-count');
  const mobBadge = document.getElementById('mob-fav-badge');
  if (!currentUser) {
    if (badge) badge.textContent = '0';
    if (mobBadge) mobBadge.style.display = 'none';
    return;
  }
  try {
    const list = await fetchAPI('/favorites');
    favoritesList = list;
    if (badge) badge.textContent = list.length;
    if (mobBadge) {
      if (list.length > 0) {
        mobBadge.textContent = list.length;
        mobBadge.style.display = 'inline-block';
      } else {
        mobBadge.style.display = 'none';
      }
    }
  } catch (e) {
    if (badge) badge.textContent = '0';
    if (mobBadge) mobBadge.style.display = 'none';
  }
}

async function loadFavoritesView() {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để xem danh sách yêu thích', 'error');
    openModal('login-modal');
    return;
  }

  try {
    const list = await fetchAPI('/favorites');
    const container = document.getElementById('favorites-grid');

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px;">
          <i class="fa-regular fa-heart" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 16px;"></i>
          <h3>Chưa có bất động sản nào trong danh sách yêu thích</h3>
          <p style="color: #64748b; margin-top: 6px;">Hãy khám phá các dự án và nhấn biểu tượng Trái tim để lưu trữ tại đây.</p>
          <button class="btn btn-primary" onclick="switchView('catalog')" style="margin-top: 16px;">Khám phá ngay</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(prop => createPropertyCardHTML(prop)).join('');
  } catch (err) {
    showToast('Lỗi khi tải danh sách yêu thích', 'error');
  }
}

// ==========================================
// 4. MY PROPERTIES & POSTING API
// ==========================================

async function loadMyPropertiesView() {
  try {
    const list = await fetchAPI('/my-properties');
    const container = document.getElementById('my-properties-list');

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 16px;">
          <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 16px;"></i>
          <h3>Bạn chưa đăng tin bất động sản nào</h3>
          <button class="btn btn-primary" onclick="openPostModal()" style="margin-top: 16px;">
            <i class="fa-solid fa-plus"></i> Đăng tin đầu tiên ngay
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => {
      const img = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '';
      let statusText = 'Đã duyệt';
      let statusClass = 'status-approved';
      if (item.status === 'pending') {
        statusText = 'Chờ duyệt';
        statusClass = 'status-pending';
      } else if (item.status === 'rejected') {
        statusText = 'Bị từ chối';
        statusClass = 'status-rejected';
      }

      return `
        <div class="my-property-item">
          <img src="${img}" class="my-prop-thumb">
          <div class="my-prop-info">
            <h4 class="my-prop-title">${item.title}</h4>
            <div class="my-prop-meta">
              <span><strong>Giá:</strong> ${formatPrice(item.price)}</span>
              <span><strong>Diện tích:</strong> ${item.area} m²</span>
              <span><strong>Địa điểm:</strong> ${item.city}</span>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
          <div class="my-prop-actions">
            <button class="btn btn-outline" onclick="openPostModal(${item.id})"><i class="fa-solid fa-pen"></i> Sửa</button>
            <button class="btn btn-outline text-danger" onclick="deleteProperty(${item.id})"><i class="fa-solid fa-trash"></i> Xóa</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    showToast('Lỗi tải bài đăng của tôi', 'error');
  }
}

let selectedPropertyFiles = [];

function handleImageFileSelect(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  files.forEach(file => {
    selectedPropertyFiles.push(file);
  });

  renderImagePreviews();
  e.target.value = '';
}

function renderImagePreviews() {
  const container = document.getElementById('image-preview-container');
  if (!container) return;

  if (selectedPropertyFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedPropertyFiles.map((item, index) => {
    let src = typeof item === 'string' ? item : URL.createObjectURL(item);
    return `
      <div class="preview-thumb-wrapper">
        <img src="${src}" class="preview-thumb-img">
        <button type="button" class="thumb-remove-btn" onclick="removeSelectedImage(${index})">&times;</button>
      </div>
    `;
  }).join('');
}

function removeSelectedImage(index) {
  selectedPropertyFiles.splice(index, 1);
  renderImagePreviews();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedImages() {
  const fileObjects = selectedPropertyFiles.filter(item => typeof item !== 'string');
  const existingUrls = selectedPropertyFiles.filter(item => typeof item === 'string');

  const pastedRaw = document.getElementById('post-images-urls')?.value || '';
  const pastedUrls = pastedRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);

  let uploadedServerUrls = [];

  if (fileObjects.length > 0) {
    uploadedServerUrls = await Promise.all(fileObjects.map(file => readFileAsBase64(file)));
  }

  return [...existingUrls, ...uploadedServerUrls, ...pastedUrls];
}

function openPostModal(editId = null) {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập với tài khoản Admin', 'error');
    openModal('login-modal');
    return;
  }

  if (currentUser.role !== 'admin') {
    showToast('Chỉ Quản trị viên (Admin) mới có quyền đăng hoặc sửa bài bất động sản', 'error');
    return;
  }

  const form = document.getElementById('post-form');
  form.reset();
  document.getElementById('post-id').value = '';
  selectedPropertyFiles = [];
  renderImagePreviews();
  if (document.getElementById('post-images-urls')) document.getElementById('post-images-urls').value = '';

  if (editId) {
    document.getElementById('post-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-accent"></i> Chỉnh Sửa Bài Đăng`;
    const prop = propertiesList.find(p => p.id === editId) || currentDetailProp;
    if (prop) {
      document.getElementById('post-id').value = prop.id;
      document.getElementById('post-title').value = prop.title;
      document.getElementById('post-type').value = prop.type;
      document.getElementById('post-city').value = prop.city;
      document.getElementById('post-price').value = prop.price;
      document.getElementById('post-area').value = prop.area;
      document.getElementById('post-district').value = prop.district || '';
      document.getElementById('post-phone').value = prop.phone;
      document.getElementById('post-address').value = prop.address;
      document.getElementById('post-description').value = prop.description;

      if (Array.isArray(prop.images)) {
        selectedPropertyFiles = [...prop.images];
        renderImagePreviews();
      }
    }
  } else {
    document.getElementById('post-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-accent"></i> Đăng Tin Bất Động Sản Mới`;
    document.getElementById('post-phone').value = currentUser.phone || '';
  }

  openModal('post-modal');
}

async function handlePostSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('post-id').value;

  try {
    showToast('Đang xử lý hình ảnh...', 'info');
    const images = await uploadSelectedImages();

    if (images.length === 0) {
      showToast('Vui lòng chọn hoặc tải lên ít nhất 1 hình ảnh bất động sản', 'error');
      return;
    }

    const payload = {
      title: document.getElementById('post-title').value.trim(),
      type: document.getElementById('post-type').value,
      city: document.getElementById('post-city').value,
      price: Number(document.getElementById('post-price').value),
      area: Number(document.getElementById('post-area').value),
      district: document.getElementById('post-district').value.trim(),
      phone: document.getElementById('post-phone').value.trim(),
      address: document.getElementById('post-address').value.trim(),
      images,
      description: document.getElementById('post-description').value.trim()
    };

    let res;
    if (id) {
      res = await fetchAPI(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await fetchAPI('/properties', { method: 'POST', body: JSON.stringify(payload) });
    }
    showToast(res.message, 'success');
    closeModal('post-modal');
    
    loadProperties();
    if (document.getElementById('view-my-properties').classList.contains('active')) {
      loadMyPropertiesView();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProperty(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa bài đăng bất động sản này?')) return;
  try {
    const res = await fetchAPI(`/properties/${id}`, { method: 'DELETE' });
    showToast(res.message, 'info');
    loadMyPropertiesView();
    loadProperties();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// 5. ADMIN DASHBOARD & MODERATION
// ==========================================

async function loadAdminDashboard() {
  try {
    const stats = await fetchAPI('/admin/stats');
    if (document.getElementById('stat-total-users')) document.getElementById('stat-total-users').textContent = stats.total_users;
    if (document.getElementById('stat-total-props')) document.getElementById('stat-total-props').textContent = stats.total_properties;
    if (document.getElementById('stat-approved-props')) document.getElementById('stat-approved-props').textContent = stats.approved_properties;
    if (document.getElementById('mod-pending-count')) document.getElementById('mod-pending-count').textContent = stats.total_properties;

    loadAdminModerationTable();
    loadAdminUsersTable();
  } catch (err) {
    showToast('Lỗi khi tải bảng điều khiển Admin', 'error');
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));

  document.getElementById(`tab-btn-${tabName}`).classList.add('active');
  document.getElementById(`admin-tab-${tabName}`).classList.add('active');
}

async function loadAdminModerationTable() {
  try {
    const list = await fetchAPI('/admin/properties');
    const tbody = document.getElementById('admin-moderation-tbody');

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 30px;">Không có bài đăng nào</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const img = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '';
      return `
        <tr>
          <td><strong>#${item.id}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${img}" style="width: 60px; height: 45px; border-radius: 6px; object-fit: cover;">
              <span style="font-weight: 700; max-width: 260px;">${item.title}</span>
            </div>
          </td>
          <td>${item.seller_name}<br><small class="text-muted">${item.seller_email}</small></td>
          <td><strong class="text-primary">${formatPrice(item.price)}</strong><br><small>${item.area} m²</small></td>
          <td>${item.city}</td>
          <td><span class="status-badge status-approved">Hiển thị</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openPostModal(${item.id})"><i class="fa-solid fa-pen-to-square"></i> Sửa</button>
              <button class="btn btn-outline text-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deleteAdminProperty(${item.id})"><i class="fa-solid fa-trash"></i> Xóa</button>
              <button class="btn btn-dark" style="padding: 6px 10px; font-size: 0.8rem;" onclick="openDetailModal(${item.id})"><i class="fa-solid fa-eye"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Lỗi khi tải danh sách bài đăng admin', 'error');
  }
}

async function deleteAdminProperty(id) {
  if (!confirm('Bạn với tư cách Admin có chắc chắn muốn xóa bài đăng bất động sản này?')) return;
  try {
    const res = await fetchAPI(`/properties/${id}`, { method: 'DELETE' });
    showToast(res.message, 'info');
    loadAdminDashboard();
    loadProperties();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAdminUsersTable() {
  try {
    const users = await fetchAPI('/admin/users');
    const tbody = document.getElementById('admin-users-tbody');

    tbody.innerHTML = users.map(user => `
      <tr>
        <td><strong>#${user.id}</strong></td>
        <td>
          <div class="table-user-info">
            <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" class="table-user-avatar">
            <span>${user.name}</span>
          </div>
        </td>
        <td>${user.email}</td>
        <td>${user.phone}</td>
        <td><span class="user-role-badge">${user.role}</span></td>
        <td>
          ${user.role !== 'admin' ? `
            <button class="btn btn-outline text-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deleteUserByAdmin(${user.id})">
              <i class="fa-solid fa-trash"></i> Xóa
            </button>
          ` : '<small class="text-muted">Quản trị viên hệ thống</small>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Lỗi khi tải danh sách người dùng', 'error');
  }
}

async function deleteUserByAdmin(id) {
  if (!confirm('Bạn có chắc muốn xóa tài khoản người dùng này khỏi hệ thống?')) return;
  try {
    const res = await fetchAPI(`/admin/users/${id}`, { method: 'DELETE' });
    showToast(res.message, 'info');
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// 6. AUTHENTICATION & PROFILE MODAL HANDLERS
// ==========================================

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', res.token);
    currentUser = res.user;
    updateAuthUI(res.user);
    showToast(res.message, 'success');
    closeModal('login-modal');
    updateFavoritesCount();
    if (res.user.role === 'admin') {
      switchView('admin');
    } else {
      loadProperties();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function fillDemoLogin(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
}

async function handleRegister(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    password: document.getElementById('reg-password').value,
    avatar: document.getElementById('reg-avatar').value.trim()
  };

  try {
    const res = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('token', res.token);
    currentUser = res.user;
    updateAuthUI(res.user);
    showToast(res.message, 'success');
    closeModal('register-modal');
    loadProperties();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;

  try {
    const res = await fetchAPI('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    showToast(res.message, 'info');
    closeModal('forgot-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let selectedAvatarFile = null;

function handleAvatarFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedAvatarFile = file;
  const previewImg = document.getElementById('prof-avatar-preview');
  if (previewImg) {
    previewImg.src = URL.createObjectURL(file);
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  let avatarUrl = document.getElementById('prof-avatar').value.trim();

  try {
    if (selectedAvatarFile) {
      showToast('Đang xử lý lưu ảnh đại diện...', 'info');
      avatarUrl = await readFileAsBase64(selectedAvatarFile);
    }

    const payload = {
      name: document.getElementById('prof-name').value.trim(),
      phone: document.getElementById('prof-phone').value.trim(),
      avatar: avatarUrl,
      password: document.getElementById('prof-password').value
    };

    const res = await fetchAPI('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('token', res.token);
    currentUser = res.user;
    updateAuthUI(res.user);
    showToast(res.message, 'success');
    closeModal('profile-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal Helpers
function openModal(modalId) {
  if (modalId === 'profile-modal' && currentUser) {
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-email').value = currentUser.email;
    document.getElementById('prof-phone').value = currentUser.phone;
    document.getElementById('prof-avatar').value = currentUser.avatar || '';
    document.getElementById('prof-password').value = '';

    selectedAvatarFile = null;
    const previewImg = document.getElementById('prof-avatar-preview');
    if (previewImg) {
      previewImg.src = currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
    }
  }
  document.getElementById(modalId)?.classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('open');
  if (modalId === 'chat-modal' && chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

function closeModalOnOverlay(e, modalId) {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(modalId);
  }
}

// ==========================================
// 7. REAL-TIME CHAT MESSENGER LOGIC
// ==========================================
let activeConversationId = null;
let chatPollInterval = null;

async function updateChatUnreadBadge() {
  const badge = document.getElementById('chat-unread-badge');
  const mobBadge = document.getElementById('mob-chat-badge');
  if (!currentUser) {
    if (badge) badge.style.display = 'none';
    if (mobBadge) mobBadge.style.display = 'none';
    return;
  }
  try {
    const data = await fetchAPI('/chat/unread-count');
    if (badge) {
      if (data.unread_total > 0) {
        badge.textContent = data.unread_total;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (mobBadge) {
      if (data.unread_total > 0) {
        mobBadge.textContent = data.unread_total;
        mobBadge.style.display = 'inline-block';
      } else {
        mobBadge.style.display = 'none';
      }
    }
  } catch (e) {}
}

async function startChatFromDetail() {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để gửi tin nhắn cho người bán', 'error');
    openModal('login-modal');
    return;
  }

  if (!currentDetailProp) return;

  if (currentDetailProp.user_id === currentUser.id) {
    showToast('Bạn không thể tự nhắn tin cho chính bài đăng của mình', 'error');
    return;
  }

  try {
    const res = await fetchAPI('/chat/start', {
      method: 'POST',
      body: JSON.stringify({
        property_id: currentDetailProp.id,
        seller_id: currentDetailProp.user_id
      })
    });

    closeModal('detail-modal');
    openChatModal(res.conversation_id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openChatModal(targetConvId = null) {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để xem tin nhắn', 'error');
    openModal('login-modal');
    return;
  }

  openModal('chat-modal');
  await loadChatThreads(targetConvId);

  // Auto poll messages every 3 seconds while chat modal is open
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(async () => {
    const chatModal = document.getElementById('chat-modal');
    if (chatModal && chatModal.classList.contains('open')) {
      await loadChatThreads(activeConversationId, true);
      if (activeConversationId) {
        await fetchConversationMessages(activeConversationId, true);
      }
    } else {
      clearInterval(chatPollInterval);
      chatPollInterval = null;
    }
  }, 3000);
}

async function loadChatThreads(autoSelectId = null, silent = false) {
  try {
    const threads = await fetchAPI('/chat/conversations');
    const container = document.getElementById('chat-threads-list');

    if (threads.length === 0) {
      container.innerHTML = `<p style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.9rem;">Chưa có cuộc trò chuyện nào</p>`;
      document.getElementById('chat-header').style.display = 'none';
      document.getElementById('chat-input-bar').style.display = 'none';
      document.getElementById('chat-messages-container').innerHTML = `
        <div class="chat-empty-state">
          <i class="fa-solid fa-comments"></i>
          <p>Nhấn "Chat với người bán" tại bất kỳ bài đăng nào để bắt đầu cuộc trò chuyện.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = threads.map(t => {
      const isMeBuyer = t.buyer_id === currentUser.id;
      const partnerName = isMeBuyer ? t.seller_name : t.buyer_name;
      const partnerAvatar = (isMeBuyer ? t.seller_avatar : t.buyer_avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80';
      const isActive = activeConversationId === t.conversation_id ? 'active' : '';
      const unreadBadge = t.unread_count > 0 ? `<span class="chat-thread-badge">${t.unread_count}</span>` : '';

      return `
        <div class="chat-thread-item ${isActive}" onclick="selectChatThread(${t.conversation_id})">
          <img src="${partnerAvatar}" class="chat-thread-avatar">
          <div class="chat-thread-info">
            <div class="chat-thread-name">${partnerName}</div>
            <div class="chat-thread-prop"><i class="fa-solid fa-building"></i> ${t.property_title}</div>
            <div class="chat-thread-preview">${t.last_message || 'Bắt đầu cuộc trò chuyện...'}</div>
          </div>
          ${unreadBadge}
        </div>
      `;
    }).join('');

    const targetId = autoSelectId || (activeConversationId || threads[0].conversation_id);
    if (targetId && !silent) {
      selectChatThread(targetId);
    }
  } catch (err) {
    if (!silent) showToast('Lỗi khi tải danh sách tin nhắn', 'error');
  }
}

async function selectChatThread(convId) {
  activeConversationId = convId;
  document.querySelectorAll('.chat-thread-item').forEach(el => el.classList.remove('active'));
  await fetchConversationMessages(convId);
  showChatMainOnMobile();
  updateChatUnreadBadge();
}

function showChatMainOnMobile() {
  document.querySelector('.chat-main')?.classList.add('mobile-active');
}

function showChatThreadsOnMobile() {
  document.querySelector('.chat-main')?.classList.remove('mobile-active');
}

function handleMobileUserClick() {
  if (!currentUser) {
    openModal('login-modal');
  } else {
    if (currentUser.role === 'admin') {
      switchView('admin');
    } else {
      openModal('profile-modal');
    }
  }
}

async function fetchConversationMessages(convId, silent = false) {
  try {
    const data = await fetchAPI(`/chat/conversations/${convId}/messages`);
    const conv = data.conversation;
    const messages = data.messages;

    const isMeBuyer = conv.buyer_id === currentUser.id;
    
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('chat-input-bar').style.display = 'flex';

    // Find thread item info for header
    const threads = await fetchAPI('/chat/conversations');
    const threadInfo = threads.find(t => t.conversation_id === Number(convId));
    if (threadInfo) {
      const partnerName = isMeBuyer ? threadInfo.seller_name : threadInfo.buyer_name;
      const partnerAvatar = (isMeBuyer ? threadInfo.seller_avatar : threadInfo.buyer_avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80';

      document.getElementById('chat-partner-name').textContent = partnerName;
      document.getElementById('chat-partner-avatar').src = partnerAvatar;
      document.getElementById('chat-prop-title').textContent = threadInfo.property_title;
      document.getElementById('chat-prop-price').textContent = formatPrice(threadInfo.property_price);
    }

    // Render Messages
    const container = document.getElementById('chat-messages-container');

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="chat-empty-state">
          <i class="fa-solid fa-paper-plane"></i>
          <p>Chưa có tin nhắn nào. Hãy nhập nội dung bên dưới để bắt đầu trao đổi!</p>
        </div>
      `;
      return;
    }

    const html = messages.map(m => {
      const isSentByMe = m.sender_id === currentUser.id;
      const bubbleClass = isSentByMe ? 'msg-sent' : 'msg-received';
      const timeStr = new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="msg-bubble ${bubbleClass}">
          <div>${m.text}</div>
          <span class="msg-time">${timeStr}</span>
        </div>
      `;
    }).join('');

    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 100;
    container.innerHTML = html;

    if (!silent || isScrolledToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    if (!silent) showToast('Lỗi tải tin nhắn', 'error');
  }
}

async function sendChatMessage(e) {
  e.preventDefault();
  if (!activeConversationId) return;

  const input = document.getElementById('chat-input-text');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  try {
    await fetchAPI(`/chat/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    
    await fetchConversationMessages(activeConversationId, true);
    await loadChatThreads(activeConversationId, true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
