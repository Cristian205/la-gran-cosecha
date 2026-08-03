// ==========================
// 🔢 VALORES PERMITIDOS
// ==========================
const VALORES = [
    "0",
    "1/4",
    "1/2",
    "3/4",
    "1",
    "2",
    "3",
    "4",
    "5"
];

// ==========================
// 🔢 CONVERTIR A DECIMAL
// ==========================
function valorADecimal(valor) {

    const mapa = {
        "0": 0,
        "1/4": 0.25,
        "1/2": 0.5,
        "3/4": 0.75,
    };

    if (mapa[valor] !== undefined) {
        return mapa[valor];
    }

    return parseFloat(valor) || 0;
}

// ==========================
// 🔢 CONVERTIR A FRACCIÓN
// ==========================
function decimalAFraccion(valor) {

    const mapa = {
        0.25: "1/4",
        0.5: "1/2",
        0.75: "3/4",
    };

    valor = parseFloat(valor) || 0;

    const entero = Math.floor(valor);
    const decimal = parseFloat((valor - entero).toFixed(2));

    if (decimal === 0) {
        return `${entero}`;
    }

    if (entero === 0) {
        return mapa[decimal] || valor;
    }

    return `${entero} ${mapa[decimal] || decimal}`;
}

// ==========================
// 🔢 ACTUALIZAR TOTALES
// ==========================
function updateGlobalTotal() {

    const totalDisplay = document.getElementById("total-items");
    const headerCount = document.getElementById("header-items-count");
    const summary = document.getElementById("cart-summary");

    let total = 0;

    // 🟢 PRODUCTOS NORMALES
    document.querySelectorAll(".qty-input").forEach(input => {
        const valor = valorADecimal(input.value);
        if (valor > 0) {
            total += valor; // suma cantidad real
        }
    });

    // 🔵 PRODUCTOS MANUALES (la cantidad real está en este input)
    document.querySelectorAll(".qty-input-").forEach(input => {
        const valor = valorADecimal(input.value);
        if (valor > 0) {
            total += valor;
        }
    });

    // UI
    if (totalDisplay) {
        totalDisplay.textContent = total;
    }

    if (headerCount) {
        headerCount.textContent = total.toString().padStart(2, "0");
    }

    if (summary) {
        summary.classList.toggle("translate-y-32", total === 0);
        summary.classList.toggle("opacity-0", total === 0);
    }
}
// ==========================
// 🔢 ACTUALIZAR TARJETA
// ==========================
function actualizarCard(card, input) {

    const display = card.querySelector(".fraction-display");
    const valor = valorADecimal(input.value);

    if (display) {
        display.textContent = decimalAFraccion(valor);
    }

    if (valor > 0) {
        card.classList.add("has-value");
    } else {
        card.classList.remove("has-value");
    }

    updateGlobalTotal();
}

// ==========================
// 🚀 DOM READY
// ==========================
document.addEventListener("DOMContentLoaded", () => {

    // Inicializar tarjetas
    document.querySelectorAll(".product-card").forEach(card => {

        const input = card.querySelector(".qty-input");

        if (input) {
            actualizarCard(card, input);
        }

    });

    // ==========================
    // BOTONES + Y -
    // ==========================
    document.addEventListener("click", e => {

        const btn = e.target.closest(".qty-btn");

        if (!btn) return;

        const card = btn.closest(".product-card");
        const input = card?.querySelector(".qty-input");

        if (!input) return;

        let indice = VALORES.indexOf(input.value);

        if (indice === -1) {
            indice = 0;
        }

        // +
        if (btn.classList.contains("plus")) {

            if (indice < VALORES.length - 1) {
                input.value = VALORES[indice + 1];
            }

        }

        // -
        if (btn.classList.contains("minus")) {

            if (indice > 0) {
                input.value = VALORES[indice - 1];
            }

        }

        actualizarCard(card, input);

    });

    // ==========================
    // ESCRITURA MANUAL
    // ==========================
    document.addEventListener("change", e => {
        if (!e.target.matches(".qty-input")) {
            return;
        }
        const input = e.target;
        const card = input.closest(".product-card");

        // Si escriben un valor inválido
        if (!VALORES.includes(input.value)) {
            input.value = "0";
        }

        actualizarCard(card, input);

    });

});
  // ==========================
  // BUSCADOR
  // ==========================
  document.getElementById("main-search")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();

    document.querySelectorAll(".product-card").forEach((card) => {
      if (card.classList.contains("custom-item-card")) return;

      const name = card.dataset.name || "";

      if (name.includes(term)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });

  // ==========================
  // FILTROS
  // ==========================
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;

      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.remove("active", "bg-slate-900", "text-white");

        b.classList.add("text-slate-500");
      });

      btn.classList.add("active", "bg-slate-900", "text-white");

      btn.classList.remove("text-slate-500");

      document.querySelectorAll(".category-section").forEach((sec) => {
        if (filter === "todas" || sec.dataset.catId === filter) {
          sec.style.display = "";
        } else {
          sec.style.display = "none";
        }
      });
    });
  });

