(() => {
  const gallery = document.querySelector("[data-gallery]");
  const detail = document.querySelector("[data-car-data]");
  if (!gallery || !detail) return;

  const images = JSON.parse(gallery.dataset.gallery);
  const mainImage = document.querySelector("#gallery-main-image");
  const currentNumber = document.querySelector("#gallery-current");
  const thumbnails = [...document.querySelectorAll(".gallery-thumb")];
  let activeIndex = 0;

  function showImage(index) {
    activeIndex = (index + images.length) % images.length;
    mainImage.src = images[activeIndex];
    mainImage.alt = `Vehicle image ${activeIndex + 1} of ${images.length}`;
    currentNumber.textContent = String(activeIndex + 1).padStart(2, "0");
    mainImage.style.animation = "none";
    requestAnimationFrame(() => { mainImage.style.animation = ""; });
    thumbnails.forEach((thumbnail, position) => thumbnail.classList.toggle("active", position === activeIndex));
  }

  document.querySelector(".gallery-prev").addEventListener("click", () => showImage(activeIndex - 1));
  document.querySelector(".gallery-next").addEventListener("click", () => showImage(activeIndex + 1));
  thumbnails.forEach((thumbnail) => thumbnail.addEventListener("click", () => showImage(Number(thumbnail.dataset.index))));

  const car = JSON.parse(detail.dataset.carData);
  const downPayment = document.querySelector("#down-payment");
  const downLabel = document.querySelector("#down-payment-label");
  const term = document.querySelector("#loan-term");
  const payment = document.querySelector("#monthly-payment");
  const annualRate = 0.075;

  function calculate() {
    const percentage = Number(downPayment.value);
    const principal = car.price * (1 - percentage / 100);
    const months = Number(term.value);
    const monthlyRate = annualRate / 12;
    const monthlyPayment = principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);
    downLabel.textContent = `${percentage}%`;
    payment.textContent = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(monthlyPayment);
  }

  downPayment.addEventListener("input", calculate);
  term.addEventListener("change", calculate);
  calculate();

  document.querySelector("#detail-book-drive").addEventListener("click", (event) => {
    try { localStorage.setItem("apex-booking-car", event.currentTarget.dataset.carId); } catch { /* The booking form remains available without prefilling. */ }
    window.location.href = "/#book-drive";
  });

  const related = document.querySelector("#related-cars");
  window.Apex.loadCars().then((cars) => {
    related.innerHTML = cars.filter((candidate) => candidate.id !== related.dataset.exclude).slice(0, 3).map((candidate, index) => window.Apex.carCard(candidate, index)).join("");
    window.Apex.observeReveals(related);
  }).catch(() => {
    related.innerHTML = `<p class="form-feedback is-error">Recommended vehicles are unavailable.</p>`;
  });
})();