import { useState } from "react";
import { Modal } from "../../components/Modal";
import { actualizarUsuario, crearUsuario } from "../../api/resources";
import type { Usuario } from "../../types";
import { extraerMensajeError } from "../../utils";

const ROLES = ["ANALISTA", "ADMIN", "GERENTE"];

interface Props {
  usuario: Usuario | null;
  puedeEditarRol: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function UserFormModal({ usuario, puedeEditarRol, onCerrar, onGuardado }: Props) {
  const esEdicion = usuario !== null;

  const [nombre, setNombre] = useState(usuario?.nombre_usuario ?? "");
  const [email, setEmail] = useState(usuario?.email_usuario ?? "");
  const [rol, setRol] = useState(usuario?.rol_usuario ?? "ANALISTA");
  const [activo, setActivo] = useState(usuario?.is_active ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || (!esEdicion && !email.trim())) {
      setError("El nombre" + (esEdicion ? "" : " y el correo") + " son obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      if (esEdicion) {
        await actualizarUsuario(usuario!.id, {
          nombre_usuario: nombre.trim(),
          is_active: activo,
          ...(puedeEditarRol ? { rol_usuario: rol } : {}),
        });
        onGuardado();
      } else {
        const resp = await crearUsuario({ email: email.trim(), nombre: nombre.trim(), rol });
        setPasswordTemporal(resp.password_temporal);
      }
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el usuario."));
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (passwordTemporal) onGuardado();
    else onCerrar();
  }

  return (
    <Modal
      lateral
      titulo={esEdicion ? "Editar usuario" : "Nuevo usuario"}
      onCerrar={cerrar}
      footer={
        passwordTemporal ? (
          <button className="btn primario" onClick={cerrar}>
            Listo
          </button>
        ) : (
          <>
            <button className="btn secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="btn primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear usuario"}
            </button>
          </>
        )
      }
    >
      {passwordTemporal ? (
        <div className="ok-box">
          Usuario creado. Clave temporal:{" "}
          <strong style={{ fontSize: "1.1rem" }}>{passwordTemporal}</strong>
          <br />
          Compártela con el usuario; deberá cambiarla al ingresar.
        </div>
      ) : (
        <form onSubmit={guardar}>
          {error && <div className="error-box">{error}</div>}

          <div className="campo">
            <label>Nombre completo *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          {!esEdicion && (
            <div className="campo">
              <label>Correo electrónico *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div className="campo">
            <label>Rol {!puedeEditarRol && esEdicion && "(solo un Gerente puede cambiarlo)"}</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              disabled={esEdicion && !puedeEditarRol}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {esEdicion && (
            <div className="campo">
              <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Cuenta activa
              </label>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