// ==========================
// 🔥 AUTOCOMPLETE
// ==========================
let timeout = null;

document.addEventListener("input", (e) => {
  if (!e.target.matches(".custom-search")) return;

  const input = e.target;
  const card = input.closest(".product-card");
  const suggestionBox = card?.querySelector(".suggestion-box");
  const categoriaId = card.dataset.categoryId

  if (!card || !suggestionBox) return;

  clearTimeout(timeout);

  timeout = setTimeout(async () => {
    const query = input.value.trim();

    if (query.length < 2) {
      suggestionBox.classList.add("hidden");

      return;
    }
    resetToManual(card);

    try {
      const res = await fetch(
        `/api/sugerir-producto/?q=${encodeURIComponent(query)}&categoria=${categoriaId}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (
        data.found &&
        data.nombre &&
        data.nombre.toLowerCase() !== query.toLowerCase()
      ) {
        const options = (data.presentaciones || [])
          .map(
            (p) => `
                        <option value="${p.id}">
                            ${p.nombre_presentacion}
                        </option>
                    `,
          )
          .join("");

        suggestionBox.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="fas fa-lightbulb text-emerald-600"></i>
                            <span class="text-[11px] text-emerald-700">
                                Encontramos algo similar:

                                <span class="suggestion-text font-black">
                                    ${data.nombre}
                                </span>

                            </span>

                        </div>

                        ${
                          data.presentaciones?.length
                            ? `
                                <select
                                    class="suggestion-presentation-select
                                           w-full rounded-xl
                                           border border-emerald-200
                                           bg-white
                                           px-3 py-2
                                           text-xs font-semibold
                                           text-slate-700">

                                    ${options}

                                </select>
                                `
                            : ""
                        }
                    </div>
                `;

        suggestionBox.classList.remove("hidden", "text-amber-500");
        suggestionBox.classList.add("text-emerald-600");
        suggestionBox.dataset.nombre = data.nombre;
        suggestionBox.dataset.productoId = data.producto_id;
        suggestionBox.dataset.presentaciones = JSON.stringify(
          data.presentaciones || [],
        );
      } else {
        suggestionBox.innerHTML = `
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">

                        <span class="text-amber-600 text-xs font-bold">

                            No existe en catálogo.
                            Se guardará como producto manual.

                        </span>

                    </div>
                `;

        suggestionBox.classList.remove("hidden");
        suggestionBox.dataset.nombre = "";
        suggestionBox.dataset.presentaciones = "";
      }
    } catch (err) {
      console.error("Autocomplete error:", err);

      suggestionBox.classList.add("hidden");
    }
  }, 400);
});

// ==========================
// CLICK EN SUGERENCIA
// ==========================
// ==========================
// HELPERS
// ==========================

function getCard(element) {
  return element.closest(".product-card");
}

