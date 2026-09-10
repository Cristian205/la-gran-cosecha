# constructor

Lo que el editor de tiendas de Crynex y el del negocio tienen en comun: los
tipos de una composicion y las operaciones que la mueven.

No es un paquete de npm. Es un directorio de TypeScript que los dos paneles
leen con el alias `@constructor`, declarado en cada `vite.config.ts` y en cada
`tsconfig.json`. No tiene dependencias, no tiene `package.json` y no aparece en
ningun `package-lock.json`.

## Por que no es un paquete

Porque para lo que hay aqui no hace falta, y convertirlo en uno tendria un
coste real: `npm workspaces` cambia donde vive `node_modules`, obliga a un
unico `package-lock.json` en `frontend/` y cambia como instalan el CI, Vercel y
Render. Todo eso para compartir tipos y cuatro funciones.

Haria falta el dia que se quisieran compartir COMPONENTES, porque React no
resuelve desde un directorio sin `node_modules`. Ese dia habra que decidir
antes otra cosa: los dos paneles tienen hojas de estilos distintas —aqui las
clases son `constructor__grupo`, alli `constructor-grupo`— asi que compartir la
pantalla significa imponerle a uno el vocabulario del otro. Es una decision de
diseño, no de empaquetado, y por eso no se toma de paso.

## Que va aqui y que no

    va aqui        los tipos, y cualquier cosa que sea una transformacion pura
                   (una lista de bloques a otra lista de bloques)

    no va aqui     JSX, hooks, clases CSS, textos de pantalla
