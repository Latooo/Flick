"""Compara la tabla productos de Supabase con productos.json y prueba que anon no pueda escribir."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://nisegpuyvfujzrcjlhtw.supabase.co/rest/v1/productos"
CLAVE = "sb_publishable_ULilyHHntqtHTcrihvy_Pw_8ylQBEC_"  # clave publica
JSON_PATH = Path(__file__).resolve().parent.parent / "productos.json"
ID_PRUEBA = "zz-verificacion-borrar"

CAMPOS = [
    "id", "nombre", "marca", "categoria", "destacado", "agotado", "colores",
    "gancho", "descripcion", "specs", "nota_honesta", "fotos", "tiene_fotos",
    "placeholder", "precio", "precio_regular",
]
DEFAULTS = {"destacado": False, "agotado": False, "colores": [], "specs": {}, "tiene_fotos": True}


def pedir(metodo, url, cuerpo=None, extra=None):
    cab = {"apikey": CLAVE}
    if cuerpo is not None:
        cab["Content-Type"] = "application/json"
    cab.update(extra or {})
    req = urllib.request.Request(
        url, method=metodo, headers=cab,
        data=json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def comparar(esperado, real):
    difs = []
    for campo in CAMPOS:
        e = esperado.get(campo, DEFAULTS.get(campo))
        r = real.get(campo)
        if campo == "specs":
            if list(e.items()) != list(r.items()):  # compara claves en orden
                difs.append((campo, e, r))
        elif e != r:
            difs.append((campo, e, r))
    return difs


def main():
    local = json.loads(JSON_PATH.read_text(encoding="utf-8"))["productos"]
    estado, cuerpo = pedir("GET", BASE + "?select=*&order=orden")
    if estado != 200:
        print(f"GET fallo: {estado} {cuerpo}")
        return 1
    remoto = json.loads(cuerpo)  # el dict conserva el orden de claves de specs
    fallos = 0

    if len(local) != len(remoto):
        print(f"DIFERENCIA: {len(local)} productos en el JSON, {len(remoto)} en Supabase")
        fallos += 1
    if [p["id"] for p in local] != [p["id"] for p in remoto]:
        print("DIFERENCIA: el orden o los ids no coinciden")
        fallos += 1
    por_id = {p["id"]: p for p in remoto}
    for i, p in enumerate(local):
        r = por_id.get(p["id"])
        if r is None:
            print(f"FALTA en Supabase: {p['id']}")
            fallos += 1
            continue
        for campo, e, v in comparar(p, r):
            print(f"DIFERENCIA {p['id']}.{campo}:\n  json:     {e!r}\n  supabase: {v!r}")
            fallos += 1
        if r.get("orden") != i:
            print(f"DIFERENCIA {p['id']}.orden: esperado {i}, supabase {r.get('orden')}")
            fallos += 1
    print(f"Comparacion: {len(local)} productos, {fallos} diferencias")

    # escritura con la clave anon: ambas deben ser rechazadas
    prueba = {"id": ID_PRUEBA, "nombre": "x", "marca": "x", "categoria": "x",
              "gancho": "x", "descripcion": "x", "fotos": ["x"], "placeholder": "x"}
    estado, cuerpo = pedir("POST", BASE, prueba, {"Prefer": "return=representation"})
    if 200 <= estado < 300:
        print(f"FALLO DE SEGURIDAD: INSERT aceptado ({estado}). Borra '{ID_PRUEBA}' a mano.")
        fallos += 1
    else:
        print(f"INSERT rechazado ({estado}) OK")

    estado, cuerpo = pedir("DELETE", BASE + "?id=eq." + ID_PRUEBA, extra={"Prefer": "return=representation"})
    if 200 <= estado < 300 and cuerpo.strip() not in ("", "[]"):
        print(f"FALLO DE SEGURIDAD: DELETE aceptado ({estado}): {cuerpo}")
        fallos += 1
    elif 200 <= estado < 300:
        print(f"DELETE sin efecto ({estado}, 0 filas): RLS lo filtra, OK")
    else:
        print(f"DELETE rechazado ({estado}) OK")

    print("RESULTADO:", "TODO OK" if fallos == 0 else f"{fallos} problema(s)")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