function resetCard(card) {
  // Inputs
  card.querySelectorAll("input").forEach((input) => {
    input.value = "";
    input.classList.remove("border-emerald-400");
  });

  // Selects
  card.querySelectorAll("select").forEach((select) => {
    select.selectedIndex = 0;
  });

  // Suggestion box
  card.querySelectorAll(".suggestion-box").forEach((box) => {
    box.classList.add("hidden");

    box.dataset.nombre = "";
    box.dataset.presentaciones = "";

    const text = box.querySelector(".suggestion-text");

    if (text) {
      text.textContent = "";
    }
  });

  // Fraction display
  card.querySelectorAll(".fraction-display").forEach((el) => {
    el.textContent = "";
  });

  card.classList.remove("has-value");
}
function resetToManual(card) {

    card.querySelector(
        '.catalog-product-id'
    ).value = '';

    card.querySelector(
        '.catalog-presentation-id'
    ).value = '';

    card.querySelector(
        '.item-type'
    ).value = 'manual';

    card.querySelector(
        '.manual-unit-container'
    ).classList.remove(
        'hidden'
    );

    const catalogContainer =
        card.querySelector(
            '.catalog-presentation-container'
        );

    catalogContainer.innerHTML = '';

    catalogContainer.classList.add(
        'hidden'
    );
}
// ==========================
// APLICAR SUGERENCIA
// ==========================

function applySuggestion(box) {

    const card = getCard(box);

    if (!card) return;

    const input =
        card.querySelector('.custom-search');

    const manualContainer =
        card.querySelector(
            '.manual-unit-container'
        );

    const catalogContainer =
        card.querySelector(
            '.catalog-presentation-container'
        );

    const productIdInput =
        card.querySelector(
            '.catalog-product-id'
        );

    const presentationIdInput =
        card.querySelector(
            '.catalog-presentation-id'
        );

    const itemTypeInput =
        card.querySelector(
            '.item-type'
        );

    if (!input) return;

    const nombre =
        box.dataset.nombre;

    const productoId =
        box.dataset.productoId;

    if (!nombre) return;

    let presentaciones = [];

    try {

        presentaciones = JSON.parse(
            box.dataset.presentaciones || '[]'
        );

    } catch (err) {

        console.error(err);

        return;
    }

    // ==========================
    // MARCAR COMO PRODUCTO CATÁLOGO
    // ==========================

    itemTypeInput.value = 'catalogo';

    productIdInput.value = productoId;

    input.value = nombre;

    // ==========================
    // OCULTAR UNIDADES MANUALES
    // ==========================

    manualContainer.classList.add(
        'hidden'
    );

    // ==========================
    // CONSTRUIR PRESENTACIONES
    // ==========================

    let options = '';

    presentaciones.forEach((p, index) => {

        if (index === 0) {

            presentationIdInput.value = p.id;

        }

        options += `
            <option value="${p.id}">
                ${p.nombre_presentacion}
                ${p.unidad ? `(${p.unidad})` : ''}
            </option>
        `;
    });

    catalogContainer.innerHTML = `
        <label
            class="block text-[10px]
                   font-bold
                   text-slate-500
                   mb-1">

            Presentación

        </label>

        <select
            class="catalog-presentation-select
                   w-full py-3 rounded-xl
                   border border-emerald-200
                   bg-white text-xs font-bold">

            ${options}

        </select>
    `;

    catalogContainer.classList.remove(
        'hidden'
    );

    // ==========================
    // GUARDAR PRESENTACIÓN
    // ==========================

    const select =
        catalogContainer.querySelector(
            '.catalog-presentation-select'
        );

    if (select) {

        select.addEventListener(
            'change',
            function(){

                presentationIdInput.value =
                    this.value;

            }
        );

    }

    box.classList.add('hidden');

    input.classList.add(
        'border-emerald-400'
    );
}
// ==========================
// EVENTOS GLOBALES
// ==========================

document.addEventListener("click", (e) => {
  const suggestionBox = e.target.closest(".suggestion-box");
  if (suggestionBox) {
    applySuggestion(suggestionBox);
    return;
  }
  const addButton = e.target.closest(".add-custom-field");
  if (addButton) {
    const card = addButton.closest(".custom-item-card");
    if (!card) return;
    const clone = card.cloneNode(true);
    resetCard(clone);
    const container = card.closest(".manual-products-grid");
    if (!container) return;
    container.appendChild(clone);
    const newInput = clone.querySelector(".custom-search");
    if (newInput) {
      newInput.focus();
    }
  }
});

