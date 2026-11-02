"""Genera supabase/seed.sql a partir de productos.json (solo libreria estandar)."""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "productos.json"
DESTINO = RAIZ / "supabase" / "seed.sql"

COLUMNAS = [
    "id", "nombre", "marca", "categoria", "destacado", "agotado", "colores",
    "gancho", "descripcion", "specs", "nota_honesta", "fotos", "tiene_fotos",
    "placeholder", "precio", "precio_regular", "orden",
]


def texto(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def booleano(v):
    return "true" if v else "false"


def entero(v):
    return "NULL" if v is None else str(int(v))


def lista_texto(items):
    if not items:
        return "'{}'::text[]"
    return "ARRAY[" + ", ".join(texto(i) for i in items) + "]::text[]"


def json_literal(obj):
    # el dict conserva el orden de claves del archivo y json.dumps lo respeta
    return texto(json.dumps(obj, ensure_ascii=False)) + "::json"


def insert(p, orden):
    valores = [
        texto(p["id"]), texto(p["nombre"]), texto(p["marca"]), texto(p["categoria"]),
        booleano(p.get("destacado", False)), booleano(p.get("agotado", False)),
        lista_texto(p.get("colores", [])),
        texto(p["gancho"]), texto(p["descripcion"]),
        json_literal(p.get("specs", {})),
        texto(p.get("nota_honesta")),
        lista_texto(p["fotos"]), booleano(p.get("tiene_fotos", True)),
        texto(p["placeholder"]),
        entero(p.get("precio")), entero(p.get("precio_regular")),
        str(orden),
    ]
    return (
        "INSERT INTO public.productos (" + ", ".join(COLUMNAS) + ")\nVALUES (\n  "
        + ",\n  ".join(valores) + "\n)\nON CONFLICT (id) DO NOTHING;\n"
    )


def main():
    datos = json.loads(ORIGEN.read_text(encoding="utf-8"))
    productos = datos["productos"]
    partes = ["-- Generado por scripts/json_a_seed.py desde productos.json. No editar a mano.\n"]
    partes += [insert(p, i) for i, p in enumerate(productos)]
    with open(DESTINO, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(partes))
    print(f"{len(productos)} productos -> {DESTINO}")


if __name__ == "__main__":
    main()
