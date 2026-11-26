/**
 * La pantalla de carga de la app instalada.
 *
 * Por qué es HTML del servidor y no un componente de React
 * --------------------------------------------------------
 * Tiene que verse en el PRIMER pintado, antes de que llegue y se ejecute el
 * JavaScript de la tienda: es justo ese rato el que cubre. Así que el marcado
 * sale en el HTML, la decide un script mínimo del <head> (antes de pintar) y
 * la mueve otro script en línea, sin esperar a React. React la deja en paz:
 * va dentro de `dangerouslySetInnerHTML` con `suppressHydrationWarning`, y el
 * script solo cambia atributos y textos de dentro.
 *
 * Cuándo sale
 * -----------
 * Solo al abrir la tienda como app instalada (`display-mode: standalone`, o
 * el «Añadir a inicio» de iPhone), una vez por sesión. En el navegador normal
 * nunca: a quien llega desde Google no se le hace esperar delante de un
 * logo. Para verla en el navegador: `?vista-arranque` (se queda fija).
 *
 * Antes de esta pantalla Android sigue mostrando un instante su propio
 * arranque (el ícono sobre el color de fondo del manifiesto): ese lo dibuja
 * el sistema y no se puede cambiar desde la web.
 *
 * El progreso es real
 * -------------------
 * La barra no avanza sola. Suma etapas que de verdad ocurren al arrancar, sin
 * pedir nada nuevo al servidor (solo observa lo que la página ya carga):
 *
 *   10 %  el HTML llegó (si este script corre, ya está)
 *   20 %  las fuentes de la tienda están listas (`document.fonts.ready`)
 *   40 %  las imágenes visibles de la portada, una por una
 *   30 %  la app está lista: React montado y el carrito, la sesión y el
 *         último pedido recuperados (`tienda:lista`, ver `CapaCliente`)
 *
 * Para que nunca se quede colgada: con la app lista espera a las imágenes a
 * lo sumo 3 s más; a los 5 s avisa que la conexión va lenta; sin conexión lo
 * dice, y a los 10 s se va de todos modos con lo que haya.
 *
 * El nombre y el logo son los del negocio (configuración). El eslogan, los
 * tres atributos y las frutas y verduras son los de La Gran Cosecha, igual
 * que el camión del pie.
 */

const ESLOGAN = "Frutas, verduras y más, del campo a tu negocio";

/** La clave de la sesión: la pantalla sale una vez, no en cada recarga. */
const CLAVE_VISTA = "arranque-visto";

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Iconos de trazo, del mismo grosor, en el verde de la marca. */
const ICONOS = {
  hoja: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  escudo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  camion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
};

/** Una hoja pequeña para el adorno superior (relleno, en dos verdes). */
const HOJA = `<svg viewBox="0 0 40 40"><path d="M6 34C6 16 18 6 36 4c-1 18-11 30-30 30Z" fill="currentColor"/><path d="M6 34C14 24 22 16 30 10" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4" stroke-linecap="round"/></svg>`;

function marcado(nombre: string, logoUrl: string | null): string {
  const n = escapar(nombre);
  const logo = logoUrl
    ? `<img src="${escapar(logoUrl)}" alt="${n}" decoding="async" fetchpriority="high">`
    : `<span class="arr-logo-letra">${escapar(nombre.slice(0, 1).toUpperCase())}</span>`;

  return `
<div class="arr-decor" aria-hidden="true">
  <svg class="arr-ondas-sup" viewBox="0 0 400 150" preserveAspectRatio="none">
    <path class="arr-onda-1" d="M0 0h400v78c-58 26-112 30-170 14C160 72 92 70 0 104Z"/>
    <path class="arr-onda-2" d="M0 0h400v50c-70 34-132 34-196 14C138 44 70 50 0 78Z"/>
    <path class="arr-onda-3" d="M0 0h400v24c-62 26-122 28-186 10C150 16 76 22 0 44Z"/>
  </svg>
  <span class="arr-hoja arr-hoja--1">${HOJA}</span>
  <span class="arr-hoja arr-hoja--2">${HOJA}</span>
  <span class="arr-hoja arr-hoja--3">${HOJA}</span>
</div>

<div class="arr-contenido">
  <div class="arr-marca">
    <div class="arr-logo">${logo}</div>
    <p class="arr-nombre">${n}</p>
    <p class="arr-eslogan">${escapar(ESLOGAN)}</p>
  </div>

  <div class="arr-carga">
    <div class="arr-pista" role="progressbar" aria-label="Cargando ${n}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="10">
      <span class="arr-barra" data-barra></span>
      <span class="arr-camion" data-camion aria-hidden="true">${ICONOS.camion}</span>
    </div>
    <div class="arr-estado">
      <span class="arr-mensaje" data-mensaje aria-live="polite">Preparando tu tienda…</span>
      <span class="arr-porcentaje" data-porcentaje>10%</span>
    </div>
  </div>

  <ul class="arr-atributos">
    <li><span class="arr-icono">${ICONOS.hoja}</span>Productos frescos</li>
    <li><span class="arr-icono">${ICONOS.escudo}</span>Calidad garantizada</li>
    <li><span class="arr-icono">${ICONOS.camion}</span>Entregas oportunas</li>
  </ul>
</div>

<div class="arr-cosecha" aria-hidden="true">
  <img src="/img/arranque/cosecha-sm.webp" srcset="/img/arranque/cosecha-sm.webp 640w, /img/arranque/cosecha.webp 1200w" sizes="(min-width: 760px) 720px, 100vw" width="1200" height="400" alt="" decoding="async">
  <svg class="arr-ondas-inf" viewBox="0 0 400 90" preserveAspectRatio="none">
    <path class="arr-onda-4" d="M0 22C60 2 120 0 190 20s150 34 210 6v64H0Z"/>
    <path class="arr-onda-5" d="M0 58c70-24 140-26 214-6 66 18 124 16 186-10v48H0Z"/>
  </svg>
</div>`;
}

