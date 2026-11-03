"""Prueba de punta a punta del panel contra Supabase real (localhost:8080 debe estar sirviendo el repo).
Credenciales: variables de entorno FLICK_TEST_EMAIL y FLICK_TEST_PASSWORD (no se guardan en ningun archivo).
Uso: python scripts/e2e_panel.py   (necesita playwright y Pillow)
"""
import io
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

SITE = "http://localhost:8080/"
PANEL = SITE + "admin/"
REST = "https://nisegpuyvfujzrcjlhtw.supabase.co/rest/v1/productos"
KEY = "sb_publishable_ULilyHHntqtHTcrihvy_Pw_8ylQBEC_"
ID = "zz-prueba-panel"
SHOTS = Path(os.environ.get("E2E_SHOTS", tempfile.gettempdir()))

resultados = []


def check(nombre, ok, detalle=""):
    resultados.append((nombre, ok))
    print(("OK    " if ok else "FALLA ") + nombre + (f" -> {detalle}" if detalle else ""))


def rest_get(query):
    req = urllib.request.Request(f"{REST}?{query}", headers={"apikey": KEY})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def descargar(url):
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def api_admin(metodo, ruta, cuerpo=None, token=None):
    cab = {"apikey": KEY, "Content-Type": "application/json"}
    if token:
        cab["Authorization"] = "Bearer " + token
    req = urllib.request.Request("https://nisegpuyvfujzrcjlhtw.supabase.co" + ruta, method=metodo, headers=cab,
                                 data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"null")


def foto_con_gps(ruta):
    im = Image.new("RGB", (2400, 1800), (40, 90, 160))
    ex = Image.Exif()
    ex[0x010F] = "TestCam"
    gps = ex.get_ifd(0x8825)
    gps[1], gps[2], gps[3], gps[4] = "N", (7.0, 7.0, 30.0), "W", (73.0, 7.0, 0.0)
    im.save(ruta, "JPEG", quality=92, exif=ex)
    origen = Image.open(ruta).getexif()
    assert origen.get_ifd(0x8825), "la foto de prueba deberia traer GPS"


def tarjetas_sitio(browser):
    pg = browser.new_page()
    pg.goto(SITE)
    pg.wait_for_selector("#grid .card", timeout=20000)
    pg.wait_for_timeout(1500)
    ids = pg.eval_on_selector_all("#grid .card", "els => els.map(e => ({id: e.dataset.id, ribbon: !!e.querySelector('.agotado-ribbon')}))")
    pg.close()
    return {i["id"]: i["ribbon"] for i in ids}


