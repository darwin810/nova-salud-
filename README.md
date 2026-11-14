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
- MongoDB local iniciado como replica set `rs0` en `127.0.0.1:27017` (o una URI de MongoDB replica set en `.env`).

## Instalación local

1. Clona el repositorio e instala dependencias: `npm install`.
2. Inicia MongoDB en modo replica set con el nombre `rs0`. Si el servidor ya está instalado, configura `replication.replSetName: rs0` en su archivo de configuración y reinícialo. Para una ejecución manual de desarrollo en Windows, crea el directorio de datos y ejecuta:

   ```powershell
   New-Item -ItemType Directory -Force C:\data\db
   mongod --dbpath C:\data\db --replSet rs0
   ```

   En otra terminal inicializa el replica set una sola vez:

   ```powershell
   mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
   ```

3. En el directorio del proyecto ejecuta `npm run dev` y abre [http://localhost:3000](http://localhost:3000). Para una instalación local no necesitas crear `.env`: la app usa la URI local de MongoDB, genera una clave JWT de desarrollo al iniciar, crea la base `nova_salud`, prepara las colecciones `usuarios`, `productos` y `ventas` con sus índices y crea el usuario administrador la primera vez. La clave se guarda como hash bcrypt; el texto original nunca se guarda en MongoDB. El catálogo empieza vacío; los productos de la botica se ingresan desde Inventario. No ejecutes scripts manuales para crear la base o las colecciones.

Para comprobarlo desde `mongosh` después de iniciar la app, conecta a `mongodb://localhost:27017/nova_salud?replicaSet=rs0`, ejecuta `show collections` y luego `db.usuarios.find()`. Verás el documento del administrador y el campo `passwordHash` con un hash bcrypt, no la contraseña `123456`.

Si MongoDB escucha en otra dirección, copia `.env.example` a `.env` y configura `MONGODB_URI`. `.env` está excluido de Git. Para producción también debes establecer una clave JWT aleatoria, un origen HTTPS y las credenciales iniciales seguras.

### Guía rápida para Windows y VS Code

Abre la carpeta clonada en VS Code y usa **Terminal → Nueva terminal**. Ejecuta los comandos desde la raíz del proyecto:

```powershell
git clone https://github.com/darwin810/nova-salud-.git
cd nova-salud-
npm install
```

Comprueba que MongoDB responde con `mongosh`. El servidor debe haberse iniciado con el replica set `rs0`; para el servicio instalado en Windows, agrega `replication:` y debajo `replSetName: rs0` al archivo `mongod.cfg` y reinicia MongoDB. Con `mongod` ya activo en ese modo, inicializa el replica set una sola vez:

```powershell
mongosh --eval "try { rs.status().ok } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]}) }"
```

Luego ejecuta `npm run dev`. Debe aparecer `MongoDB listo: nova_salud` y `Nova Salud disponible en http://localhost:3000`. Abre esa dirección. Ingresa con **admin / 123456** y elige una contraseña nueva de al menos 12 caracteres. Estos datos iniciales son solo para desarrollo local.

### Comprobación de las funciones

1. En **Inventario → Nuevo producto**, agrega un producto de prueba con precio `10.50`, existencias `5` y mínimo `2`.
2. En **Nueva venta**, agrega una unidad, escribe opcionalmente un cliente y confirma. Verifica que el total sea `S/ 10.50` y que el inventario ahora muestre `4`.
3. En **Historial de ventas**, comprueba que aparezca la venta con su detalle y total.
4. Edita el producto y deja el stock en `2`; debe aparecer en el panel de reposición. Si lo dejas en `0`, debe marcarse como agotado.
5. Para revisar MongoDB, ejecuta `mongosh "mongodb://localhost:27017/nova_salud?replicaSet=rs0"`, luego `show collections` y `db.usuarios.find()`.

Si el paso de `mongosh` indica que no hay servidor, inicia el servicio MongoDB. Si indica que el servidor no es miembro de un replica set, configura `replication.replSetName: rs0` en el archivo `mongod.cfg` y reinicia el servicio de MongoDB antes de volver a ejecutar la inicialización. La transacción de venta requiere ese modo de MongoDB.

**Diferencia importante:** `mongod` es el servidor de base de datos; `mongosh` es solo una consola cliente. Abrir `mongosh` no inicia MongoDB. Si `npm run dev` muestra que no encuentra `mongod`, inicia el servicio MongoDB desde la aplicación **Servicios** de Windows. Si no aparece ese servicio, instala MongoDB Community Server. Una vez que el servidor esté escuchando en `127.0.0.1:27017` y configurado como replica set `rs0`, inicia Nova con `npm run dev`; Nova crea el usuario, la base y las colecciones automáticamente.

En `development`, si la base aún no tiene administrador, Nova crea el acceso inicial solicitado: **usuario `admin`, contraseña `123456`**. El sistema fuerza el cambio inmediato a una contraseña de al menos 12 caracteres. Esta credencial solo se proporciona para desarrollo local; nunca uses esa contraseña en un entorno público.

## Variables privadas

Revisa `.env.example`. En producción configura `NODE_ENV=production`, `MONGODB_URI` con usuario de mínimo privilegio y TLS, `JWT_SECRET` generado aleatoriamente, `APP_ORIGIN` con el origen HTTPS público exacto y `ADMIN_USERNAME`/`ADMIN_PASSWORD` seguros para el administrador inicial. El servidor exige una contraseña inicial de al menos 12 caracteres en producción y fuerza el cambio tras el primer ingreso. En desarrollo, si falta `MONGODB_URI`, se conecta a `mongodb://127.0.0.1:27017/nova_salud?replicaSet=rs0`; si falta `JWT_SECRET`, crea una clave temporal en memoria. No pongas secretos en `public/`, HTML ni scripts del navegador. Monta el servidor detrás de un proxy HTTPS correctamente configurado.

## Base de datos y reglas de operación

Mongoose crea las colecciones e índices necesarios (`usuarios`, `productos`, `ventas`) al iniciar. No hace falta una migración manual inicial. Las ventas guardan una instantánea del precio de catálogo, el importe se calcula solo en el servidor y cada operación descuenta existencias y registra la venta en una transacción MongoDB. La clave `Idempotency-Key` evita duplicar una venta al repetir la misma solicitud. La edición de productos usa una versión del documento; si otra operación lo modificó, el servidor responde `409` en vez de pisar el cambio.

## Pruebas

Ejecuta `npm run build` para revisar la sintaxis de los módulos JavaScript y `npm test` para las pruebas automatizadas de validación de productos y ventas, JWT/autenticación, hash bcrypt, cambio obligatorio de contraseña, protección de origen, cálculo de venta a partir del precio de catálogo y rechazo de existencias insuficientes. Las pruebas de servicio simulan la sesión de MongoDB; para validar también el despliegue local inicia el replica set y levanta el servidor.

## Despliegue

Publica el servidor Node en una plataforma con soporte de variables secretas y conecta una base MongoDB administrada configurada como replica set. Configura TLS/HTTPS en el proxy, usa un dominio exacto en `APP_ORIGIN`, establece `NODE_ENV=production`, define un JWT secreto exclusivo de producción y crea el administrador con una contraseña fuerte. La cookie de sesión se marca `Secure` en producción. No expongas el puerto de MongoDB a internet.

## Seguridad y atención al usuario

La API limita intentos de inicio de sesión, valida el origen de las solicitudes que modifican datos, valida entradas en servidor, protege las rutas de inventario/ventas/historial mediante sesión JWT y no devuelve hashes. Las cabeceras HTTP incluyen CSP y protecciones de Helmet. La interfaz muestra stock bajo y agotado, cantidades restantes, errores de stock, total calculado por el servidor y una lista paginada del historial.
