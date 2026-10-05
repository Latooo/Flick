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

Sitio estático: HTML, CSS y JS sin dependencias ni build.

El contenido vive en `productos.json`; para agregar o cambiar un producto se edita solo ese archivo.

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos |
| `app.js` | Carga `productos.json` y arma el catálogo |
| `productos.json` | Productos, categorías y datos de la tienda |
| `img/` | Fotos de producto |
| `media/` | Video de portada |
