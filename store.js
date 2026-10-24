/* Spark One Shop — storefront logic.
   Everything you'd want to change lives in site.json (look, wording, PayPal)
   and products.json (items). You shouldn't need to edit this file. */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page"); // shop | item | thanks
  var CART_KEY = "store_cart_v1";
  var site = null, products = [], byId = {};
  var app = document.getElementById("app");

  // ---------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function w(key, vars) {
    var t = (site && site.wording && site.wording[key]) || DEFAULT_WORDING[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { t = t.split("{" + k + "}").join(vars[k]); });
    return t;
  }
  function money(n) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: (site && site.currency) || "USD" }).format(n);
    } catch (e) { return "$" + Number(n).toFixed(2); }
  }
  function num(n) { return Math.round(Number(n) * 100) / 100; }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function hashColor(s) {
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "hsl(" + (h % 360) + " 45% 42%)";
  }
  function initials(title) {
    return esc(String(title).split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join(""));
  }
  function media(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">';
    return '<div class="ph" style="background:' + hashColor(p.category || p.title) + '" aria-hidden="true">' + initials(p.title) + "</div>";
  }
  function inStock(p) { return p.stock === null || p.stock === undefined || Number(p.stock) > 0; }
  function maxQty(p) { return p.type === "digital" ? 1 : (p.stock == null ? 99 : Math.max(0, Number(p.stock))); }
  function itemUrl(p) { return "item.html?id=" + encodeURIComponent(p.id); }

  var DEFAULT_WORDING = {
    hero_title: "Shop", hero_text: "", search_placeholder: "Search…", all_categories: "All",
    sort_label: "Sort", sort_newest: "Newest", sort_price_low: "Price: low to high",
    sort_price_high: "Price: high to low", sort_name: "Name A–Z",
    showing: "Showing {from}–{to} of {total}", no_results: "No items found.",
    add_to_cart: "Add to cart", added: "Added ✓", buy_now: "Buy now", view_item: "View",
    out_of_stock: "Sold out", only_left: "Only {n} left", digital_label: "Digital download",
    physical_label: "Ships to you", quantity: "Quantity", back_to_shop: "Back to shop",
    related_title: "You might also like", cart_button: "Cart", cart_title: "Your cart",
    cart_empty: "Your cart is empty.", remove: "Remove", subtotal: "Subtotal", shipping: "Shipping",
    free: "Free", total: "Total", checkout_note: "", checkout_not_ready: "Checkout coming soon.",
    continue_shopping: "Keep shopping", prev: "Previous", next: "Next",
    thanks_title: "Thank you!", thanks_text: "", thanks_order: "Order number",
    payment_error: "Payment failed. Please try again.", footer_text: ""
  };

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    var c = site.colors || {}, r = document.documentElement.style;
    var map = { background: "--bg", surface: "--surface", text: "--text", muted: "--muted", accent: "--accent",
      accent_text: "--accent-text", header_bg: "--header-bg", header_text: "--header-text", border: "--border" };
    Object.keys(map).forEach(function (k) { if (c[k]) r.setProperty(map[k], c[k]); });

    var fonts = [site.font, site.heading_font].filter(Boolean);
    var link = document.getElementById("gfonts");
    if (fonts.length) {
      var href = "https://fonts.googleapis.com/css2?" + fonts.map(function (f) {
        return "family=" + encodeURIComponent(f).replace(/%20/g, "+") + ":wght@400;500;600;700";
      }).join("&") + "&display=swap";
      if (!link) { link = document.createElement("link"); link.id = "gfonts"; link.rel = "stylesheet"; document.head.appendChild(link); }
      if (link.href !== href) link.href = href;
    }
    if (site.font) r.setProperty("--font", "'" + site.font + "', system-ui, sans-serif");
    if (site.heading_font) r.setProperty("--heading-font", "'" + site.heading_font + "', " + (site.font ? "'" + site.font + "', " : "") + "system-ui, sans-serif");

    var bg = c.background || "#F5F5F2";
    if (site.background_image) {
      var o = site.background_overlay == null ? 0.85 : Number(site.background_overlay);
      var rgba = hexToRgba(bg, o);
      document.body.style.backgroundImage = "linear-gradient(" + rgba + "," + rgba + "), url('" + String(site.background_image).replace(/'/g, "%27") + "')";
    } else {
      document.body.style.backgroundImage = "none";
    }
    document.title = (PAGE === "shop" ? "" : document.title.split(" · ")[0] + " · ") + (site.store_name || "Shop");
  }
  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(245,245,242," + a + ")";
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }

  // ---------------------------------------------------------------- frame
  function renderFrame() {
    var header = document.getElementById("site-header");
    header.innerHTML =
      (site.announcement ? '<div class="announce">' + esc(site.announcement) + "</div>" : "") +
      '<div class="site-header"><div class="wrap">' +
      '<a class="brand" href="index.html"><span class="brand-name">' + esc(site.store_name || "Shop") + "</span>" +
      (site.tagline ? '<span class="brand-tag">' + esc(site.tagline) + "</span>" : "") + "</a>" +
      '<button class="cart-btn" id="open-cart" type="button" aria-haspopup="dialog">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>' +
      "<span>" + esc(w("cart_button")) + '</span><span class="cart-count" id="cart-count">0</span></button>' +
      "</div></div>";
    document.getElementById("open-cart").onclick = openCart;

    document.getElementById("site-footer").innerHTML =
      '<div class="site-footer"><div class="wrap"><span>' + esc(w("footer_text")) + "</span>" +
      (site.contact_email ? '<a href="mailto:' + esc(site.contact_email) + '">' + esc(site.contact_email) + "</a>" : "") +
      "</div></div>";
    updateCartCount();
  }

  // ---------------------------------------------------------------- shop page
  var state = { q: "", cat: "", sort: "newest", page: 1 };

  function readState() {
    state.q = qs("q") || "";
    state.cat = qs("cat") || "";
    state.sort = qs("sort") || "newest";
    state.page = Math.max(1, parseInt(qs("page") || "1", 10) || 1);
  }
  function writeState(push) {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.cat) p.set("cat", state.cat);
    if (state.sort !== "newest") p.set("sort", state.sort);
    if (state.page > 1) p.set("page", state.page);
    var url = location.pathname + (p.toString() ? "?" + p.toString() : "");
    try { history[push ? "pushState" : "replaceState"](null, "", url); } catch (e) {}
    try { sessionStorage.setItem("store_last_shop", url); } catch (e) {}
  }
  function categories() {
    var seen = [], out = [];
    products.forEach(function (p) { if (p.category && seen.indexOf(p.category) < 0) { seen.push(p.category); out.push(p.category); } });
    return out;
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = products.filter(function (p) {
      if (state.cat && p.category !== state.cat) return false;
      if (q && (p.title + " " + p.category + " " + (p.description || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === "newest") list = list.slice().reverse();
    if (state.sort === "price_low") list = list.slice().sort(function (a, b) { return a.price - b.price; });
    if (state.sort === "price_high") list = list.slice().sort(function (a, b) { return b.price - a.price; });
    if (state.sort === "name") list = list.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
    return list;
  }

  function renderShop() {
    app.innerHTML =
      '<section class="hero"><div class="wrap"><h1>' + esc(w("hero_title")) + "</h1>" +
      (w("hero_text") ? "<p>" + esc(w("hero_text")) + "</p>" : "") + "</div></section>" +
      '<div class="wrap">' +
      '<div class="toolbar">' +
      '<label class="sr-only" for="search">' + esc(w("search_placeholder")) + "</label>" +
      '<input class="search" id="search" type="search" placeholder="' + esc(w("search_placeholder")) + '" value="' + esc(state.q) + '">' +
      '<label class="sr-only" for="sort">' + esc(w("sort_label")) + "</label>" +
      '<select class="sort" id="sort">' +
      [["newest", "sort_newest"], ["price_low", "sort_price_low"], ["price_high", "sort_price_high"], ["name", "sort_name"]].map(function (o) {
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? " selected" : "") + ">" + esc(w(o[1])) + "</option>";
      }).join("") + "</select></div>" +
      '<div class="chips" role="group" aria-label="Categories">' +
      ['<button class="chip" type="button" data-cat="" aria-pressed="' + (!state.cat) + '">' + esc(w("all_categories")) + "</button>"]
        .concat(categories().map(function (c) {
          return '<button class="chip" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + "</button>";
        })).join("") + "</div>" +
      '<p class="count-line" id="count-line" aria-live="polite"></p>' +
      '<div class="grid" id="grid"></div>' +
      '<nav class="pager" id="pager" aria-label="Pages"></nav>' +
      "</div>";

    var search = document.getElementById("search"), t;
    search.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = search.value; state.page = 1; writeState(false); renderGrid(); }, 200);
    });
    document.getElementById("sort").onchange = function (e) { state.sort = e.target.value; state.page = 1; writeState(false); renderGrid(); };
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) {
      b.onclick = function () {
        state.cat = b.getAttribute("data-cat"); state.page = 1;
        Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (x) { x.setAttribute("aria-pressed", x === b); });
        writeState(true); renderGrid();
      };
    });
    renderGrid();
  }

  function renderGrid() {
    var per = Math.max(1, parseInt(site.items_per_page, 10) || 10);
    var list = filtered(), total = list.length, pages = Math.max(1, Math.ceil(total / per));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * per, slice = list.slice(start, start + per);

    document.getElementById("count-line").textContent = total
      ? w("showing", { from: start + 1, to: start + slice.length, total: total }) : "";
    var grid = document.getElementById("grid");
    grid.innerHTML = total ? slice.map(card).join("") : '<div class="notice" style="grid-column:1/-1">' + esc(w("no_results")) + "</div>";
    bindAddButtons(grid);

    var pager = document.getElementById("pager");
    if (pages <= 1) { pager.innerHTML = ""; return; }
    var nums = pageNumbers(state.page, pages);
    pager.innerHTML =
      '<button type="button" data-p="' + (state.page - 1) + '"' + (state.page === 1 ? " disabled" : "") + ">‹ " + esc(w("prev")) + "</button>" +
      nums.map(function (n) {
        return n === "…" ? '<span class="gap">…</span>'
          : '<button type="button" data-p="' + n + '"' + (n === state.page ? ' aria-current="page"' : "") + ' aria-label="Page ' + n + '">' + n + "</button>";
      }).join("") +
      '<button type="button" data-p="' + (state.page + 1) + '"' + (state.page === pages ? " disabled" : "") + ">" + esc(w("next")) + " ›</button>";
    Array.prototype.forEach.call(pager.querySelectorAll("button[data-p]"), function (b) {
      b.onclick = function () {
        state.page = parseInt(b.getAttribute("data-p"), 10);
        writeState(true); renderGrid();
        document.getElementById("count-line").scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  }
  function pageNumbers(cur, total) {
    if (total <= 7) return Array.from({ length: total }, function (_, i) { return i + 1; });
    var lo = Math.max(2, cur - 1), hi = Math.min(total - 1, cur + 1);
    if (cur <= 3) { lo = 2; hi = 5; }                       // near the start: 1 2 3 4 5 … 10
    if (cur >= total - 2) { lo = total - 4; hi = total - 1; } // near the end:  1 … 6 7 8 9 10
    var out = [1];
    if (lo > 2) out.push("…");
    for (var i = lo; i <= hi; i++) out.push(i);
    if (hi < total - 1) out.push("…");
    out.push(total);
    return out;
  }

  function card(p) {
    var ok = inStock(p);
    return '<article class="card">' +
      '<a class="card-media" href="' + itemUrl(p) + '" tabindex="-1" aria-hidden="true">' + media(p) +
      '<span class="badge">' + esc(p.type === "digital" ? w("digital_label") : w("physical_label")) + "</span>" +
      (ok ? "" : '<span class="badge soldout">' + esc(w("out_of_stock")) + "</span>") + "</a>" +
      '<div class="card-body"><span class="card-cat">' + esc(p.category) + "</span>" +
      '<a class="card-title" href="' + itemUrl(p) + '">' + esc(p.title) + "</a>" +
      '<span class="price">' + money(p.price) + "</span>" +
      '<div class="card-actions">' +
      '<button class="btn btn-primary btn-block" type="button" data-add="' + esc(p.id) + '"' + (ok ? "" : " disabled") + ' aria-label="' + esc((ok ? w("add_to_cart") : w("out_of_stock")) + ": " + p.title) + '">' + esc(ok ? w("add_to_cart") : w("out_of_stock")) + "</button>" +
      "</div></div></article>";
  }
  function bindAddButtons(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-add]"), function (b) {
      b.onclick = function () {
        addToCart(b.getAttribute("data-add"), 1);
        var old = b.textContent; b.textContent = w("added");
        setTimeout(function () { b.textContent = old; }, 1200);
      };
    });
  }

  // ---------------------------------------------------------------- item page
  function renderItem() {
    var p = byId[qs("id") || ""];
    var back = "index.html";
    try { back = sessionStorage.getItem("store_last_shop") || back; } catch (e) {}
    if (!p) {
      app.innerHTML = '<div class="wrap"><a class="back" href="' + esc(back) + '">‹ ' + esc(w("back_to_shop")) + "</a>" +
        '<div class="notice">' + esc(w("no_results")) + "</div></div>";
      return;
    }
    document.title = p.title + " · " + (site.store_name || "Shop");
    var ok = inStock(p), max = maxQty(p);
    var lowStock = p.type !== "digital" && p.stock != null && Number(p.stock) > 0 && Number(p.stock) <= 5;
    var related = products.filter(function (x) { return x.category === p.category && x.id !== p.id; }).slice(-4).reverse();

    app.innerHTML = '<div class="wrap">' +
      '<a class="back" href="' + esc(back) + '">‹ ' + esc(w("back_to_shop")) + "</a>" +
      '<article class="item"><div class="item-media">' + media(p) + "</div>" +
      '<div class="item-info"><span class="card-cat">' + esc(p.category) + "</span>" +
      "<h1>" + esc(p.title) + "</h1>" +
      '<span class="price">' + money(p.price) + "</span>" +
      '<div class="meta-line"><span class="pill">' + esc(p.type === "digital" ? w("digital_label") : w("physical_label")) + "</span>" +
      (!ok ? '<span class="pill warn">' + esc(w("out_of_stock")) + "</span>" : "") +
      (lowStock ? '<span class="pill warn">' + esc(w("only_left", { n: p.stock })) + "</span>" : "") + "</div>" +
      '<div class="desc">' + esc(p.description || "") + "</div>" +
      (ok ? (
        '<div class="buy-row">' +
        (max > 1 ? '<span class="sr-only" id="qty-label">' + esc(w("quantity")) + "</span>" +
          '<div class="qty" role="group" aria-labelledby="qty-label"><button type="button" id="qminus" aria-label="Less">−</button>' +
          '<input id="qty" type="number" min="1" max="' + max + '" value="1" aria-labelledby="qty-label">' +
          '<button type="button" id="qplus" aria-label="More">+</button></div>' : "") +
        '<button class="btn btn-primary" type="button" id="add">' + esc(w("add_to_cart")) + "</button>" +
        '<button class="btn btn-ghost" type="button" id="buy">' + esc(w("buy_now")) + "</button></div>" +
        (p.paypal_hosted_button_id ? '<div class="hosted-btn" id="paypal-container-' + esc(p.paypal_hosted_button_id) + '"></div>' : "")
      ) : "") +
      "</div></article>" +
      (related.length ? '<section class="related"><h2>' + esc(w("related_title")) + '</h2><div class="grid" id="related">' + related.map(card).join("") + "</div></section>" : "") +
      "</div>";

    if (related.length) bindAddButtons(document.getElementById("related"));
    if (!ok) return;
    var qty = document.getElementById("qty");
    function getQty() { return qty ? Math.min(max, Math.max(1, parseInt(qty.value, 10) || 1)) : 1; }
    if (qty) {
      document.getElementById("qminus").onclick = function () { qty.value = Math.max(1, getQty() - 1); };
      document.getElementById("qplus").onclick = function () { qty.value = Math.min(max, getQty() + 1); };
      qty.onchange = function () { qty.value = getQty(); };
    }
    document.getElementById("add").onclick = function () { addToCart(p.id, getQty()); };
    document.getElementById("buy").onclick = function () { addToCart(p.id, getQty(), true); openCart(); };
    if (p.paypal_hosted_button_id) renderHostedButton(p.paypal_hosted_button_id);
  }

  // ---------------------------------------------------------------- cart
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]").filter(function (l) { return byId[l.id]; }); }
    catch (e) { return memCart; }
  }
  var memCart = [];
  function saveCart(c) {
    memCart = c;
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
    updateCartCount();
  }
  function addToCart(id, qty, silent) {
    var p = byId[id]; if (!p || !inStock(p)) return;
    var c = getCart(), line = c.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(maxQty(p), line.qty + qty);
    else c.push({ id: id, qty: Math.min(maxQty(p), qty) });
    saveCart(c);
    if (!silent) toast(w("added") + " " + p.title);
    if (drawerOpen) renderCart();
  }
  function setQty(id, qty) {
    var c = getCart(), p = byId[id];
    c = c.map(function (l) { if (l.id === id) l.qty = Math.min(maxQty(p), qty); return l; }).filter(function (l) { return l.qty > 0; });
    saveCart(c); renderCart();
  }
  function updateCartCount() {
    var el = document.getElementById("cart-count");
    if (el) el.textContent = getCart().reduce(function (s, l) { return s + l.qty; }, 0);
  }
  function totals(c) {
    var subtotal = 0, physical = false;
    c.forEach(function (l) { var p = byId[l.id]; subtotal += p.price * l.qty; if (p.type !== "digital") physical = true; });
    subtotal = num(subtotal);
    var sh = site.shipping || {}, shipping = 0;
    if (physical) {
      var physSub = c.reduce(function (s, l) { var p = byId[l.id]; return p.type !== "digital" ? s + p.price * l.qty : s; }, 0);
      shipping = (sh.free_over && physSub >= Number(sh.free_over)) ? 0 : num(sh.flat_rate || 0);
    }
    return { subtotal: subtotal, shipping: shipping, total: num(subtotal + shipping), physical: physical };
  }

  var drawerOpen = false, lastFocus = null;
  function buildDrawer() {
    var holder = document.createElement("div");
    holder.innerHTML =
      '<div class="overlay" id="overlay"></div>' +
      '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">' +
      '<div class="drawer-head"><h2 id="cart-title"></h2>' +
      '<button class="icon-btn" type="button" id="close-cart" aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="drawer-body" id="cart-body"></div><div class="drawer-foot" id="cart-foot"></div></aside>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
    while (holder.firstChild) document.body.appendChild(holder.firstChild);
    document.getElementById("overlay").onclick = closeCart;
    document.getElementById("close-cart").onclick = closeCart;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawerOpen) closeCart(); });
  }
  function openCart() {
    lastFocus = document.activeElement;
    drawerOpen = true;
    renderCart();
    document.getElementById("overlay").classList.add("open");
    var d = document.getElementById("drawer");
    d.classList.add("open"); d.setAttribute("aria-hidden", "false");
    document.getElementById("close-cart").focus();
  }
  function closeCart() {
    drawerOpen = false;
    document.getElementById("overlay").classList.remove("open");
    var d = document.getElementById("drawer");
    d.classList.remove("open"); d.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function renderCart() {
    document.getElementById("cart-title").textContent = w("cart_title");
    var c = getCart(), body = document.getElementById("cart-body"), foot = document.getElementById("cart-foot");
    if (!c.length) {
      body.innerHTML = '<div class="empty">' + esc(w("cart_empty")) + "</div>";
      foot.innerHTML = '<button class="btn btn-ghost btn-block" type="button" id="keep">' + esc(w("continue_shopping")) + "</button>";
      document.getElementById("keep").onclick = closeCart;
      return;
    }
    body.innerHTML = c.map(function (l) {
      var p = byId[l.id], max = maxQty(p);
      return '<div class="line"><a class="line-thumb" href="' + itemUrl(p) + '" tabindex="-1" aria-hidden="true">' + media(p) + "</a>" +
        '<div class="line-info"><a class="line-title" href="' + itemUrl(p) + '">' + esc(p.title) + "</a>" +
        '<span class="line-sub">' + esc(p.type === "digital" ? w("digital_label") : w("physical_label")) + " · " + money(p.price) + "</span>" +
        '<div class="line-row">' +
        (max > 1 ? '<div class="qty" role="group" aria-label="' + esc(w("quantity")) + '">' +
          '<button type="button" data-dec="' + esc(p.id) + '" aria-label="Less">−</button>' +
          '<input type="number" min="1" max="' + max + '" value="' + l.qty + '" data-q="' + esc(p.id) + '" aria-label="' + esc(w("quantity")) + '">' +
          '<button type="button" data-inc="' + esc(p.id) + '" aria-label="More">+</button></div>' : '<span class="line-sub">× 1</span>') +
        "<strong>" + money(p.price * l.qty) + "</strong></div>" +
        '<button class="link-btn" type="button" data-rm="' + esc(p.id) + '">' + esc(w("remove")) + "</button></div></div>";
    }).join("");
    body.querySelectorAll("[data-dec]").forEach(function (b) { b.onclick = function () { var id = b.getAttribute("data-dec"); setQty(id, lineQty(id) - 1); }; });
    body.querySelectorAll("[data-inc]").forEach(function (b) { b.onclick = function () { var id = b.getAttribute("data-inc"); setQty(id, lineQty(id) + 1); }; });
    body.querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { setQty(b.getAttribute("data-rm"), 0); }; });
    body.querySelectorAll("[data-q]").forEach(function (i) { i.onchange = function () { setQty(i.getAttribute("data-q"), Math.max(1, parseInt(i.value, 10) || 1)); }; });

    var t = totals(c);
    foot.innerHTML =
      '<div class="sum-row"><span>' + esc(w("subtotal")) + "</span><span>" + money(t.subtotal) + "</span></div>" +
      (t.physical ? '<div class="sum-row"><span>' + esc(w("shipping")) + "</span><span>" + (t.shipping ? money(t.shipping) : esc(w("free"))) + "</span></div>" : "") +
      '<div class="sum-row total"><span>' + esc(w("total")) + "</span><span>" + money(t.total) + "</span></div>" +
      '<div id="pay-error" role="alert"></div>' +
      '<div id="paypal-buttons"></div>' +
      (w("checkout_note") ? '<p class="small">' + esc(w("checkout_note")) + "</p>" : "") +
      '<button class="btn btn-ghost btn-block" type="button" id="keep">' + esc(w("continue_shopping")) + "</button>";
    document.getElementById("keep").onclick = closeCart;
    renderPayPal();
  }
  function lineQty(id) { var l = getCart().filter(function (x) { return x.id === id; })[0]; return l ? l.qty : 0; }

  // ---------------------------------------------------------------- PayPal
  var sdkPromise = null;
  function loadPayPal() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(site.paypal_client_id) +
        "&currency=" + encodeURIComponent(site.currency || "USD") + "&components=buttons,hosted-buttons&enable-funding=venmo";
      s.onload = function () { resolve(window.paypal); };
      s.onerror = function () { sdkPromise = null; reject(new Error("PayPal didn't load")); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }
  function renderPayPal() {
    var box = document.getElementById("paypal-buttons");
    if (!box) return;
    if (!site.paypal_client_id) { box.innerHTML = '<p class="notice" style="margin:0">' + esc(w("checkout_not_ready")) + "</p>"; return; }
    if (window.__PREVIEW__) { box.innerHTML = '<p class="small">PayPal buttons appear here on the live site.</p>'; return; }
    loadPayPal().then(function (paypal) {
      if (!document.getElementById("paypal-buttons")) return;
      box.innerHTML = "";
      paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "pay" },
        createOrder: function (data, actions) {
          var c = getCart(), t = totals(c), cur = site.currency || "USD";
          return actions.order.create({
            purchase_units: [{
              description: (site.store_name || "Shop") + " order",
              amount: {
                currency_code: cur, value: t.total.toFixed(2),
                breakdown: { item_total: { currency_code: cur, value: t.subtotal.toFixed(2) },
                  shipping: { currency_code: cur, value: t.shipping.toFixed(2) } }
              },
              items: c.map(function (l) {
                var p = byId[l.id];
                return { name: String(p.title).slice(0, 127), sku: String(p.sku || p.id).slice(0, 127), quantity: String(l.qty),
                  unit_amount: { currency_code: cur, value: num(p.price).toFixed(2) },
                  category: p.type === "digital" ? "DIGITAL_GOODS" : "PHYSICAL_GOODS" };
              })
            }],
            application_context: { shipping_preference: t.physical ? "GET_FROM_FILE" : "NO_SHIPPING", brand_name: String(site.store_name || "").slice(0, 127) }
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            saveCart([]);
            location.href = "thanks.html?order=" + encodeURIComponent(details.id || data.orderID || "");
          });
        },
        onError: function () {
          var e = document.getElementById("pay-error");
          if (e) e.innerHTML = '<p class="error">' + esc(w("payment_error")) + "</p>";
        }
      }).render("#paypal-buttons");
    }).catch(function () {
      box.innerHTML = '<p class="error">' + esc(w("payment_error")) + "</p>";
    });
  }
  function renderHostedButton(id) {
    if (!site.paypal_client_id || window.__PREVIEW__) return;
    loadPayPal().then(function (paypal) {
      if (paypal.HostedButtons) paypal.HostedButtons({ hostedButtonId: id }).render("#paypal-container-" + id);
    }).catch(function () {});
  }

  // ---------------------------------------------------------------- thanks page
  function renderThanks() {
    var order = qs("order");
    app.innerHTML = '<div class="wrap"><section class="thanks"><h1>' + esc(w("thanks_title")) + "</h1>" +
      "<p>" + esc(w("thanks_text")) + "</p>" +
      (order ? '<p class="small" style="margin-top:18px">' + esc(w("thanks_order")) + ": <strong>" + esc(order) + "</strong></p>" : "") +
      '<p style="margin-top:28px"><a class="btn btn-primary" href="index.html">' + esc(w("continue_shopping")) + "</a></p>" +
      "</section></div>";
  }

  function toast(msg) {
    var t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  // ---------------------------------------------------------------- boot
  function render() {
    applyTheme();
    renderFrame();
    if (PAGE === "shop") renderShop();
    else if (PAGE === "item") renderItem();
    else renderThanks();
  }
  function setData(s, p) {
    site = s || {};
    products = ((p && p.products) || []).filter(function (x) { return x && x.active !== false && x.id; });
    byId = {}; products.forEach(function (x) { x.price = Number(x.price) || 0; byId[x.id] = x; });
  }

  // Live preview from customize.html: it sends the edited site.json here.
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "store-preview") return;
    window.__PREVIEW__ = true;
    site = e.data.site;
    render();
  });

  window.addEventListener("popstate", function () { if (PAGE === "shop" && site) { readState(); renderShop(); } });

  buildDrawer();
  if (PAGE === "shop") readState();
  Promise.all([
    fetch("site.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("site.json " + r.status); return r.json(); }),
    fetch("products.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("products.json " + r.status); return r.json(); })
  ]).then(function (res) {
    setData(res[0], res[1]);
    render();
    try { if (window.parent !== window) window.parent.postMessage({ type: "store-ready" }, location.origin); } catch (e) {}
  }).catch(function (err) {
    app.innerHTML = '<div class="wrap"><div class="notice">The shop couldn\'t load (' + esc(err.message) +
      "). If you opened this file straight from your computer, it needs to be on a web server — see README.</div></div>";
  });
})();