def main():
    email, pw_ = os.environ.get("FLICK_TEST_EMAIL"), os.environ.get("FLICK_TEST_PASSWORD")
    if not email or not pw_:
        print("Faltan FLICK_TEST_EMAIL y FLICK_TEST_PASSWORD")
        return 2
    tmp = tempfile.mkdtemp()
    jpg = os.path.join(tmp, "gps.jpg")
    foto_con_gps(jpg)
    consola = []

    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("console", lambda m: consola.append((m.type, m.text)))
        pg.on("pageerror", lambda e: consola.append(("pageerror", str(e))))

        # 1) credenciales malas
        pg.goto(PANEL)
        pg.fill("#loginEmail", "nadie@ejemplo.com")
        pg.fill("#loginPass", "clave-incorrecta")
        pg.click("#loginBtn")
        pg.wait_for_selector("#loginError:not([hidden])", timeout=15000)
        check("login malo: mensaje de error", "incorrectos" in pg.inner_text("#loginError"), pg.inner_text("#loginError"))
        check("login malo: no entra al panel", pg.is_hidden("#appView"))
        consola.clear()   # el 400 del login malo lo registra el navegador; no cuenta como error de la pagina

        # 2) login real
        pg.fill("#loginEmail", email)
        pg.fill("#loginPass", pw_)
        pg.click("#loginBtn")
        pg.wait_for_selector("#rows .row", timeout=20000)
        check("login real: lista cargada", pg.locator("#rows .row").count() >= 22, str(pg.locator("#rows .row").count()))
        pg.screenshot(path=str(SHOTS / "e2e_lista_desktop.png"))

        # 3) crear con foto que trae GPS
        pg.click("#newBtn")
        pg.fill("#fNombre", "ZZ Prueba Panel")
        check("id generado del nombre", pg.input_value("#fId") == ID, pg.input_value("#fId"))
        pg.fill("#fMarca", "Prueba")
        pg.fill("#fGancho", "Producto de prueba del panel")
        pg.fill("#fDescripcion", "Se borra al final de la prueba.")
        pg.fill("#fPlaceholder", "49 g")
        pg.fill("#fPrecio", "50000")
        pg.fill("#chipInput", "Negro")
        pg.press("#chipInput", "Enter")
        pg.click("#specAdd")
        fila = pg.locator("#specs .spec").first
        fila.locator("input").nth(0).fill("Peso")
        fila.locator("input").nth(1).fill("49 g")
        pg.set_input_files("#photoInput", jpg)
        pg.wait_for_selector("#cropDialog[open]")
        pg.click("#cropOk")
        pg.wait_for_selector("#photos .photo")
        pg.screenshot(path=str(SHOTS / "e2e_form_desktop.png"), full_page=True)
        pg.click("#saveBtn")
        pg.wait_for_selector("#listView:not([hidden])", timeout=30000)
        filas = rest_get(f"select=id,fotos,tiene_fotos,agotado,activo&id=eq.{ID}")
        check("creado en Supabase", len(filas) == 1)
        if not filas:
            return 1
        url = filas[0]["fotos"][0]
        check("foto guardada como URL publica de Storage", url.startswith("https://nisegpuyvfujzrcjlhtw.supabase.co/storage/v1/object/public/productos/" + ID + "/"), url)
        estado, cuerpo = descargar(url)
        im = Image.open(io.BytesIO(cuerpo))
        ex = im.getexif()
        check("foto subida mide 1600x1600", im.size == (1600, 1600), str(im.size))
        check("foto subida sin EXIF ni GPS", len(ex) == 0 and not ex.get_ifd(0x8825) and b"Exif" not in cuerpo[:4096], f"tags={len(ex)}")
        check("foto subida pesa <= 2 MB", len(cuerpo) <= 2 * 1024 * 1024, str(len(cuerpo)))

        # 4) editar y marcar agotado; verlo en el sitio publico
        pg.fill("#search", "zz prueba")
        pg.locator(f'#rows .row[data-id="{ID}"] .row-main').click()
        pg.wait_for_selector("#formView:not([hidden])")
        check("al editar el id es solo lectura", pg.get_attribute("#fId", "readonly") is not None)
        pg.locator("#fAgotado").evaluate("e => e.click()")   # el input real esta oculto tras el interruptor
        pg.fill("#fGancho", "Gancho editado")
        pg.click("#saveBtn")
        pg.wait_for_selector("#listView:not([hidden])", timeout=30000)
        tarj = tarjetas_sitio(br)
        check("sitio publico: sale con cinta de agotado", tarj.get(ID) is True, str(tarj.get(ID)))

        # 5) archivar: desaparece del sitio
        pg.locator(f'#rows .row[data-id="{ID}"] .row-main').click()
        pg.wait_for_selector("#formView:not([hidden])")
        pg.click("#archiveBtn")
        pg.wait_for_selector(f'#rows .row[data-id="{ID}"]', state="detached", timeout=15000)
        tarj = tarjetas_sitio(br)
        check("sitio publico: archivado desaparece", ID not in tarj)
        check("API publica (anon) no lo devuelve", rest_get(f"select=id&id=eq.{ID}") == [])

        # 6) eliminar desde Archivados
        pg.click('.tab[data-tab="archivados"]')
        pg.locator(f'#rows .row[data-id="{ID}"]').locator('.btn-danger-ghost').click()
        pg.fill("#deleteInput", ID)
        pg.click("#deleteOk")
        pg.wait_for_selector("#deleteDialog", state="hidden", timeout=30000)
        pg.wait_for_timeout(800)
        # la URL publica puede seguir sirviendo la foto desde cache (cache-control de 1 anio), asi que se
        # verifica con la sesion de admin: la fila (incluye archivados) y la lista real de objetos de Storage
        token = api_admin("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": pw_})["access_token"]
        filas = api_admin("GET", f"/rest/v1/productos?select=id&id=eq.{ID}", token=token)
        check("fila eliminada (vista admin, incluye archivados)", filas == [], str(filas))
        objetos = api_admin("POST", "/storage/v1/object/list/productos", {"prefix": ID, "limit": 100}, token=token)
        check("sin archivos en Storage bajo zz-prueba-panel/", objetos == [], str(objetos))

        # 7) movil: sesion nueva en 390 px
        m = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        mp = m.new_page()
        mp.on("console", lambda c: consola.append((c.type, c.text)))
        mp.goto(PANEL)
        mp.fill("#loginEmail", email)
        mp.fill("#loginPass", pw_)
        mp.click("#loginBtn")
        mp.wait_for_selector("#rows .row", timeout=20000)
        mp.screenshot(path=str(SHOTS / "e2e_lista_m390.png"))
        mp.locator("#rows .row .row-main").first.click()
        mp.wait_for_selector("#formView:not([hidden])")
        mp.screenshot(path=str(SHOTS / "e2e_form_m390.png"), full_page=True)
        check("390 px sin scroll horizontal", not mp.evaluate("document.documentElement.scrollWidth > innerWidth"))
        m.close()
        br.close()

    errores = [c for c in consola if c[0] in ("error", "pageerror")]
    check("sin errores de consola", not errores, str(errores))
    fallos = [n for n, ok in resultados if not ok]
    print("\nRESULTADO:", "TODO OK" if not fallos else f"{len(fallos)} falla(s): {fallos}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
