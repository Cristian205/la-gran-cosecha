/**
 * Compatibilidad: la tabla de empresas ahora es parte del sistema de empresas
 * (`componentes/empresas/`), con vista de tabla y de tarjetas sobre los mismos
 * datos. El Dashboard sigue usándola en su versión compacta.
 */
export { ListadoEmpresas as TablaEmpresas } from "./empresas/ListadoEmpresas";
