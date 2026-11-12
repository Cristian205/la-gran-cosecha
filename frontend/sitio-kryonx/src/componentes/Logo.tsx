import isotipo from "../assets/crafteech-isotipo.webp";

/**
 * El isotipo (el triángulo con su órbita) y el nombre. El nombre va en texto y
 * no dentro de la imagen: se lee nítido a cualquier tamaño y lo leen los
 * lectores de pantalla.
 */
export function Logo({ conNombre = true }: { conNombre?: boolean }) {
  return (
    <span className="logo">
      <img src={isotipo} alt="" width={40} height={33} className="logo__marca" />
      {conNombre && (
        <span className="logo__nombre" aria-label="CrafTeech">
          <span aria-hidden="true">
            CrafT<i>ee</i>ch
          </span>
        </span>
      )}
    </span>
  );
}
