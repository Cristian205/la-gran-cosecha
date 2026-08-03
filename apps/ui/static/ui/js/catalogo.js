function confirmarRegistro() {
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Se registrará el nuevo producto con sus presentaciones.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#16a34a", // verde-600
    cancelButtonColor: "#d33",
    confirmButtonText: "Sí, registrar",
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (result.isConfirmed) {
      // ESTA LÍNEA ES LA QUE GUARDA EN LA BASE DE DATOS
      document.getElementById("formRegistroProducto").submit();
    }
  });
}
function getCookie(name) {
  let cookieValue = null;

  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();

      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));

        break;
      }
    }
  }

  return cookieValue;
}

const csrftoken = getCookie("csrftoken");

function eliminarProducto(id) {
  Swal.fire({
    title: "¿Eliminar producto?",
    text: "Se eliminarán todas las presentaciones y precios asociados.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/productos/eliminar/${id}/`, {
        method: "POST",

        headers: {
          "X-CSRFToken": csrftoken,
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire({
              icon: "success",
              title: "Eliminado",
              text: data.message,
              timer: 2000,
              showConfirmButton: false,
            });

            location.reload();
          } else {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: data.message,
            });
          }
        });
    }
  });
}
