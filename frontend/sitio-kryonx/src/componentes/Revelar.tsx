import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

/**
 * Aparece al entrar en pantalla, una sola vez. Mismo criterio que `Reveal` en
 * la tienda: sube poco, dura poco, y quien pide menos movimiento lo recibe ya
 * colocado (de eso se encarga `MotionConfig` en `App`).
 */
export function Revelar({
  retraso = 0,
  desde = 28,
  children,
  ...resto
}: Omit<HTMLMotionProps<"div">, "initial" | "whileInView"> & {
  retraso?: number;
  desde?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: desde }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
      {...resto}
    >
      {children}
    </motion.div>
  );
}
