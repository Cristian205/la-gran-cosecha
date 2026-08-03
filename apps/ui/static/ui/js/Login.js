/**
 * LOGIN.JS - AUTENTICACIÓN OTP / 2FA
 * La Gran Cosecha
 */

document.addEventListener('DOMContentLoaded', () => {

    // Inicializar OTP
    inicializarEventosOTP();

    // Formulario principal
    const authForm = document.getElementById('authForm');

    if (authForm) {

        authForm.addEventListener('submit', function (e) {
            e.preventDefault();
            gestionarEnvio(authForm);
        });

    }

});


/**
 * Decide qué paso enviar
 */
function gestionarEnvio(formElement) {

    const verificationStep = document.getElementById('verification-step');

    const otpVisible =
        verificationStep &&
        !verificationStep.classList.contains('hidden');

    // =========================
    // PASO OTP
    // =========================
    if (otpVisible) {

        const otp = document.getElementById('full_otp').value;

        if (otp.length !== 6) {

            Swal.fire({
                icon: 'warning',
                title: 'Código incompleto',
                text: 'Debe ingresar los 6 dígitos.'
            });

            return;
        }

        enviarFormulario(formElement, true);

    } else {

        // =========================
        // LOGIN NORMAL
        // =========================
        enviarFormulario(formElement, false);

    }

}


/**
 * Enviar formulario vía Fetch
 */
function enviarFormulario(formElement, isOtp = false) {

    const formData = new FormData(formElement);

    // Refuerzo OTP
    if (isOtp) {

        const otpValue = document.getElementById('full_otp').value;

        formData.set('otp_token', otpValue);

    }

    const csrfToken =
        getCookie('csrftoken') ||
        document.querySelector('[name=csrfmiddlewaretoken]').value;

    // =========================
    // LOADING
    // =========================
    Swal.fire({
        title: 'Procesando...',
        text: 'Espere un momento.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // =========================
    // FETCH
    // =========================
    fetch(formElement.action, {

        method: 'POST',

        credentials: 'include',

        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },

        body: formData

    })
    .then(async response => {

        const data = await response.json();

        if (!response.ok) {
            throw data;
        }

        return data;

    })
    .then(data => {

        Swal.close();

        // =========================
        // LOGIN EXITOSO
        // =========================
        if (data.redirect_url) {

            window.location.href = data.redirect_url;
            return;

        }

        // =========================
        // MOSTRAR PASO OTP
        // =========================
        if (data.step === 2) {

            mostrarPasoOTP();

            Swal.fire({
                icon: 'success',
                title: 'Código enviado',
                text: data.message
            });

        }

    })
    .catch(error => {

        Swal.close();

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Ocurrió un error.'
        });

        console.error('ERROR LOGIN:', error);

    });

}


/**
 * Mostrar interfaz OTP
 */
function mostrarPasoOTP() {

    const loginFields =
        document.getElementById('login-fields');

    const verificationStep =
        document.getElementById('verification-step');

    if (loginFields) {

        loginFields.classList.add('hidden');
        loginFields.style.display = 'none';

    }

    if (verificationStep) {

        verificationStep.classList.remove('hidden');
        verificationStep.style.display = 'block';

    }

    inicializarEventosOTP();

}


/**
 * Eventos de inputs OTP
 */
function inicializarEventosOTP() {

    const inputs =
        document.querySelectorAll('.otp-field');

    const hiddenInput =
        document.getElementById('full_otp');

    if (!inputs.length) return;

    // Focus automático
    setTimeout(() => {
        inputs[0].focus();
    }, 300);

    inputs.forEach((input, index) => {

        // =========================
        // INPUT
        // =========================
        input.addEventListener('input', (e) => {

            // Solo números
            e.target.value =
                e.target.value.replace(/[^0-9]/g, '');

            // Siguiente input
            if (
                e.target.value.length === 1 &&
                index < inputs.length - 1
            ) {

                inputs[index + 1].focus();

            }

            actualizarOTP();

        });

        // =========================
        // TECLAS
        // =========================
        input.addEventListener('keydown', (e) => {

            // Retroceder
            if (
                e.key === 'Backspace' &&
                !e.target.value &&
                index > 0
            ) {

                inputs[index - 1].focus();

            }

            // Enter
            if (e.key === 'Enter') {

                e.preventDefault();

                gestionarEnvio(
                    document.getElementById('authForm')
                );

            }

        });

        // =========================
        // PEGAR OTP
        // =========================
        input.addEventListener('paste', (e) => {

            e.preventDefault();

            const pasted =
                e.clipboardData
                .getData('text')
                .trim();

            // Validar OTP
            if (
                pasted.length === 6 &&
                /^\d+$/.test(pasted)
            ) {

                const digits = pasted.split('');

                inputs.forEach((inp, i) => {
                    inp.value = digits[i] || '';
                });

                actualizarOTP();

                gestionarEnvio(
                    document.getElementById('authForm')
                );

            }

        });

    });

    /**
     * Actualizar hidden input
     */
    function actualizarOTP() {

        let code = '';

        inputs.forEach(input => {
            code += input.value;
        });

        hiddenInput.value = code;

    }

}


/**
 * Obtener cookie CSRF
 */
function getCookie(name) {

    let cookieValue = null;

    if (document.cookie && document.cookie !== '') {

        const cookies = document.cookie.split(';');

        for (let i = 0; i < cookies.length; i++) {

            const cookie = cookies[i].trim();

            if (
                cookie.substring(0, name.length + 1) ===
                (name + '=')
            ) {

                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );

                break;

            }

        }

    }

    return cookieValue;

}