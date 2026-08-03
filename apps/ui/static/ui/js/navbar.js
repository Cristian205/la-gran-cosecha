/* ==========================================================
   NAVBAR
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const menuToggle = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");
    const navbar = document.getElementById("navbar");

    if (!menuToggle || !navMenu) {
        console.warn("Navbar: elementos no encontrados.");
        return;
    }

    /* ABRIR / CERRAR */

    menuToggle.addEventListener("click", (e) => {

        e.stopPropagation();

        navMenu.classList.toggle("active");

    });

    /* CERRAR AL PULSAR UN LINK */

    navMenu.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            navMenu.classList.remove("active");

        });

    });

    /* CERRAR AL HACER CLICK FUERA */

    document.addEventListener("click", (e) => {

        if (
            navMenu.classList.contains("active") &&
            !navMenu.contains(e.target) &&
            !menuToggle.contains(e.target)
        ) {

            navMenu.classList.remove("active");

        }

    });

    /* SCROLL */

    if (navbar) {

        const updateNavbar = () => {

            if (window.scrollY > 40) {
                navbar.classList.add("scrolled");
            } else {
                navbar.classList.remove("scrolled");
            }

        };

        updateNavbar();

        window.addEventListener(
            "scroll",
            updateNavbar,
            { passive: true }
        );

    }

});