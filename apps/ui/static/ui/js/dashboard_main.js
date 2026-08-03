document.addEventListener("DOMContentLoaded", function () {
  // =====================================================
  // VALIDACIÓN CHART.JS
  // =====================================================

  if (typeof Chart === "undefined") {
    console.error("Chart.js no está cargado.");
    return;
  }

  // =====================================================
  // CONFIGURACIÓN GLOBAL
  // =====================================================

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = "#6b7280";

  // =====================================================
  // DATOS DESDE DJANGO
  // =====================================================
  // Este script se carga en TODAS las páginas (está incluido en el
  // layout base Admin-Dashboard.html), pero los <script id="..."> con
  // los datos de los gráficos solo existen en la página del dashboard.
  // Por eso leemos con esta función segura: si el elemento no existe
  // o el JSON es inválido, devolvemos [] en vez de romper el script
  // (lo que antes bloqueaba también la ejecución de otros widgets,
  // como el de notificaciones de Alpine, en páginas que no son el
  // dashboard).
  const getJsonData = (id) => {
    const el = document.getElementById(id);

    if (!el) {
      // Es normal que no exista fuera de la página del dashboard.
      return [];
    }

    const raw = el.textContent.trim();

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`JSON inválido en #${id}:`, e);
      return [];
    }
  };

  const categoryLabels = getJsonData("category-labels");
  const categoryValues = getJsonData("category-values");
  const topProductsLabels = getJsonData("top-products-labels");
  const topProductsData = getJsonData("top-products-data");
  const customersLabels = getJsonData("customers-labels");
  const customersData = getJsonData("customers-data");
  const ordersLabels = getJsonData("orders-labels");
  const ordersData = getJsonData("orders-data");

  // Si no estamos en la página del dashboard, ninguno de los
  // canvases existirá tampoco, así que no tiene sentido seguir.
  if (
    !document.getElementById("ordersChart") &&
    !document.getElementById("categoryChart") &&
    !document.getElementById("topProductsChart") &&
    !document.getElementById("customersChart")
  ) {
    return;
  }

  // =====================================================
  // FUNCIÓN AUXILIAR
  // =====================================================

  const initChart = (id, config) => {
    const element = document.getElementById(id);

    if (!element) {
      console.warn(`Canvas no encontrado: ${id}`);
      return null;
    }

    return new Chart(element.getContext("2d"), config);
  };

  // =====================================================
  // 1. RENDIMIENTO LOGÍSTICO
  // =====================================================

  const ordersCanvas = document.getElementById("ordersChart");

  if (ordersCanvas) {
    const ctxOrders = ordersCanvas.getContext("2d");

    const gradientOrders = ctxOrders.createLinearGradient(0, 0, 0, 300);

    gradientOrders.addColorStop(0, "rgba(79,70,229,0.25)");
    gradientOrders.addColorStop(1, "rgba(79,70,229,0.0)");

    new Chart(ctxOrders, {
      type: "line",

      data: {
        labels: ordersLabels.length ? ordersLabels : ["Sin datos"],

        datasets: [
          {
            label: "Ventas",

            data: ordersData.length ? ordersData : [0],

            borderColor: "#4f46e5",

            backgroundColor: gradientOrders,

            fill: true,

            tension: 0.4,

            borderWidth: 3,

            pointRadius: 4,

            pointHoverRadius: 6,
          },
        ],
      },

      options: {
        responsive: true,

        maintainAspectRatio: false,

        interaction: {
          intersect: false,
          mode: "index",
        },

        plugins: {
          legend: {
            display: false,
          },
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            border: {
              display: false,
            },
          },

          y: {
            beginAtZero: true,

            grid: {
              color: "rgba(148,163,184,0.08)",
            },

            border: {
              display: false,
            },
          },
        },
      },
    });
  }

  // =====================================================
  // 2. CATEGORÍAS
  // =====================================================

  initChart("categoryChart", {
    type: "doughnut",

    data: {
      labels: categoryLabels.length ? categoryLabels : ["Sin datos"],

      datasets: [
        {
          data: categoryValues.length ? categoryValues : [0],

          backgroundColor: [
            "#4f46e5",
            "#10b981",
            "#f59e0b",
            "#6366f1",
            "#ef4444",
            "#06b6d4",
          ],

          borderWidth: 0,

          hoverOffset: 4,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      cutout: "70%",

      plugins: {
        legend: {
          position: "bottom",

          labels: {
            usePointStyle: true,

            boxWidth: 8,
          },
        },
      },
    },
  });

  // =====================================================
  // 3. TOP PRODUCTOS
  // =====================================================

  initChart("topProductsChart", {
    type: "bar",

    data: {
      labels: topProductsLabels.length ? topProductsLabels : ["Sin datos"],

      datasets: [
        {
          label: "Unidades Vendidas",

          data: topProductsData.length ? topProductsData : [0],

          backgroundColor: "#8b5cf6",

          borderRadius: 6,

          barPercentage: 0.6,
        },
      ],
    },

    options: {
      indexAxis: "y",

      responsive: true,

      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false,
        },
      },

      scales: {
        x: {
          beginAtZero: true,

          grid: {
            display: false,
          },

          border: {
            display: false,
          },
        },

        y: {
          grid: {
            display: false,
          },

          border: {
            display: false,
          },
        },
      },
    },
  });

  // =====================================================
  // 4. NUEVOS CLIENTES
  // =====================================================

  const customersCanvas = document.getElementById("customersChart");

  if (customersCanvas) {
    const ctxCustomers = customersCanvas.getContext("2d");

    const gradientCustomers = ctxCustomers.createLinearGradient(0, 0, 0, 200);

    gradientCustomers.addColorStop(0, "rgba(16,185,129,0.35)");

    gradientCustomers.addColorStop(1, "rgba(16,185,129,0.0)");

    new Chart(ctxCustomers, {
      type: "line",

      data: {
        labels: customersLabels.length ? customersLabels : ["Sin datos"],

        datasets: [
          {
            label: "Clientes",

            data: customersData.length ? customersData : [0],

            borderColor: "#10b981",

            backgroundColor: gradientCustomers,

            fill: true,

            tension: 0.4,

            pointRadius: 0,

            borderWidth: 3,
          },
        ],
      },

      options: {
        responsive: true,

        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: false,
          },
        },

        interaction: {
          mode: "index",

          intersect: false,
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            border: {
              display: false,
            },
          },

          y: {
            beginAtZero: true,

            display: false,

            grid: {
              display: false,
            },

            border: {
              display: false,
            },
          },
        },
      },
    });
  }
});
function getCookie(name) {

    let cookieValue = null;

    if (document.cookie && document.cookie !== '') {

        const cookies = document.cookie.split(';');

        for (let i = 0; i < cookies.length; i++) {

            const cookie = cookies[i].trim();

            if (cookie.substring(0, name.length + 1) === (name + '=')) {

                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );

                break;
            }
        }
    }

    return cookieValue;
}