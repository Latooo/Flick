-- Generado por scripts/json_a_seed.py desde productos.json. No editar a mano.

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-x3',
  'Attack Shark X3',
  'Attack Shark',
  'mouses',
  true,
  true,
  ARRAY['Negro']::text[],
  '49 gramos con sensor de gama alta.',
  'El más liviano del catálogo. Pesa la mitad que un mouse convencional y monta el PixArt PAW3395, el mismo sensor que usan mouses de gama competitiva. Batería para 200 horas.',
  '{"Peso": "49 g", "Sensor": "PixArt PAW3395", "DPI": "26 000", "Conectividad": "2.4 GHz / Bluetooth / USB-C", "Batería": "200 h", "Switches": "Kailh GM8.0 (80 M clics)", "Encoder": "TTC"}'::json,
  NULL,
  ARRAY['img/x3-1.jpg', 'img/x3-2.jpg', 'img/x3-3.jpg', 'img/x3-4.jpg']::text[],
  true,
  '49 g',
  110000,
  125000,
  0
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'ajazz-aj159',
  'AJAZZ AJ159',
  'AJAZZ',
  'mouses',
  true,
  false,
  ARRAY['Blanco']::text[],
  'Sensor PAW3395, inalámbrico o por cable.',
  'Monta el PixArt PAW3395, el mismo sensor del Attack Shark X3. Funciona inalámbrico con su receptor USB de 2.4 GHz o conectado por cable.',
  '{"Sensor": "PixArt PAW3395", "Polling rate": null, "Conectividad": "2.4 GHz / cable", "Extras": null, "Peso": null}'::json,
  'No trae Bluetooth ni base de carga. Se conecta con su receptor USB o por cable.',
  ARRAY['img/aj159-1.jpg', 'img/aj159-2.jpg', 'img/aj159-3.jpg', 'img/aj159-4.jpg']::text[],
  true,
  'PAW3395',
  99000,
  NULL,
  1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-x11',
  'Attack Shark X11',
  'Attack Shark',
  'mouses',
  true,
  false,
  ARRAY['Blanco con pegatinas']::text[],
  'Inalámbrico con base de carga RGB.',
  '63 gramos, tres modos de conexión y base de carga magnética con RGB. Se deja en la base y siempre está cargado. Es el más equilibrado del catálogo entre precio y prestaciones.',
  '{"Peso": "63 g", "Sensor": "PixArt PAW3311", "DPI": "22 000", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "65 h (300 mAh)", "Switches": "Huano (20 M clics)", "Encoder": "TTC (30 K)", "Skates": "PTFE", "Medidas": "128 × 64 × 40 mm", "Extras": "Base de carga magnética RGB"}'::json,
  'Para jugar usa el modo 2.4 GHz con el receptor. El Bluetooth trabaja a 125 Hz y sirve para trabajo y navegación, no para juego competitivo.',
  ARRAY['img/x11-1.jpg', 'img/x11-2.jpg', 'img/x11-3.jpg']::text[],
  true,
  '63 g',
  99000,
  NULL,
  2
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'vxe-r1-se-plus',
  'VXE Dragonfly R1 SE+',
  'VXE',
  'mouses',
  false,
  false,
  ARRAY['Negro']::text[],
  '55 gramos. La puerta de entrada a los ultraligeros.',
  'Forma cómoda para cualquier tipo de agarre y 55 gramos. Es el mouse con el que la mayoría descubre lo que cambia pasar de uno pesado a uno liviano.',
  '{"Peso": "55 g", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "520 mAh", "Sensor": null}'::json,
  NULL,
  ARRAY['img/r1-1.jpg', 'img/r1-2.jpg', 'img/r1-3.jpg', 'img/r1-4.jpg']::text[],
  true,
  '55 g',
  95000,
  NULL,
  3
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-m86',
  'Attack Shark M86',
  'Attack Shark',
  'teclados',
  true,
  true,
  ARRAY['Negro con teclas en degradé gris']::text[],
  '75 % con montaje gasket y hot-swap.',
  'Formato 75 % de 82 teclas: conserva las funciones y las flechas sin ocupar todo el escritorio. Montaje gasket, switches prelubricados y hot-swap para cambiarlos sin soldar.',
  '{"Formato": "75 % — 82 teclas", "Montaje": "Gasket", "Hot-swap": "Sí", "Keycaps": "PBT side-print", "Switches": "Prelubricados de fábrica", "Iluminación": "RGB"}'::json,
  NULL,
  ARRAY['img/m86-1.jpg', 'img/m86-2.jpg', 'img/m86-3.jpg', 'img/m86-4.jpg']::text[],
  true,
  '75%',
  199000,
  NULL,
  4
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-l80',
  'Attack Shark L80',
  'Attack Shark',
  'audio',
  true,
  true,
  ARRAY['Negro']::text[],
  'Tres modos y 50 horas de batería.',
  '2.4 GHz para jugar sin retraso, Bluetooth para el celular y cable de 3.5 mm para consola. Micrófono con cancelación de ruido. Compatible con PC, PS5, PS4, Switch y Mac.',
  '{"Conectividad": "2.4 GHz / Bluetooth 5.2 / 3.5 mm", "Batería": "50 h", "Micrófono": "Con cancelación de ruido", "Compatibilidad": "PC · PS5 · PS4 · Switch · Mac"}'::json,
  NULL,
  ARRAY['img/l80-1.jpg', 'img/l80-2.jpg']::text[],
  true,
  '50 h',
  NULL,
  NULL,
  5
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'onikuma-gt808',
  'Onikuma GT808',
  'Onikuma',
  'audio',
  false,
  true,
  ARRAY['Negro']::text[],
  '60 horas y micrófono desmontable.',
  'Tres modos de conexión, 60 horas de batería y micrófono desmontable con cancelación de ruido. Se quita el micrófono y sirve como audífono normal para salir.',
  '{"Conectividad": "Tres modos", "Batería": "60 h", "Micrófono": "Desmontable, con cancelación", "Iluminación": "RGB"}'::json,
  NULL,
  ARRAY['img/gt808-1.jpg', 'img/gt808-2.jpg']::text[],
  true,
  '60 h',
  NULL,
  NULL,
  6
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'pad-hoswn-60',
  'Mousepad HOSWN 60 × 30',
  'HOSWN',
  'superficies',
  true,
  true,
  ARRAY['Negro con ondas moradas']::text[],
  'Microfibra de verdad, no poliéster.',
  'Superficie de microfibra con base de caucho natural y bordes cosidos. Probamos tres mousepads del pedido y este fue el único que nos convenció al tacto.',
  '{"Tamaño": "60 × 30 cm", "Superficie": "Microfibra", "Base": "Caucho natural antideslizante", "Bordes": "Cosidos"}'::json,
  'Imagen de referencia. El diseño real puede variar.',
  ARRAY['img/hoswn-1.jpg', 'img/hoswn-2.jpg']::text[],
  true,
  '60×30',
  25000,
  NULL,
  7
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'pad-basico',
  'Mousepad básico XL',
  'Genérico',
  'superficies',
  false,
  true,
  ARRAY['Anime 80 × 30', 'Japonés 90 × 40']::text[],
  'Grande y económico.',
  'Superficie de poliéster con bordes cosidos. Cubre todo el escritorio y cumple para uso diario. No es microfibra: si buscas mejor deslizamiento, mira el HOSWN.',
  '{"Tamaños": "80 × 30 cm y 90 × 40 cm", "Superficie": "Poliéster", "Bordes": "Cosidos"}'::json,
  'Es un pad de gama básica. El tacto no se compara con uno de microfibra.',
  ARRAY['img/basico-1.jpg', 'img/basico-2.jpg']::text[],
  true,
  'XL',
  NULL,
  NULL,
  8
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-x11-pro-v2',
  'Attack Shark X11 PRO V2',
  'Attack Shark',
  'mouses',
  false,
  false,
  ARRAY['Blanco y negro', 'Negro']::text[],
  'Base de carga con pantalla que muestra DPI y batería.',
  'La versión PRO del X11: sensor PixArt PAW3315 de hasta 30 000 DPI y base de carga magnética con pantalla a color que muestra el DPI, el polling rate y la batería. El receptor va dentro de la base, así que no hay dongle suelto.',
  '{"Sensor": "PixArt PAW3315", "DPI": "30 000", "Polling rate": "1000 Hz", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "260 h", "Extras": "Base magnética con pantalla y receptor integrado"}'::json,
  NULL,
  ARRAY['img/x11pro-1.jpg', 'img/x11pro-2.jpg', 'img/x11pro-3.jpg', 'img/x11pro-4.jpg', 'img/x11pro-5.jpg', 'img/x11pro-6.jpg', 'img/x11pro-7.jpg', 'img/x11pro-8.jpg', 'img/x11pro-9.jpg', 'img/x11pro-10.jpg']::text[],
  true,
  '30K DPI',
  149000,
  NULL,
  9
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'ajazz-aj139-v2',
  'AJAZZ AJ139 V2',
  'AJAZZ',
  'mouses',
  false,
  false,
  ARRAY['Rojo', 'Negro']::text[],
  'Base de carga magnética con RGB.',
  '66 gramos, sensor PixArt PAW3311 y base magnética con RGB para dejarlo cargando. Batería de 500 mAh.',
  '{"Peso": "66 g", "Sensor": "PixArt PAW3311", "Polling rate": "1000 Hz", "Conectividad": "2.4 GHz / cable", "Batería": "500 mAh", "Medidas": "125 × 63 × 38 mm", "Extras": "Base de carga magnética RGB"}'::json,
  NULL,
  ARRAY['img/aj139-1.jpg', 'img/aj139-2.jpg', 'img/aj139-3.jpg', 'img/aj139-4.jpg', 'img/aj139-5.jpg', 'img/aj139-6.jpg', 'img/aj139-7.jpg']::text[],
  true,
  '66 g',
  119000,
  NULL,
  10
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'ajazz-aj199',
  'AJAZZ AJ199',
  'AJAZZ',
  'mouses',
  false,
  false,
  ARRAY['Negro']::text[],
  '58 gramos con carcasa de fibra de carbono.',
  'Carcasa de fibra de carbono con textura, 58 gramos y sensor PixArt PAW3311. Se conecta por receptor 2.4 GHz, Bluetooth o cable.',
  '{"Peso": "58 g", "Sensor": "PixArt PAW3311", "DPI": "12 000", "Polling rate": "1000 Hz (125 Hz por Bluetooth)", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "500 mAh", "Carcasa": "Fibra de carbono + PC", "Medidas": "119 × 62 × 40 mm"}'::json,
  'Para jugar usa el receptor 2.4 GHz: por Bluetooth trabaja a 125 Hz.',
  ARRAY['img/aj199-1.jpg', 'img/aj199-2.jpg', 'img/aj199-3.jpg', 'img/aj199-4.jpg']::text[],
  true,
  '58 g',
  99000,
  NULL,
  11
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'aula-sc620',
  'AULA SC620',
  'AULA',
  'mouses',
  false,
  false,
  ARRAY['Blanco con dibujo topográfico', 'Negro']::text[],
  'Carcasa calada con RGB y tres modos de conexión.',
  'Carcasa calada que deja ver el RGB, 67 gramos y sensor PixArt PAW3311 de hasta 12 000 DPI. Funciona por receptor 2.4 GHz, Bluetooth o cable.',
  '{"Peso": "67 g", "Sensor": "PixArt PAW3311", "DPI": "12 000", "Polling rate": "1000 Hz (125 Hz por Bluetooth)", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "400 mAh", "Medidas": "122 × 64 × 40 mm", "Iluminación": "RGB"}'::json,
  'Para jugar usa el receptor 2.4 GHz: por Bluetooth trabaja a 125 Hz.',
  ARRAY['img/sc620-1.jpg', 'img/sc620-2.jpg', 'img/sc620-3.jpg', 'img/sc620-4.jpg', 'img/sc620-5.jpg', 'img/sc620-6.jpg', 'img/sc620-7.jpg', 'img/sc620-8.jpg', 'img/sc620-9.jpg', 'img/sc620-10.jpg']::text[],
  true,
  '67 g',
  95000,
  NULL,
  12
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'aula-f99-pro',
  'AULA F99 Pro',
  'AULA',
  'teclados',
  false,
  false,
  ARRAY['Negro con teclas en degradé gris']::text[],
  '96 % con teclado numérico, perilla y 8000 mAh.',
  'Formato 96 % de 100 teclas: trae teclado numérico sin ocupar lo que ocupa uno completo. Montaje gasket, hot-swap para cambiar switches sin soldar, perilla multimedia y batería de 8000 mAh.',
  '{"Formato": "96 % — 100 teclas", "Montaje": "Gasket", "Hot-swap": "Sí (3 y 5 pines)", "Keycaps": "PBT", "Conectividad": "2.4 GHz / Bluetooth / cable", "Batería": "8000 mAh", "Iluminación": "RGB", "Extras": "Perilla multimedia"}'::json,
  NULL,
  ARRAY['img/f99-1.jpg', 'img/f99-2.jpg', 'img/f99-3.jpg']::text[],
  true,
  '96%',
  265000,
  NULL,
  13
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'aula-f87-pro',
  'AULA F87 Pro',
  'AULA',
  'teclados',
  false,
  false,
  ARRAY['Blanco, negro y azul']::text[],
  'TKL con montaje gasket y tres modos de conexión.',
  'Formato TKL de 87 teclas: deja afuera el teclado numérico y conserva las funciones y las flechas. Montaje gasket, hot-swap y conexión por receptor 2.4 GHz, Bluetooth o cable.',
  '{"Formato": "TKL (80 %) — 87 teclas", "Montaje": "Gasket", "Hot-swap": "Sí", "Keycaps": "PBT", "Conectividad": "2.4 GHz / Bluetooth / cable", "Iluminación": "RGB"}'::json,
  NULL,
  ARRAY['img/f87-1.jpg', 'img/f87-2.jpg']::text[],
  true,
  'TKL',
  249000,
  NULL,
  14
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-x68he',
  'Attack Shark X68HE',
  'Attack Shark',
  'teclados',
  true,
  false,
  ARRAY['Negro']::text[],
  'Switches magnéticos con rapid trigger.',
  'Teclado 60 % con switches magnéticos. Cada tecla se ajusta para activar entre 0,1 y 3,4 mm, y con rapid trigger se reactiva apenas empieza a subir. 8000 Hz de polling.',
  '{"Formato": "60 % (66 teclas)", "Switches": "Magnéticos lineales, hot-swap", "Actuación": "0,1 a 3,4 mm, por tecla", "Rapid trigger": "Sí", "Polling rate": "8000 Hz", "Conectividad": "Cable USB-C", "Teclas": "PBT doble inyección", "Iluminación": "RGB"}'::json,
  'Es solo de cable. Se configura desde un driver web, no hay programa para instalar.',
  ARRAY['img/x68he-1.jpg', 'img/x68he-2.jpg', 'img/x68he-3.jpg', 'img/x68he-4.jpg']::text[],
  true,
  '0,1 mm',
  145000,
  NULL,
  15
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'vxe-v3-pro',
  'VXE V3 PRO',
  'VXE',
  'mouses',
  false,
  false,
  ARRAY['Lavanda']::text[],
  '49 gramos, tres modos de conexión.',
  'Pesa 49 gramos y monta el PixArt PAW3395 SE. Se conecta por 2.4 GHz, Bluetooth o cable.',
  '{"Peso": "49 g", "Sensor": "PixArt PAW3395 SE", "DPI": "18 000", "Polling rate": "1000 Hz", "Conectividad": "2.4 GHz / Bluetooth / USB-C", "Switches": "Huano (80 M clics)", "Medidas": "116,6 × 62,2 × 38,2 mm"}'::json,
  NULL,
  ARRAY['img/v3pro-1.jpg', 'img/v3pro-2.jpg', 'img/v3pro-3.jpg', 'img/v3pro-4.jpg']::text[],
  true,
  '49 g',
  85000,
  NULL,
  16
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'kz-edx-pro',
  'KZ EDX Pro',
  'KZ',
  'audio',
  false,
  false,
  ARRAY['Cristal', 'Negro']::text[],
  'In-ear con driver de 10 mm.',
  'Audífonos in-ear con driver dinámico de 10 mm y doble imán. Conector de 3,5 mm.',
  '{"Driver": "Dinámico de 10 mm, doble imán", "Impedancia": "24 Ω", "Sensibilidad": "112 dB", "Respuesta de frecuencia": "10 Hz – 20 kHz", "Conector": "3,5 mm", "Cable": "Desmontable, 2 pines 0,75 mm, 1,25 m", "Micrófono": "Sí"}'::json,
  'Imagen de referencia. El diseño real puede variar.',
  ARRAY['img/kz-1.jpg', 'img/kz-2.jpg', 'img/kz-3.jpg']::text[],
  true,
  '10 mm',
  39000,
  NULL,
  17
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-cm02',
  'Mousepad Attack Shark CM02',
  'Attack Shark',
  'superficies',
  false,
  false,
  ARRAY['Negro']::text[],
  '45 × 40 cm, bordes cosidos.',
  'Tela de fibra densa con recubrimiento que repele el agua, base de caucho natural y bordes cosidos.',
  '{"Tamaño": "45 × 40 cm", "Grosor": "4 mm", "Superficie": "Tela de fibra densa", "Base": "Caucho natural antideslizante", "Bordes": "Cosidos"}'::json,
  NULL,
  ARRAY['img/cm02-1.jpg', 'img/cm02-2.jpg', 'img/cm02-3.jpg']::text[],
  true,
  '45×40',
  69900,
  NULL,
  18
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-cm02se',
  'Mousepad Attack Shark CM02SE',
  'Attack Shark',
  'superficies',
  false,
  false,
  ARRAY['Negro topográfico']::text[],
  '41 × 31 cm, pad de control.',
  'Superficie de control: el mouse se desliza con algo de freno, para apuntar con precisión. Tela con textura, recubrimiento que repele el agua y bordes cosidos.',
  '{"Tamaño": "41 × 31 cm", "Grosor": "4 mm", "Superficie": "Tela con textura (control)", "Bordes": "Cosidos"}'::json,
  NULL,
  ARRAY['img/cm02se-1.jpg', 'img/cm02se-2.jpg', 'img/cm02se-3.jpg']::text[],
  true,
  'Control',
  50000,
  NULL,
  19
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'as-cm02se-rosa',
  'Mousepad Attack Shark CM02SE Rosa',
  'Attack Shark',
  'superficies',
  false,
  false,
  ARRAY['Fucsia topográfico']::text[],
  '41 × 31 cm, pad de control.',
  'Superficie de control: el mouse se desliza con algo de freno, para apuntar con precisión. Tela con textura, recubrimiento que repele el agua y bordes cosidos.',
  '{"Tamaño": "41 × 31 cm", "Grosor": "4 mm", "Superficie": "Tela con textura (control)", "Bordes": "Cosidos"}'::json,
  NULL,
  ARRAY['img/cm02se-rosa-1.jpg', 'img/cm02se-rosa-2.jpg']::text[],
  true,
  'Control',
  50000,
  NULL,
  20
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos (id, nombre, marca, categoria, destacado, agotado, colores, gancho, descripcion, specs, nota_honesta, fotos, tiene_fotos, placeholder, precio, precio_regular, orden)
VALUES (
  'pad-ojo-morado',
  'Mousepad ojo morado 45 × 40',
  'Genérico',
  'superficies',
  false,
  false,
  ARRAY['Ojo morado']::text[],
  '45 × 40 cm.',
  'Mousepad de microfibra con diseño de ojo morado.',
  '{"Tamaño": "45 × 40 cm", "Superficie": "Microfibra"}'::json,
  NULL,
  ARRAY['img/pad-ojo-1.jpg', 'img/pad-ojo-2.jpg']::text[],
  true,
  '45×40',
  50000,
  NULL,
  21
)
ON CONFLICT (id) DO NOTHING;