// ==========================
// 🚀 ENVÍO AJAX
// ==========================
document
  .getElementById("form-pedido")
  ?.addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = this;
    const submitButtons = form.querySelectorAll('button[type="submit"]');

    submitButtons.forEach((btn) => (btn.disabled = true));

    const formData = new FormData(form);

    let progress = 0;
    let swalInstance;

    try {
      // 🔵 LOADER SWEETALERT CON PROGRESO
      swalInstance = Swal.fire({
        title: "Procesando tu pedido",
        html: "Enviando información... <b>0%</b>",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();

          const b = Swal.getHtmlContainer().querySelector("b");

          const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 12);

            if (progress >= 95) progress = 95; // no llega a 100 hasta respuesta real

            b.textContent = progress + "%";
          }, 200);

          swalInstance._progressInterval = interval;
        },
      });

      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Respuesta inválida:", text);

        Swal.close();

        Swal.fire({
          icon: "error",
          title: "Error del servidor",
          text: "El servidor devolvió una respuesta inválida",
        });

        return;
      }

      // 🔵 detener loader
      if (swalInstance?._progressInterval) {
        clearInterval(swalInstance._progressInterval);
      }

      // completar progreso
      progress = 100;

      Swal.close();

      // =========================
      // SUCCESS
      // =========================
      if (data.status === "success") {
        Swal.fire({
          icon: "success",
          title: "Pedido enviado",
          text: data.message,
          confirmButtonColor: "#10b981",
        });

        form.reset();

        document.querySelectorAll(".product-card").forEach((card) => {
          card.classList.remove("has-value");
        });

        document.querySelectorAll(".fraction-display").forEach((el) => {
          el.textContent = "";
        });

        document.querySelectorAll(".suggestion-box").forEach((box) => {
          box.classList.add("hidden");
          box.innerHTML = "";
          box.dataset.nombre = "";
          box.dataset.presentaciones = "";
        });

        updateGlobalTotal();
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Ocurrió un problema",
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);

      if (swalInstance?._progressInterval) {
        clearInterval(swalInstance._progressInterval);
      }

      Swal.close();

      Swal.fire({
        icon: "error",
        title: "Error del servidor",
        text: "No se pudo procesar el pedido",
      });
    } finally {
      submitButtons.forEach((btn) => (btn.disabled = false));
    }
  });


// =========================
// PRESENTACIONES + UNIDADES
// =========================
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".presentation-select").forEach(function (presentationSelect) {
    const card = presentationSelect.closest(".product-card");
    const unitSelect = card.querySelector(".unit-select");

    const productId = presentationSelect.dataset.product;

    const rawEl = document.getElementById(`product-data-${productId}`);

    if (!rawEl) {
      console.warn("No se encontró product-data:", productId);
      return;
    }

    let data = [];

    try {
      data = JSON.parse(rawEl.textContent || "[]");
    } catch (e) {
      console.error("JSON inválido en product-data:", productId);
      return;
    }

    // ==========================
    // FIX: el <option value> del select de presentación
    // es el ÍNDICE dentro del array (forloop.counter0 en el
    // template), NO un id real. El JSON generado por Django
    // tampoco trae un campo "id" por grupo de presentación
    // (solo lo trae cada variante dentro de "variantes").
    // Por eso había que acceder por índice y no buscar por id.
    // ==========================
    function loadUnits(presentationIndex) {
      const presentation = data[presentationIndex];

      if (!presentation) {
        console.warn("Presentación no encontrada:", presentationIndex);
        unitSelect.innerHTML = "";
        return;
      }

      unitSelect.innerHTML = "";

      presentation.variantes.forEach(function (item) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.unidad;
        unitSelect.appendChild(option);
      });
    }

    // carga inicial (primer índice del array)
    if (data.length > 0) {
      loadUnits(0);
    }

    presentationSelect.addEventListener("change", function () {
      loadUnits(this.value);
    });
  });
});