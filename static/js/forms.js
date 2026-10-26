(() => {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelectorAll("[data-date-min]").forEach((input) => { input.min = localToday; });

  document.querySelectorAll("[data-async-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const feedback = form.querySelector("[data-form-feedback]");
      feedback.classList.remove("is-error");
      feedback.textContent = "";
      form.querySelectorAll("[aria-invalid=true]").forEach((field) => field.removeAttribute("aria-invalid"));
      if (!form.reportValidity()) return;

      const button = form.querySelector("[type=submit]");
      const originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = "Sending...";
      const values = Object.fromEntries(new FormData(form));
      const endpoint = form.dataset.asyncForm === "booking" ? "/api/bookings" : "/api/contact";

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values)
        });
        const result = await response.json();
        if (!response.ok) {
          feedback.classList.add("is-error");
          feedback.textContent = result.error || "Please review your details and try again.";
          Object.entries(result.fields || {}).forEach(([name, message]) => {
            const field = form.elements.namedItem(name);
            if (field) field.setAttribute("aria-invalid", "true");
            const note = document.createElement("span");
            note.dataset.fieldError = "";
            note.textContent = message;
            feedback.append(note);
          });
          return;
        }
        feedback.textContent = `${result.message} Reference: ${result.reference}.`;
        form.reset();
        document.querySelectorAll("[data-date-min]").forEach((input) => { input.min = localToday; });
      } catch {
        feedback.classList.add("is-error");
        feedback.textContent = "We couldn't reach the showroom. Your request was not sent; please try again.";
      } finally {
        button.disabled = false;
        button.innerHTML = originalText;
      }
    });
  });
})();