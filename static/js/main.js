(() => {
  const storage = {
    read(key) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        Apex.notice("Browser storage is unavailable in this session.");
      }
    }
  };

  const wishlist = new Set(storage.read("apex-wishlist").map(String));
  const comparison = new Set(storage.read("apex-comparison").map(String));
  let carsPromise;
  let toastTimer;
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatPrice(price) {
    return currency.format(Number(price) || 0);
  }

  function loadCars() {
    if (!carsPromise) {
      carsPromise = fetch("/api/cars")
        .then((response) => {
          if (!response.ok) throw new Error("The collection could not be loaded.");
          return response.json();
        })
        .then((payload) => payload.cars);
    }
    return carsPromise;
  }

  function carCard(car, order = 0) {
    const saved = wishlist.has(String(car.id));
    const compared = comparison.has(String(car.id));
    return `<article class="vehicle-card reveal" style="--order:${order}">
      <div class="vehicle-image-wrap">
        <a href="/cars/${encodeURIComponent(car.id)}" tabindex="-1" aria-hidden="true"><img class="vehicle-image" src="${escapeHTML(car.image)}" alt="${escapeHTML(`${car.brand} ${car.model}`)}" loading="lazy" decoding="async"></a>
        <span class="vehicle-index">${String(car.year).slice(-2)} / APEX</span><span class="vehicle-sample">SAMPLE LISTING</span>
        <div class="vehicle-card-actions">
          <button class="vehicle-tool ${saved ? "is-selected" : ""}" type="button" data-wishlist="${escapeHTML(car.id)}" aria-label="${saved ? "Remove from" : "Add to"} wishlist: ${escapeHTML(car.brand)} ${escapeHTML(car.model)}" aria-pressed="${saved}" title="${saved ? "Remove from" : "Add to"} wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.3-8.8 11-8.8 11s-8.8-5.7-8.8-11a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z"/></svg></button>
          <button class="vehicle-tool ${compared ? "is-selected" : ""}" type="button" data-compare="${escapeHTML(car.id)}" aria-label="${compared ? "Remove from" : "Add to"} comparison: ${escapeHTML(car.brand)} ${escapeHTML(car.model)}" aria-pressed="${compared}" title="${compared ? "Remove from" : "Add to"} comparison"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M16 4v16M4 8h16M4 16h16"/></svg></button>
        </div>
      </div>
      <div class="vehicle-meta"><p class="vehicle-label">${escapeHTML(car.brand)} / ${escapeHTML(car.body_style)}</p>
        <div class="vehicle-heading-row"><h3>${escapeHTML(car.model)}</h3><span class="vehicle-year">${escapeHTML(car.year)}</span></div>
        <div class="vehicle-price">${formatPrice(car.price)}</div>
        <div class="vehicle-facts"><span>${escapeHTML(car.fuel_type)}</span><i></i><span>${escapeHTML(car.transmission)}</span><i></i><span>${Number(car.mileage).toLocaleString("en-US")} mi</span></div>
        <div class="vehicle-card-bottom"><a class="vehicle-details-link" href="/cars/${encodeURIComponent(car.id)}">View details <span>↗</span></a><span class="vehicle-status">Details to confirm</span></div>
      </div>
    </article>`;
  }

  function notice(message) {
    const region = document.querySelector("#toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function persistCollections() {
    storage.write("apex-wishlist", [...wishlist]);
    storage.write("apex-comparison", [...comparison]);
    updateCollectionUI();
  }

  function renderWishlist() {
    const list = document.querySelector("#wishlist-items");
    const empty = document.querySelector("#wishlist-empty");
    if (!list || !empty) return;
    loadCars().then((cars) => {
      const savedCars = cars.filter((car) => wishlist.has(String(car.id)));
      list.innerHTML = savedCars.map((car) => `<article class="wishlist-row"><img src="${escapeHTML(car.image)}" alt="" loading="lazy"><div><small>${escapeHTML(car.year)} / ${escapeHTML(car.brand)}</small><h3>${escapeHTML(car.model)}</h3><strong>${formatPrice(car.price)}</strong></div><button type="button" data-wishlist="${escapeHTML(car.id)}" aria-label="Remove ${escapeHTML(car.model)} from wishlist">×</button></article>`).join("");
      empty.hidden = savedCars.length > 0;
    }).catch(() => { empty.textContent = "Your shortlist could not be loaded just now."; });
  }

  function renderComparison() {
    const table = document.querySelector("#comparison-table");
    if (!table) return;
    loadCars().then((cars) => {
      const selected = cars.filter((car) => comparison.has(String(car.id)));
      table.innerHTML = selected.map((car) => `<article class="comparison-car"><img src="${escapeHTML(car.image)}" alt="" loading="lazy"><h3>${escapeHTML(car.brand)} ${escapeHTML(car.model)}</h3><p>Price <strong>${formatPrice(car.price)}</strong></p><p>Year <strong>${escapeHTML(car.year)}</strong></p><p>Power <strong>${Number(car.horsepower).toLocaleString()} hp</strong></p><p>Fuel <strong>${escapeHTML(car.fuel_type)}</strong></p><p>Transmission <strong>${escapeHTML(car.transmission)}</strong></p><p>Mileage <strong>${Number(car.mileage).toLocaleString()} mi</strong></p></article>`).join("");
    }).catch(() => notice("Comparison details are unavailable."));
  }

  function updateCollectionUI() {
    const count = document.querySelector("#wishlist-count");
    const dock = document.querySelector("#compare-dock");
    const compareCount = document.querySelector("#compare-count");
    if (count) count.textContent = wishlist.size;
    if (dock) dock.hidden = comparison.size === 0;
    if (compareCount) compareCount.textContent = comparison.size;
    document.querySelectorAll("[data-wishlist]").forEach((button) => {
      const selected = wishlist.has(String(button.dataset.wishlist));
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-compare]").forEach((button) => {
      const selected = comparison.has(String(button.dataset.compare));
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function toggleWishlist(id) {
    const key = String(id);
    const adding = !wishlist.has(key);
    if (adding) wishlist.add(key); else wishlist.delete(key);
    persistCollections();
    renderWishlist();
    notice(adding ? "Added to your private shortlist." : "Removed from your shortlist.");
  }

  function toggleComparison(id) {
    const key = String(id);
    if (comparison.has(key)) {
      comparison.delete(key);
    } else if (comparison.size >= 3) {
      notice("Choose up to three cars to compare.");
      return;
    } else {
      comparison.add(key);
      notice("Added to your comparison.");
    }
    persistCollections();
  }

  function observeReveals(scope = document) {
    const elements = scope.querySelectorAll(".reveal:not([data-observed])");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    elements.forEach((element) => {
      element.dataset.observed = "true";
      observer.observe(element);
    });
  }

  function setupCounters() {
    document.querySelectorAll("[data-count]").forEach((counter) => {
      const finish = Number(counter.dataset.count);
      const start = () => {
        const began = performance.now();
        const tick = (time) => {
          const progress = Math.min((time - began) / 1000, 1);
          counter.textContent = Math.round(finish * (1 - (1 - progress) ** 3));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      if (!("IntersectionObserver" in window)) { start(); return; }
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { start(); observer.disconnect(); }
      }, { threshold: 0.5 });
      observer.observe(counter);
    });
  }

  function setupTestimonials() {
    const slides = [...document.querySelectorAll(".testimonial")];
    if (slides.length < 2) return;
    let current = 0;
    const progress = document.querySelector("#carousel-progress");
    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => slide.classList.toggle("active", position === current));
      if (progress) progress.style.transform = `translateX(${current * 100}%)`;
    }
    document.querySelector("#testimonial-prev")?.addEventListener("click", () => show(current - 1));
    document.querySelector("#testimonial-next")?.addEventListener("click", () => show(current + 1));
  }

  const Apex = { loadCars, carCard, formatPrice, notice, toggleWishlist, observeReveals };
  window.Apex = Apex;

  document.addEventListener("click", (event) => {
    const wishlistButton = event.target.closest("[data-wishlist], [data-add-wishlist]");
    if (wishlistButton) {
      toggleWishlist(wishlistButton.dataset.wishlist || wishlistButton.dataset.addWishlist);
      return;
    }
    const compareButton = event.target.closest("[data-compare]");
    if (compareButton) { toggleComparison(compareButton.dataset.compare); return; }
  });

  const header = document.querySelector("#site-header");
  const onScroll = () => header?.classList.toggle("is-solid", window.scrollY > 28);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#primary-nav");
  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    nav?.classList.toggle("is-open", !isOpen);
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    menuButton?.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }));

  const wishlistDialog = document.querySelector("#wishlist-dialog");
  document.querySelectorAll(".wishlist-open").forEach((button) => button.addEventListener("click", () => {
    renderWishlist();
    wishlistDialog?.showModal();
  }));
  document.querySelector(".dialog-close")?.addEventListener("click", () => wishlistDialog?.close());
  wishlistDialog?.addEventListener("click", (event) => { if (event.target === wishlistDialog) wishlistDialog.close(); });

  const compareDialog = document.querySelector("#compare-dialog");
  document.querySelector("#compare-open")?.addEventListener("click", () => {
    renderComparison();
    compareDialog?.showModal();
  });
  document.querySelector(".compare-dialog-close")?.addEventListener("click", () => compareDialog?.close());
  compareDialog?.addEventListener("click", (event) => { if (event.target === compareDialog) compareDialog.close(); });
  document.querySelector("#compare-clear")?.addEventListener("click", () => {
    comparison.clear();
    persistCollections();
    notice("Comparison cleared.");
  });

  loadCars().then((cars) => {
    document.querySelectorAll("[data-featured-cars]").forEach((container) => {
      container.innerHTML = cars.slice(0, 3).map((car, index) => carCard(car, index)).join("");
      observeReveals(container);
    });
    document.querySelectorAll("[data-car-select]").forEach((select) => {
      const pending = localStorage.getItem("apex-booking-car");
      select.innerHTML = `<option value="">Choose a car</option>${cars.map((car) => `<option value="${escapeHTML(car.id)}" ${pending === car.id ? "selected" : ""}>${escapeHTML(car.brand)} ${escapeHTML(car.model)} / ${escapeHTML(car.year)}</option>`).join("")}`;
      if (pending) localStorage.removeItem("apex-booking-car");
    });
  }).catch(() => {
    document.querySelectorAll("[data-featured-cars]").forEach((container) => { container.innerHTML = `<p class="form-feedback is-error">The collection is unavailable. Please refresh to try again.</p>`; });
  });

  observeReveals();
  setupCounters();
  setupTestimonials();
  updateCollectionUI();
})();