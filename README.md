# Flick

**Tienda de periféricos gaming importados en Bucaramanga, Colombia.**

Catálogo en línea: **https://flickcol.netlify.app**

## Qué es Flick

Flick es un emprendimiento de Bucaramanga que vende periféricos gaming importados y los entrega en la ciudad y su área metropolitana. Este repositorio contiene el sitio web del catálogo: ahí se ven los productos con fotos reales, sus especificaciones y un botón para pedir por WhatsApp.

## Qué vendemos

| Categoría | Qué hay | Marcas |
|---|---|---|
| Mouses | Inalámbricos ultraligeros para gaming | Attack Shark, VXE, AJAZZ |
| Teclados | Mecánicos | Attack Shark |
| Headsets | Audífonos gaming | Attack Shark, Onikuma |
| Mouse pads | Varios tamaños | HOSWN y básicos XL |

El stock cambia seguido: el catálogo es la fuente actualizada, y los productos vendidos aparecen ahí como agotados.

## Cómo comprar

- Se elige el producto en el catálogo y se pide por WhatsApp desde el botón de cada producto.
- Pago contraentrega; no hay pasarela de pago.
- Entrega en Bucaramanga, Girón, Floridablanca y Piedecuesta, o recogida en bodega.
- Garantía de 1 mes.

## Quiénes somos

Flick es de dos socios:

- **Juan Rivero** — [@juandariver9](https://github.com/juandariver9)
- **Daniel Latorre** — [@Latooo](https://github.com/Latooo)

## Sobre el sitio

Sitio estático: HTML, CSS y JS sin build. Los productos se leen de Supabase (ver más abajo).

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos |
| `app.js` | Carga los productos (Supabase, con respaldo a `productos.json`) y arma el catálogo |
| `productos.json` | Datos de la tienda y categorías; respaldo de los productos |
| `img/` | Fotos de producto |
| `media/` | Video de portada |
| `admin/` | Panel de administrador (`/admin/`) |
| `supabase/` | SQL de la base de datos |
| `scripts/` | Utilidades de Python |
| `.github/workflows/` | Keep-alive de Supabase |
| `robots.txt` | Pide a los buscadores no indexar `/admin/` |

## Productos y panel de administrador

- **De dónde salen los productos:** de Supabase (tabla `productos`). `productos.json` es el respaldo: si Supabase no responde en 4 segundos, el sitio muestra los productos del JSON. Además, de `productos.json` salen los datos del sitio (`sitio`) y las categorías.
- **El respaldo no se actualiza solo.** Lo que se edite desde el panel no se copia a `productos.json`; si hace falta que el respaldo esté al día, hay que actualizarlo a mano.
- **Panel:** está en `/admin/`. Solo entran las cuentas que estén en `public.admins`; cualquier otra cuenta se rechaza.
- **Agregar un admin:** crear el usuario en Supabase, Authentication → Users, y luego correr en el SQL Editor:

  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';
  ```

- **Claves:** el repo solo lleva la clave pública (`sb_publishable_…`). La clave secreta o `service_role` nunca va al repo ni al navegador.

### `supabase/`

| Archivo | Para qué |
|---|---|
| `schema.sql` | Tablas `productos` y `admins`, permisos (RLS y GRANTs) y bucket `productos` de Storage. Se puede correr varias veces. |
| `seed.sql` | Carga inicial de los productos, generada desde `productos.json`. |
| `002_storage_select.sql` | Política para que los admins puedan listar y borrar fotos en Storage. |

### `scripts/`

| Archivo | Para qué |
|---|---|
| `json_a_seed.py` | Genera `supabase/seed.sql` a partir de `productos.json`. |
| `verificar_supabase.py` | Compara la tabla con `productos.json` y comprueba que la clave pública no pueda escribir. |
| `e2e_panel.py` | Prueba de punta a punta del panel con una cuenta admin (credenciales en variables de entorno `FLICK_TEST_EMAIL` y `FLICK_TEST_PASSWORD`). |

### Keep-alive

`.github/workflows/keepalive.yml` hace una consulta de lectura al día para que el proyecto gratis de Supabase no se pause por inactividad. No hace commits, así que no dispara un deploy. Los workflows programados solo corren desde la rama por defecto (`main`), y GitHub los desactiva si el repo pasa 60 días sin actividad; en ese caso se reactiva desde la pestaña Actions.
