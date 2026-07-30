"""
Знімок dev-галереї в один самодостатній HTML-файл.

Потрібен, бо скриншоти браузерної панелі в цьому середовищі недоступні, а
дивитись на арт очима — єдиний спосіб його оцінити. Сторінка рендериться на
сервері, тож достатньо забрати SSR-розмітку і вбудувати в неї CSS-бандли.

Запуск (фронт має бути піднятий на :3000):
    python src/front/scripts/snapshot-gallery.py [вихідний.html]
"""

import re
import sys
import urllib.request

BASE = "http://localhost:3000"
PAGE = BASE + "/dev/cards"


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def main() -> int:
    out_path = sys.argv[1] if len(sys.argv) > 1 else "gallery-snapshot.html"
    html = fetch(PAGE)

    # Вбудовуємо кожен CSS-бандл замість <link>, інакше файл нічого не варт
    # поза dev-сервером.
    for href in set(re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"', html)):
        css = fetch(href if href.startswith("http") else BASE + href)
        # Заміна лямбдою, а не рядком: у Tailwind-класах повно зворотних слешів,
        # і re.sub прийняв би їх за посилання на групи.
        html = re.sub(
            r'<link[^>]+href="%s"[^>]*/?>' % re.escape(href),
            lambda _m, c=css: "<style>%s</style>" % c,
            html,
        )

    # Скрипти лише заважають: сторінка потрібна статичною.
    html = re.sub(r"<script[\s\S]*?</script>", "", html)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("saved %s (%d KB)" % (out_path, len(html) // 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
