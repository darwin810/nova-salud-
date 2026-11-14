# Nova Salud

Aplicación web full stack para controlar el inventario, registrar ventas y agilizar la atención en una botica. Interfaz en español, precios en soles (PEN) y diseño adaptable a computador, tableta y celular.

## Tecnologías

- **Frontend:** HTML semántico, CSS adaptable y JavaScript moderno.
- **Servidor y API:** Node.js 20 o superior y Express.
- **Base de datos:** MongoDB 7 con Mongoose. MongoDB debe ejecutarse como replica set para que las ventas usen transacciones.
- **Seguridad:** JWT firmado, cookies `HttpOnly`/`SameSite=Strict`, `Secure` en producción, contraseñas con bcrypt (12 rondas), Helmet, CSP, validación con Zod, protección de origen, límite de intentos y control optimista de versiones.
- **Arquitectura MVC por capas:** `src/models` define los modelos MongoDB; `src/views` contiene la vista HTML; `src/routes` mapea los endpoints; `src/controllers` recibe la petición y responde; `src/services` concentra autenticación, inventario y ventas; `src/middleware` aplica autenticación y protección de origen.

## Requisitos

- Node.js 20+ y npm.
- MongoDB Community Server instalado. En Windows, `mongod.exe` suele quedar bajo `C:\Program Files\MongoDB\Server\<versión>\bin`.
- `mongosh` es opcional para la aplicación; instálalo si quieres consultar la base desde la consola.

## Inicio rápido en Windows y VS Code

Clona el repositorio, instala dependencias y ejecuta el proyecto:

```powershell
git clone https://github.com/darwin810/nova-salud-.git
cd nova-salud-
npm install
npm run dev
```

`npm run dev` inicia automáticamente `mongod.exe` como una instancia local privada de Nova en el puerto `27018`, configura el replica set `rs0` y luego arranca el servidor web. No requiere `.env`, Docker ni comandos manuales de configuración de MongoDB. Los archivos de base de datos quedan en `data/mongodb/` dentro del proyecto y se conservan al cerrar el programa. El servicio MongoDB normal del equipo, si ya existe, no se modifica.

Cuando aparezca `MongoDB listo: nova_salud` y `Nova Salud disponible en http://localhost:3000`, abre [http://localhost:3000](http://localhost:3000). Ingresa con **admin / 123456** y elige una nueva contraseña de al menos 12 caracteres. Esas credenciales son solo para desarrollo local.

La primera ejecución crea la base `nova_salud`, las colecciones `usuarios`, `productos` y `ventas`, sus índices y el documento inicial del administrador. La contraseña se guarda como hash bcrypt; el catálogo comienza vacío para que registres los productos de prueba o de la botica.

Para revisar los datos, abre otra terminal y ejecuta:

```powershell
mongosh "mongodb://localhost:27018/nova_salud?replicaSet=rs0"
```

Dentro de `mongosh`, ejecuta `show collections` y `db.usuarios.find()`. El documento contiene `passwordHash`, no la contraseña en texto plano.

Si `npm run dev` dice que no encuentra `mongod.exe`, instala MongoDB Community Server y vuelve a abrir VS Code para que Windows actualice las rutas. Si usas una instalación no estándar, copia `.env.example` a `.env` y configura `MONGOD_PATH`. Si el puerto `27018` ya está ocupado, cierra el otro proceso MongoDB que lo usa o configura una URI propia en `.env`.

Para producción no uses este iniciador local: configura `NODE_ENV=production`, `MONGODB_URI` con un replica set protegido, `JWT_SECRET` aleatorio, `APP_ORIGIN` HTTPS y credenciales seguras para el administrador.

### Comprobación de las funciones

1. En **Inventario → Nuevo producto**, agrega un producto de prueba con precio `10.50`, existencias `5` y mínimo `2`.
2. En **Nueva venta**, agrega una unidad, escribe opcionalmente un cliente y confirma. Verifica que el total sea `S/ 10.50` y que el inventario ahora muestre `4`.
3. En **Historial de ventas**, comprueba que aparezca la venta con su detalle y total.
4. Edita el producto y deja el stock en `2`; debe aparecer en el panel de reposición. Si lo dejas en `0`, debe marcarse como agotado.
5. Para revisar MongoDB, ejecuta `mongosh "mongodb://localhost:27018/nova_salud?replicaSet=rs0"`, luego `show collections` y `db.usuarios.find()`.

En `development`, si la base aún no tiene administrador, Nova crea el acceso inicial solicitado: **usuario `admin`, contraseña `123456`**. El sistema fuerza el cambio inmediato a una contraseña de al menos 12 caracteres. Esta credencial solo se proporciona para desarrollo local; nunca uses esa contraseña en un entorno público.

## Variables privadas

Revisa `.env.example`. En producción configura `NODE_ENV=production`, `MONGODB_URI` con usuario de mínimo privilegio y TLS, `JWT_SECRET` generado aleatoriamente, `APP_ORIGIN` con el origen HTTPS público exacto y `ADMIN_USERNAME`/`ADMIN_PASSWORD` seguros para el administrador inicial. El servidor exige una contraseña inicial de al menos 12 caracteres en producción y fuerza el cambio tras el primer ingreso. En desarrollo, `npm run dev` inicia una instancia local de MongoDB en el puerto 27018 y, si falta `JWT_SECRET`, crea una clave temporal en memoria. No pongas secretos en `public/`, HTML ni scripts del navegador. Monta el servidor detrás de un proxy HTTPS correctamente configurado.

## Base de datos y reglas de operación

Mongoose crea las colecciones e índices necesarios (`usuarios`, `productos`, `ventas`) al iniciar. No hace falta una migración manual inicial. Las ventas guardan una instantánea del precio de catálogo, el importe se calcula solo en el servidor y cada operación descuenta existencias y registra la venta en una transacción MongoDB. La clave `Idempotency-Key` evita duplicar una venta al repetir la misma solicitud. La edición de productos usa una versión del documento; si otra operación lo modificó, el servidor responde `409` en vez de pisar el cambio.

## Pruebas

Ejecuta `npm run build` para revisar la sintaxis de los módulos JavaScript y `npm test` para las pruebas automatizadas de validación de productos y ventas, JWT/autenticación, hash bcrypt, cambio obligatorio de contraseña, protección de origen, cálculo de venta a partir del precio de catálogo y rechazo de existencias insuficientes. `npm run dev` inicia MongoDB local para la prueba manual del flujo completo.

## Despliegue

Publica el servidor Node en una plataforma con soporte de variables secretas y conecta una base MongoDB administrada configurada como replica set. Configura TLS/HTTPS en el proxy, usa un dominio exacto en `APP_ORIGIN`, establece `NODE_ENV=production`, define un JWT secreto exclusivo de producción y crea el administrador con una contraseña fuerte. La cookie de sesión se marca `Secure` en producción. No expongas el puerto de MongoDB a internet.

## Seguridad y atención al usuario

La API limita intentos de inicio de sesión, valida el origen de las solicitudes que modifican datos, valida entradas en servidor, protege las rutas de inventario/ventas/historial mediante sesión JWT y no devuelve hashes. Las cabeceras HTTP incluyen CSP y protecciones de Helmet. La interfaz muestra stock bajo y agotado, cantidades restantes, errores de stock, total calculado por el servidor y una lista paginada del historial.
