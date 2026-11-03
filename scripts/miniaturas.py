"""Genera las miniaturas WebP de img/*.jpg en img/thumb/.

  img/x3-1.jpg -> img/thumb/x3-1-640.webp (tarjetas del catálogo)
               -> img/thumb/x3-1-200.webp (miniaturas del modal y del panel)

Solo crea las que faltan o están desactualizadas (más viejas que la foto).
Uso: python scripts/miniaturas.py   (necesita Pillow)
"""
import os
import sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, 'img')
THUMB = os.path.join(IMG, 'thumb')
TAMANOS = {640: 78, 200: 72}   # lado en px -> calidad WebP


def main():
    os.makedirs(THUMB, exist_ok=True)
    hechas = 0
    for nombre in sorted(os.listdir(IMG)):
        if not nombre.lower().endswith('.jpg'):
            continue
        origen = os.path.join(IMG, nombre)
        base = os.path.splitext(nombre)[0]
        with Image.open(origen) as im:
            im = im.convert('RGB')
            for lado, calidad in TAMANOS.items():
                destino = os.path.join(THUMB, f'{base}-{lado}.webp')
                if os.path.exists(destino) and os.path.getmtime(destino) >= os.path.getmtime(origen):
                    continue
                copia = im.copy()
                copia.thumbnail((lado, lado), Image.LANCZOS)
                copia.save(destino, 'WEBP', quality=calidad, method=6)
                hechas += 1
    print(f'{hechas} miniaturas creadas o actualizadas en img/thumb/')


if __name__ == '__main__':
    sys.exit(main())
