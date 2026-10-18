(function () {
  "use strict";

  const FREE_SHIPPING_THRESHOLD = 75;
  const CART_STORAGE_KEY = "linus3dlab-cart-v1";
  const config = window.shopConfig || {};
  let products = Array.isArray(window.shopProducts) ? window.shopProducts : [];
  let cart = loadCart();
  let activeCategory = "All";
  let toastTimer;

  const elements = {
    grid: document.getElementById("product-grid"),
    categories: document.getElementById("categories"),
    search: document.getElementById("product-search"),
    sort: document.getElementById("product-sort"),
    empty: document.getElementById("empty-state"),
    status: document.getElementById("shop-status"),
    clearFilters: document.getElementById("clear-filters"),
    cartOpen: document.getElementById("cart-open"),
    cartClose: document.getElementById("cart-close"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartBackdrop: document.getElementById("drawer-backdrop"),
    cartItems: document.getElementById("cart-items"),
    cartEmpty: document.getElementById("cart-empty"),
    drawerFooter: document.getElementById("drawer-footer"),
    cartCount: document.getElementById("cart-count"),
    drawerItemCount: document.getElementById("drawer-item-count"),
    subtotal: document.getElementById("cart-subtotal"),
    shippingNote: document.getElementById("shipping-note"),
    checkoutOpen: document.getElementById("checkout-open"),
    checkoutDialog: document.getElementById("checkout-dialog"),
    checkoutClose: document.getElementById("checkout-close"),
    checkoutForm: document.getElementById("checkout-form"),
    checkoutTotal: document.getElementById("checkout-total"),
    checkoutNotice: document.getElementById("checkout-notice"),
    checkoutModeNote: document.getElementById("checkout-mode-note"),
    checkoutSubmit: document.getElementById("checkout-submit"),
    toast: document.getElementById("toast")
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function formatPrice(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  }

  function hasSupabaseConfig() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  function supabaseUrl(path) {
    return `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`;
  }

  function supabaseHeaders(extraHeaders) {
    return {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...extraHeaders
    };
  }

  async function fetchProducts() {
    if (!hasSupabaseConfig()) {
      elements.status.textContent = "Preview collection · Connect Supabase to manage live products and orders.";
      return;
    }

    try {
      const response = await fetch(supabaseUrl("products?select=id,name,tagline,description,price,category,image_url,color,featured,is_new,active&active=eq.true&order=featured.desc,name.asc"), {
        headers: supabaseHeaders()
      });
      if (!response.ok) {
        throw new Error(`Product request failed (${response.status}).`);
      }
      const rows = await response.json();
      products = rows.map((product) => ({
        ...product,
        image: product.image_url,
        is_new: Boolean(product.is_new)
      }));
      const availableIds = new Set(products.map((product) => product.id));
      const currentCart = cart.length;
      cart = cart.filter((item) => availableIds.has(item.id));
      if (cart.length !== currentCart) saveCart();
      elements.status.textContent = "";
      renderCategories();
      renderProducts();
      renderCart();
    } catch (error) {
      elements.status.textContent = "Live products couldn't be loaded. Showing the preview collection instead.";
      console.error("Supabase product load failed:", error);
    }
  }

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved
        .filter((item) => item && typeof item.id === "string" && Number.isInteger(item.quantity) && item.quantity > 0)
        .map((item) => ({ id: item.id, quantity: Math.min(item.quantity, 99) }));
    } catch (error) {
      console.error("Could not read the saved shopping bag:", error);
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Could not save the shopping bag:", error);
      showToast("Your bag couldn't be saved on this device.");
    }
  }

  function cartQuantity() {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function cartTotal() {
    return cart.reduce((total, item) => {
      const product = products.find((entry) => entry.id === item.id);
      return total + (product ? Number(product.price) * item.quantity : 0);
    }, 0);
  }

  function renderCategories() {
    const categories = ["All", ...new Set(products.map((product) => product.category).filter(Boolean))];
    if (!categories.includes(activeCategory)) activeCategory = "All";
    elements.categories.innerHTML = categories.map((category) => `
      <button class="category-chip${category === activeCategory ? " is-active" : ""}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">
        ${escapeHtml(category)}
      </button>
    `).join("");
  }

  function visibleProducts() {
    const query = elements.search.value.trim().toLowerCase();
    const matching = products.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const searchable = `${product.name} ${product.tagline || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
      return matchesCategory && searchable.includes(query);
    });
    const sort = elements.sort.value;
    if (sort === "price-asc") matching.sort((first, second) => Number(first.price) - Number(second.price));
    if (sort === "price-desc") matching.sort((first, second) => Number(second.price) - Number(first.price));
    if (sort === "name") matching.sort((first, second) => first.name.localeCompare(second.name));
    if (sort === "featured") matching.sort((first, second) => Number(Boolean(second.featured)) - Number(Boolean(first.featured)));
    return matching;
  }

  function productCard(product, index) {
    const image = safeImageUrl(product.image || product.image_url);
    const imageMarkup = image
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<span class="product-placeholder" aria-hidden="true">✳</span>`;
    return `
      <article class="product-card" style="--card-index:${index}">
        <div class="product-visual color-${escapeHtml(product.color || "sage")}">
          ${imageMarkup}
          ${product.is_new ? '<span class="product-badge">Just arrived</span>' : ""}
          <button class="quick-add" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">
            <span aria-hidden="true">+</span><span>Add to bag</span>
          </button>
        </div>
        <div class="product-details">
          <div class="product-title-row"><h3>${escapeHtml(product.name)}</h3><span class="product-price">${formatPrice(product.price)}</span></div>
          <p>${escapeHtml(product.tagline || product.description || "")}</p>
        </div>
      </article>
    `;
  }

  function renderProducts() {
    const matching = visibleProducts();
    elements.grid.innerHTML = matching.map(productCard).join("");
    elements.empty.hidden = matching.length > 0;
    elements.grid.hidden = matching.length === 0;
  }

  function renderCart() {
    const count = cartQuantity();
    const total = cartTotal();
    elements.cartCount.textContent = String(count);
    elements.drawerItemCount.textContent = `(${count})`;
    elements.cartEmpty.hidden = cart.length > 0;
    elements.cartItems.hidden = cart.length === 0;
    elements.drawerFooter.hidden = cart.length === 0;
    elements.cartItems.innerHTML = cart.map((item) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) return "";
      const image = safeImageUrl(product.image || product.image_url);
      return `
        <article class="cart-item">
          <div class="cart-item-image color-${escapeHtml(product.color || "sage")}">${image ? `<img src="${escapeHtml(image)}" alt="">` : "✳"}</div>
          <div class="cart-item-info">
            <div class="cart-item-heading"><h3>${escapeHtml(product.name)}</h3><strong>${formatPrice(Number(product.price) * item.quantity)}</strong></div>
            <span class="cart-item-category">${escapeHtml(product.category || "")}</span>
            <div class="cart-item-controls">
              <div class="quantity-control" aria-label="Quantity for ${escapeHtml(product.name)}">
                <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Remove one ${escapeHtml(product.name)}">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Add one ${escapeHtml(product.name)}">+</button>
              </div>
              <button class="remove-item" type="button" data-remove="${escapeHtml(product.id)}">Remove</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
    elements.subtotal.textContent = formatPrice(total);
    elements.checkoutTotal.textContent = formatPrice(total);
    const remaining = FREE_SHIPPING_THRESHOLD - total;
    elements.shippingNote.textContent = remaining > 0
      ? `You're ${formatPrice(remaining)} away from free shipping.`
      : "Your order qualifies for free shipping. Lovely.";
    elements.checkoutSubmit.disabled = cart.length === 0;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
  }

  function addToCart(id) {
    const product = products.find((entry) => entry.id === id);
    if (!product) return;
    const item = cart.find((entry) => entry.id === id);
    if (item) item.quantity = Math.min(item.quantity + 1, 99);
    else cart.push({ id, quantity: 1 });
    saveCart();
    renderCart();
    showToast(`${product.name} added to your bag.`);
  }

  function setQuantity(id, change) {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) cart = cart.filter((entry) => entry.id !== id);
    else item.quantity = Math.min(item.quantity, 99);
    saveCart();
    renderCart();
  }

  function setDrawer(open) {
    elements.cartDrawer.classList.toggle("is-open", open);
    elements.cartDrawer.setAttribute("aria-hidden", String(!open));
    elements.cartBackdrop.hidden = !open;
    document.body.classList.toggle("drawer-open", open);
    if (open) elements.cartClose.focus();
    else elements.cartOpen.focus();
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!hasSupabaseConfig()) {
      elements.checkoutNotice.textContent = "Checkout isn't connected yet. Add your Supabase project URL and anon key in Scripts/products.js, then run the SQL setup script to accept orders.";
      elements.checkoutNotice.className = "checkout-notice is-error";
      return;
    }
    if (cart.length === 0) {
      elements.checkoutNotice.textContent = "Your bag is empty.";
      elements.checkoutNotice.className = "checkout-notice is-error";
      return;
    }

    const formData = new FormData(elements.checkoutForm);
    const orderItems = cart.map((item) => ({ product_id: item.id, quantity: item.quantity }));
    const payload = {
      p_customer_name: formData.get("customer_name"),
      p_customer_email: formData.get("customer_email"),
      p_customer_phone: formData.get("customer_phone") || null,
      p_shipping_address: formData.get("shipping_address"),
      p_shipping_city: formData.get("shipping_city"),
      p_shipping_postal_code: formData.get("shipping_postal_code"),
      p_order_note: formData.get("order_note") || null,
      p_items: orderItems
    };

    elements.checkoutSubmit.disabled = true;
    elements.checkoutSubmit.textContent = "Placing your order...";
    elements.checkoutNotice.textContent = "";
    elements.checkoutNotice.className = "checkout-notice";
    try {
      const response = await fetch(supabaseUrl("rpc/place_order"), {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || result?.details || "We couldn't place your order. Please check your details and try again.");
      }
      cart = [];
      saveCart();
      renderCart();
      elements.checkoutForm.reset();
      elements.checkoutNotice.textContent = `Order confirmed — your reference is ${String(result).slice(0, 8).toUpperCase()}. We'll be in touch soon.`;
      elements.checkoutNotice.className = "checkout-notice is-success";
      showToast("Your order is in. Thank you!");
      window.setTimeout(() => {
        if (elements.checkoutDialog.open) elements.checkoutDialog.close();
        elements.checkoutNotice.textContent = "";
        elements.checkoutNotice.className = "checkout-notice";
      }, 4200);
    } catch (error) {
      console.error("Order placement failed:", error);
      elements.checkoutNotice.textContent = error.message || "We couldn't place your order. Please try again.";
      elements.checkoutNotice.className = "checkout-notice is-error";
    } finally {
      elements.checkoutSubmit.disabled = cart.length === 0;
      elements.checkoutSubmit.innerHTML = 'Place your order <span aria-hidden="true">→</span>';
    }
  }

  elements.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderCategories();
    renderProducts();
  });
  elements.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
  });
  elements.search.addEventListener("input", renderProducts);
  elements.sort.addEventListener("change", renderProducts);
  elements.clearFilters.addEventListener("click", () => {
    activeCategory = "All";
    elements.search.value = "";
    renderCategories();
    renderProducts();
  });
  elements.cartOpen.addEventListener("click", () => setDrawer(true));
  elements.cartClose.addEventListener("click", () => setDrawer(false));
  elements.cartBackdrop.addEventListener("click", () => setDrawer(false));
  document.getElementById("continue-shopping").addEventListener("click", () => setDrawer(false));
  elements.cartItems.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-quantity]");
    const removeButton = event.target.closest("[data-remove]");
    if (quantityButton) setQuantity(quantityButton.dataset.quantity, Number(quantityButton.dataset.change));
    if (removeButton) {
      cart = cart.filter((item) => item.id !== removeButton.dataset.remove);
      saveCart();
      renderCart();
    }
  });
  elements.checkoutOpen.addEventListener("click", () => {
    setDrawer(false);
    elements.checkoutNotice.textContent = "";
    elements.checkoutNotice.className = "checkout-notice";
    elements.checkoutTotal.textContent = formatPrice(cartTotal());
    elements.checkoutModeNote.textContent = hasSupabaseConfig()
      ? "Order details are securely saved. We'll confirm shipping and payment by email."
      : "Preview mode: orders aren't sent until Supabase is connected.";
    elements.checkoutDialog.showModal();
  });
  elements.checkoutClose.addEventListener("click", () => elements.checkoutDialog.close());
  elements.checkoutDialog.addEventListener("click", (event) => {
    if (event.target === elements.checkoutDialog) elements.checkoutDialog.close();
  });
  elements.checkoutForm.addEventListener("submit", submitOrder);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.cartDrawer.classList.contains("is-open")) setDrawer(false);
  });

  document.getElementById("current-year").textContent = String(new Date().getFullYear());
  renderCategories();
  renderProducts();
  renderCart();
  fetchProducts();
})();
