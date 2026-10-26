(() => {
  const form = document.querySelector("#filter-form");
  const grid = document.querySelector("#inventory-grid");
  if (!form || !grid) return;

  const count = document.querySelector("#inventory-result-count");
  const empty = document.querySelector("#inventory-empty");
  const pagination = document.querySelector("#inventory-pagination");
  const sort = document.querySelector("#inventory-sort");
  const perPage = 6;
  let currentPage = 1;
  let requestNumber = 0;
  let isList = false;
  let debounceTimer;

  function fillOptions(selectName, values, labels = values) {
    const select = form.elements.namedItem(selectName);
    values.forEach((value, index) => select.add(new Option(labels[index], value)));
  }

  function setupFilters(cars) {
    const distinct = (field) => [...new Set(cars.map((car) => car[field]))].sort();
    fillOptions("brand", distinct("brand"));
    fillOptions("fuel", distinct("fuel_type"));
    fillOptions("transmission", distinct("transmission"));
    fillOptions("year", distinct("year").sort((a, b) => b - a), distinct("year").sort((a, b) => b - a).map(String));
  }

  function getParams() {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (String(value).trim()) params.set(key, String(value).trim());
    });
    if (sort.value !== "featured") params.set("sort", sort.value);
    return params;
  }

  async function loadInventory() {
    const thisRequest = ++requestNumber;
    const params = getParams();
    currentPage = 1;
    const min = Number(params.get("min_price"));
    const max = Number(params.get("max_price"));
    if (params.has("min_price") && params.has("max_price") && min > max) {
      grid.innerHTML = "";
      count.textContent = "CHECK YOUR PRICE RANGE";
      empty.hidden = false;
      pagination.replaceChildren();
      return;
    }

    count.textContent = "UPDATING THE COLLECTION...";
    empty.hidden = true;
    try {
      const response = await fetch(`/api/cars?${params.toString()}`);
      if (!response.ok) throw new Error("The inventory could not be loaded.");
      const payload = await response.json();
      if (thisRequest !== requestNumber) return;
      renderPage(payload.cars, payload.total);
    } catch {
      if (thisRequest !== requestNumber) return;
      count.textContent = "COLLECTION UNAVAILABLE";
      grid.innerHTML = `<p class="form-feedback is-error">We couldn't load the collection. Please refresh to try again.</p>`;
      empty.hidden = true;
    }
  }

  function renderPage(cars, total) {
    const pageCount = Math.ceil(cars.length / perPage);
    currentPage = Math.min(currentPage, Math.max(pageCount, 1));
    const start = (currentPage - 1) * perPage;
    const shown = cars.slice(start, start + perPage);
    count.textContent = `SHOWING ${cars.length ? start + 1 : 0}–${Math.min(start + perPage, cars.length)} OF ${total} SAMPLE VEHICLES`;
    grid.innerHTML = shown.map((car, index) => window.Apex.carCard(car, index)).join("");
    grid.classList.toggle("is-list", isList);
    empty.hidden = cars.length > 0;
    pagination.innerHTML = Array.from({ length: pageCount }, (_, index) => `<button type="button" class="${currentPage === index + 1 ? "active" : ""}" data-page="${index + 1}" aria-label="Page ${index + 1}" ${currentPage === index + 1 ? 'aria-current="page"' : ""}>${index + 1}</button>`).join("");
    window.Apex.observeReveals(grid);
    pagination.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
      currentPage = Number(button.dataset.page);
      renderPage(cars, total);
      document.querySelector("#inventory-filters").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  form.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(loadInventory, 180);
  });
  form.addEventListener("change", loadInventory);
  form.addEventListener("reset", () => window.setTimeout(() => { sort.value = "featured"; loadInventory(); }, 0));
  sort.addEventListener("change", loadInventory);
  document.querySelector("#empty-clear").addEventListener("click", () => form.reset());
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    isList = button.dataset.view === "list";
    document.querySelectorAll("[data-view]").forEach((control) => {
      const active = control === button;
      control.classList.toggle("active", active);
      control.setAttribute("aria-pressed", String(active));
    });
    grid.classList.toggle("is-list", isList);
  }));

  window.Apex.loadCars().then((cars) => {
    setupFilters(cars);
    loadInventory();
  }).catch(() => {
    count.textContent = "COLLECTION UNAVAILABLE";
    grid.innerHTML = `<p class="form-feedback is-error">We couldn't load the collection. Please refresh to try again.</p>`;
  });
})();