/**
 * Va en el <head>: decide ANTES de pintar si la pantalla se muestra, para que
 * no haya ni un fotograma de la tienda detrás.
 */
export const SCRIPT_DECIDIR_ARRANQUE = `(function(){try{var f=/[?&]vista-arranque(?:[=&]|$)/.test(location.search);var a=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(!f&&(!a||sessionStorage.getItem('${CLAVE_VISTA}')))return;document.documentElement.setAttribute('data-arranque',f?'fijo':'activo')}catch(e){}})();`;

/** Mueve la barra con las etapas reales y cierra la pantalla. */
const SCRIPT_PROGRESO = `(function(){
var raiz=document.documentElement,modo=raiz.getAttribute('data-arranque');
var el=document.getElementById('arranque');
if(!modo||!el)return;
try{sessionStorage.setItem('${CLAVE_VISTA}','1')}catch(e){}
var barra=el.querySelector('[data-barra]'),camion=el.querySelector('[data-camion]'),pct=el.querySelector('[data-porcentaje]'),msj=el.querySelector('[data-mensaje]'),pista=el.querySelector('[role=progressbar]');
var etapas=[
 {k:'html',peso:10,v:1,m:'Preparando tu tienda…'},
 {k:'fuentes',peso:20,v:0,m:'Preparando tu tienda…'},
 {k:'imagenes',peso:40,v:0,m:'Cargando productos frescos…'},
 {k:'app',peso:30,v:0,m:'Recuperando tu carrito…'}
];
var terminado=false,lento=false,sinRed=!navigator.onLine,texto=msj.textContent,cambio=0;
function etapa(k){for(var i=0;i<etapas.length;i++)if(etapas[i].k===k)return etapas[i]}
function total(){var t=0;for(var i=0;i<etapas.length;i++)t+=etapas[i].peso*Math.min(1,etapas[i].v);return Math.round(t)}
function mensaje(p){
 if(p>=100)return '¡Todo listo!';
 if(sinRed)return 'Sin conexión. Revisa tu internet…';
 if(lento)return 'La conexión está lenta, ya casi…';
 for(var i=0;i<etapas.length;i++)if(etapas[i].v<1)return etapas[i].m;
 return '¡Todo listo!';
}
function decir(t){
 if(t===texto)return;texto=t;
 clearTimeout(cambio);msj.classList.add('arr-mensaje--sale');
 cambio=setTimeout(function(){msj.textContent=texto;msj.classList.remove('arr-mensaje--sale')},180);
}
function pintar(){
 var p=total();
 barra.style.transform='scaleX('+(p/100)+')';
 camion.style.left=p+'%';
 pct.textContent=p+'%';
 pista.setAttribute('aria-valuenow',String(p));
 decir(mensaje(p));
 if(p>=100)cerrar();
}
function marcar(k,v){var e=etapa(k);if(v>e.v){e.v=v;pintar()}}
function cerrar(){
 if(terminado||modo==='fijo')return;terminado=true;
 setTimeout(function(){
  raiz.setAttribute('data-arranque','saliendo');
  setTimeout(function(){raiz.removeAttribute('data-arranque')},600);
 },380);
}
function imagenes(){
 var todas=[].slice.call(document.images).filter(function(i){
  if(el.contains(i))return false;
  var r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;
 });
 if(!todas.length)return marcar('imagenes',1);
 var listas=0;
 function una(){listas++;marcar('imagenes',listas/todas.length)}
 todas.forEach(function(i){
  if(i.complete)una();
  else{var hecha=false;function f(){if(!hecha){hecha=true;una()}}i.addEventListener('load',f);i.addEventListener('error',f)}
 });
}
function fuentes(){
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){marcar('fuentes',1)},function(){marcar('fuentes',1)});
 else marcar('fuentes',1);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){fuentes();imagenes()});
else{fuentes();imagenes()}
function lista(){
 marcar('app',1);
 // Lo indispensable ya está: las imágenes que falten tienen 3 s más.
 setTimeout(function(){if(!terminado)marcar('imagenes',1)},3000);
}
if(window.__tiendaLista)lista();else addEventListener('tienda:lista',lista);
addEventListener('offline',function(){sinRed=true;pintar()});
addEventListener('online',function(){sinRed=false;pintar()});
setTimeout(function(){lento=true;pintar()},5000);
setTimeout(cerrar,10000);
pintar();
})();`;

export function PantallaArranque({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  return (
    <>
      <div
        id="arranque"
        className="arranque"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: marcado(nombre, logoUrl) }}
      />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_PROGRESO }} />
    </>
  );
}
