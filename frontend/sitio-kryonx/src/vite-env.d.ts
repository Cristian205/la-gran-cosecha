/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Número de WhatsApp comercial de Crafteech, con indicativo. Sin definir, no se pintan los botones de WhatsApp. */
  readonly VITE_WHATSAPP_NUMERO?: string;
  /** URL base del backend de la plataforma. Vacía: mismo origen (en desarrollo, el proxy de Vite). */
  readonly VITE_API_URL?: string;
}
