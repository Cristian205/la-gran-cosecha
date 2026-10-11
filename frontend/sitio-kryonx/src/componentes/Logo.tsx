import monograma from "../assets/logo-kryonx-marca-inverso.png";

/** La pantera y el nombre. El nombre va en texto: se lee nítido a cualquier tamaño. */
export function Logo({ conNombre = true }: { conNombre?: boolean }) {
  return (
    <span className="logo">
      <img src={monograma} alt="" width={38} height={27} className="logo__marca" />
      {conNombre && (
        <span className="logo__nombre">
          KRYON <b>X</b>
        </span>
      )}
    </span>
  );
}
