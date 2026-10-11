/**
 * WhatsApp en trazo, del mismo lenguaje que los íconos de lucide (línea de 2px
 * en una caja de 24, extremos redondeados). El logo relleno de `WhatsAppIcon`
 * desentona junto al teléfono, el correo y el pin del pie, que son de línea.
 */
export function WhatsAppLineaIcon({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 20.5l1.3-4.1A8.9 8.9 0 1 1 8 19.4z" />
      <path d="M9.2 8.2c.3-.4.7-.4 1-.1l.8 1.6c.1.3 0 .6-.2.8l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.5-.3.8-.2l1.6.8c.3.3.3.7-.1 1-.7.8-1.6 1-2.6.6a8.4 8.4 0 0 1-4.6-4.6c-.4-1-.2-1.9.5-2.7z" />
    </svg>
  );
}
