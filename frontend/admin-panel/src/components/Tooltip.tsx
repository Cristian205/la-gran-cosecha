import { useId, useState, type ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
  posicion?: "arriba" | "abajo" | "izquierda" | "derecha";
}

export function Tooltip({ label, children, posicion = "arriba" }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`tooltip-bubble tooltip-${posicion} ${visible ? "visible" : ""}`}
      >
        {label}
      </span>
    </span>
  );
}
