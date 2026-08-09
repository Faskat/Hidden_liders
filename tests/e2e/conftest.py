"""
Каркас E2E-перевірок анімацій: браузер, кімната, помічники очікування.

Тести ходять двома руками одразу. Через HTTP керують партією — створюють
кімнату, саджають гравців, роблять ходи за суперників; через Selenium дивляться
на стіл очима одного з гравців. Так сценарій лишається детермінованим (ніяких
кліків по модалках вибору цілі), а перевіряється саме те, що бачить гравець.

Сервери набір піднімає сам — і свої, на окремих портах, зі своєю тимчасовою
базою. Це не зручність, а умова відтворюваності: у бекенда в пам'яті рівно
десять кімнат і жодного витіснення (`session.py:47`), тож набір, запущений
поверх сервера, на якому вже грали руками, впирався б у ліміт на середині —
і падав би не там, де помилка. Своя база заразом означає, що тести не пишуть
у робочу `data/events.db`.

Ціна — одноразовий старт `next dev` (десятки секунд на перше складання
сторінки). Щоб платити її лише раз, сторінки прогріваються перед першим
тестом.

Готовий стенд можна підсунути змінними середовища — тоді набір нічого не
запускає:

    E2E_API=http://localhost:8000/v1  E2E_WEB=http://localhost:3000  pytest
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

ROOT = Path(__file__).resolve().parents[2]

#: Порти навмисно не 8000/3000: набір не має воювати з піднятими вручну
#: серверами розробки, і навпаки.
BACK_PORT = int(os.environ.get("E2E_BACK_PORT", "8010"))
FRONT_PORT = int(os.environ.get("E2E_FRONT_PORT", "3010"))

API = os.environ.get("E2E_API") or f"http://localhost:{BACK_PORT}/v1"
WEB = os.environ.get("E2E_WEB") or f"http://localhost:{FRONT_PORT}"

PROBE = (Path(__file__).parent / "probe.js").read_text(encoding="utf-8")

#: Скільки чекати на подію, якої ще немає. Опитування столу — раз на 4 с,
#: тож усе, що приїжджає чужим ходом, треба чекати довше за один тік.
POLL_TIMEOUT = 12.0

#: `next dev` складає сторінку під час першого запиту, і на холодну це десятки
#: секунд. Окрема, свідомо велика межа — саме для цього очікування.
BOOT_TIMEOUT = 180.0


def _request(method, path, body=None, token=None, base=None):
    base = base or API
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Player-Token", token)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()[:300]
        if "TOO_MANY_ROOMS" in body:
            # Сервер тримає рівно десять кімнат і не витісняє жодної
            # (`session.py:47`). Свій стенд у це не впирається — набір
            # переграє два столи, — але чужий цілком може бути вже вичерпаний.
            pytest.skip("сервер уперся в ліміт кімнат — перезапустіть бекенд")
        raise AssertionError(f"{method} {path} -> {exc.code}: {body}") from None


def _alive(url, timeout=3):
    try:
        with urllib.request.urlopen(url, timeout=timeout):
            return True
    except urllib.error.HTTPError:
        # Відповів — отже, живий. Який саме код, тут байдуже.
        return True
    except Exception:
        return False


def _port_busy(port):
    with socket.socket() as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _spawn(command, cwd, env_extra):
    env = dict(os.environ, **env_extra)
    kwargs = {}
    if sys.platform == "win32":
        # Своя група процесів: `npm` розгортається в дерево, і без цього
        # вбити вдасться лише обгортку.
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(
        command, cwd=str(cwd), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        shell=sys.platform == "win32", **kwargs,
    )


def _kill(proc):
    if proc is None or proc.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/T", "/F", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        )
    else:
        proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def _wait_alive(url, proc, what, timeout=BOOT_TIMEOUT):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc is not None and proc.poll() is not None:
            raise RuntimeError(f"{what} завершився з кодом {proc.returncode}, так і не піднявшись")
        if _alive(url, timeout=2):
            return
        time.sleep(0.5)
    raise RuntimeError(f"{what} не піднявся за {timeout:.0f} с ({url})")


@pytest.fixture(scope="session", autouse=True)
def servers():
    """Підняти свій стенд — або скористатися чужим, якщо порти вже зайняті."""
    started = []
    data_dir = None
    try:
        if _port_busy(BACK_PORT):
            _wait_alive(f"http://localhost:{BACK_PORT}/ready", None, "бекенд", timeout=10)
        else:
            data_dir = Path(tempfile.mkdtemp(prefix="hl-e2e-"))
            db = (data_dir / "events.db").as_posix()
            proc = _spawn(
                [sys.executable, "run.py"], ROOT / "src" / "back",
                {"PORT": str(BACK_PORT), "DATABASE_URL": f"sqlite:///{db}",
                 "LOG_LEVEL": "WARNING", "CORS_ORIGINS": "*"},
            )
            started.append(proc)
            _wait_alive(f"http://localhost:{BACK_PORT}/ready", proc, "бекенд")

        if _port_busy(FRONT_PORT):
            _wait_alive(WEB, None, "фронт", timeout=10)
        else:
            proc = _spawn(
                ["npm", "run", "dev", "--", "--port", str(FRONT_PORT)],
                ROOT / "src" / "front",
                {"NEXT_PUBLIC_API_URL": f"http://localhost:{BACK_PORT}",
                 "BROWSER": "none", "NEXT_TELEMETRY_DISABLED": "1"},
            )
            started.append(proc)
            _wait_alive(WEB, proc, "фронт")

        # Прогрів: `next dev` складає кожну сторінку на першому запиті, і без
        # цього перший тест платив би за складання чужим таймаутом.
        _alive(WEB, timeout=BOOT_TIMEOUT)
        _alive(f"{WEB}/room/0000", timeout=BOOT_TIMEOUT)
        yield
    finally:
        for proc in started:
            _kill(proc)
        if data_dir:
            shutil.rmtree(data_dir, ignore_errors=True)


class Room:
    """
    Кімната з піднятими гравцями. Індекс 0 — той, за кого дивиться браузер.

    Кімнати не створюються на кожен тест, а переграються: сервер тримає в
    пам'яті рівно десять і більше не віддає до перезапуску
    (`session.py:47`, витіснення там немає). Тому після партії стіл
    повертається в лобі й роздається наново — див. `reset`.
    """

    def __init__(self, num_players):
        self.id = _request("POST", "/rooms", {"num_players": num_players, "game_mode": "full"})["room_id"]
        self.players = [
            _request("POST", f"/rooms/{self.id}/join", {"name": f"P{i + 1}"})
            for i in range(num_players)
        ]

    def token(self, idx):
        return self.players[idx]["player_token"]

    def pid(self, idx):
        return self.players[idx]["player_id"]

    def start(self):
        return _request("POST", f"/rooms/{self.id}/start", None, self.token(0))["state"]

    def reset(self):
        """Повернути стіл у лобі: догра́ти, якщо треба, і скинути розклад."""
        state = self.state(0)
        if state["current_phase"] == "WAITING_FOR_PLAYERS":
            return
        if not state["game_ended"]:
            self.command(0, "EndGame")
        _request("POST", f"/rooms/{self.id}/back_to_lobby", None, self.token(0))

    def state(self, idx=0):
        return _request("GET", f"/rooms/{self.id}/state", None, self.token(idx))

    def phase(self, idx=0):
        return self.state(idx)["current_phase"]

    def cursor(self, idx=0):
        return self.state(idx)["event_cursor"]

    def events_since(self, since, idx=0):
        return _request(
            "GET", f"/rooms/{self.id}/state?since={since}", None, self.token(idx),
        )["events"]

    def command(self, idx, name, payload=None):
        return _request(
            "POST", f"/rooms/{self.id}/commands",
            {"command": name, "payload": payload or {}}, self.token(idx),
        )["state"]

    def try_command(self, idx, name, payload=None):
        """Те саме, але відмову повертає як None — деякі здібності не пускають далі."""
        try:
            return self.command(idx, name, payload)
        except AssertionError:
            return None

    def index_of_current(self):
        cur = self.state(0)["current_player_id"]
        return next(i for i in range(len(self.players)) if self.pid(i) == cur)

    def hand(self, idx):
        me = next(p for p in self.state(idx)["players"] if p["player_id"] == self.pid(idx))
        return list(me["hand_card_ids"])

    @staticmethod
    def _moves_markers(card_id, catalog):
        entry = catalog.get(card_id) or {}
        markers = entry.get("markers") or {}
        values = (markers.get("red"), markers.get("green"),
                  entry.get("red_delta"), entry.get("green_delta"))
        return any(isinstance(v, (int, float)) and v for v in values)

    def play_any_card(self, idx, prefer_markers=False):
        """
        Зіграти першу карту, яка піде без вибору цілі.

        Здібності частини карт вимагають цілей, і без них команда падає. Який
        саме герой дістанеться гравцеві, вирішує `random` на бекенді, тож
        єдиний надійний спосіб — пробувати по черзі.

        `prefer_markers` піднімає нагору тих, у кого в каталозі ненульова
        дельта: із 72 героїв жетони рухають 58, і без цієї підказки тест на
        рух жетона пропускався б щоразу, коли на руці зібралися решта 14.
        """
        state = self.state(idx)
        me = next(p for p in state["players"] if p["player_id"] == self.pid(idx))
        hand = list(me["hand_card_ids"])
        if prefer_markers:
            catalog = state.get("cards") or {}
            hand.sort(key=lambda cid: not self._moves_markers(cid, catalog))
        for card_id in hand:
            played = self.try_command(idx, "PlayCard", {"card_id": card_id})
            if played is not None:
                return card_id, played
        pytest.skip("жодна карта з руки не зіграється без вибору цілі")

    def finish_turn(self, idx):
        """Догнати хід до кінця, не граючи карти: пас -> добір -> скид -> таверна."""
        self.try_command(idx, "PassPlay")
        if self.state(idx)["current_phase"] == "DRAW":
            self.try_command(idx, "DrawFromTavern", {"slot_index": 0}) or self.try_command(idx, "DrawFromHarbor")
        if self.state(idx)["current_phase"] == "DISCARD":
            self.try_command(idx, "DiscardCards", {"card_ids": self.hand(idx)[:1]})
        self.try_command(idx, "RefillTavern")

    def hand_turn_to(self, idx):
        """Прокрутити ходи, поки черга не дійде до потрібного гравця."""
        for _ in range(len(self.players) * 2):
            if self.index_of_current() == idx:
                return
            self.finish_turn(self.index_of_current())
        pytest.skip("не вдалося передати хід — партія застрягла у фазі")


@pytest.fixture(scope="session")
def rooms():
    """Фабрика столів із переиспользованием: один стіл на кожну кількість гравців."""
    made = {}

    def get(num_players):
        if num_players not in made:
            made[num_players] = Room(num_players)
        return made[num_players]

    return get


@pytest.fixture
def table(rooms):
    """Стіл на двох, повернутий у лобі перед тестом."""
    room = rooms(2)
    room.reset()
    return room


@pytest.fixture
def table4(rooms):
    """Стіл на чотирьох: повернуті панелі й діагональні місця."""
    room = rooms(4)
    room.reset()
    return room


@pytest.fixture(scope="session")
def driver():
    opts = Options()
    opts.add_argument("--headless=new")
    # Стіл великий: у вузькому вікні спрацьовує автопідгонка зуму, і зони
    # починають їздити посеред сцени. Перевіряти анімації на рухомій дошці
    # безглуздо, тож вікно свідомо більше за стіл.
    opts.add_argument("--window-size=2200,1500")
    opts.add_argument("--force-device-scale-factor=1")
    drv = webdriver.Chrome(options=opts)
    drv.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": PROBE})
    drv.set_page_load_timeout(BOOT_TIMEOUT)
    yield drv
    drv.quit()


@pytest.fixture
def reduced_motion(driver):
    """Увімкнути `prefers-reduced-motion: reduce` на час одного тесту."""
    driver.execute_cdp_cmd(
        "Emulation.setEmulatedMedia",
        {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]},
    )
    yield
    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"features": []})


def open_room(driver, room, idx=0):
    """Відкрити стіл очима гравця `idx`; повертає його player_id."""
    driver.get(WEB + "/")
    driver.execute_script(
        "localStorage.setItem('hl_token_' + arguments[0], arguments[1]);"
        "localStorage.setItem('hl_player_' + arguments[0], arguments[2]);"
        "localStorage.setItem('hl_username', 'P' + (arguments[3] + 1));",
        room.id, room.token(idx), room.pid(idx), idx,
    )
    driver.get(f"{WEB}/room/{room.id}")
    wait_for(driver, "return !!window.__hlProbe && window.__hlProbe.ready()", "сторінка кімнати не піднялася")
    return room.pid(idx)


def wait_for(driver, script, message, timeout=POLL_TIMEOUT, interval=0.05):
    """Чекати, поки JS-вираз стане істинним. Повертає останнє значення."""
    deadline = time.time() + timeout
    value = None
    while time.time() < deadline:
        value = driver.execute_script(script)
        if value:
            return value
        time.sleep(interval)
    raise AssertionError(f"{message} (останнє значення: {value!r})")


def probe_reset(driver):
    driver.execute_script("window.__hlProbe.reset()")


def flights(driver):
    return driver.execute_script("return window.__hlProbe.flights()")


def inplace(driver):
    return driver.execute_script("return window.__hlProbe.inplace()")


def wait_flights(driver, count, message=None, timeout=POLL_TIMEOUT):
    wait_for(
        driver,
        f"return window.__hlProbe.flights().length >= {count}",
        message or f"не дочекалися {count} польотів",
        timeout,
    )
    return flights(driver)


def wait_flight(driver, timeout=POLL_TIMEOUT, **match):
    """Дочекатися польоту з потрібними полями; повертає всі, що підійшли."""
    cond = " && ".join(f"f.{key} === '{value}'" for key, value in match.items())
    wait_for(
        driver,
        f"return window.__hlProbe.flights().some(f => {cond})",
        f"не дочекалися польоту {match}",
        timeout,
    )
    return [f for f in flights(driver) if all(f[k] == v for k, v in match.items())]


def wait_settled(driver, timeout=POLL_TIMEOUT):
    """Дочекатися, поки все відлітає й на столі не лишиться прихованих карт."""
    wait_for(
        driver,
        "return window.__hlProbe.liveFlights() === 0 && window.__hlProbe.hiddenCards().length === 0",
        "польоти не завершилися або карта лишилася прихованою",
        timeout,
    )


START_BUTTON = "//button[contains(., 'Почати гру')]"


def start_game(driver):
    # Лобі домальовується після першого опитування столу, тож кнопки може ще
    # не бути в ту мить, коли сторінка вже «готова».
    deadline = time.time() + POLL_TIMEOUT
    while time.time() < deadline:
        found = driver.find_elements(By.XPATH, START_BUTTON)
        if found:
            found[0].click()
            return
        time.sleep(0.1)
    raise AssertionError("кнопка «Почати гру» не з'явилася")


def deal(driver, room):
    """Роздати й дочекатися кінця сцени. Повертає польоти роздачі."""
    probe_reset(driver)
    start_game(driver)
    expected = 4 + 5 * len(room.players)
    wait_flights(driver, expected, "сцена роздачі не програлася повністю")
    wait_settled(driver)
    return flights(driver)


def feed(driver, events):
    """Подати події режисеру напряму — для анімацій, які залежать від здібностей."""
    driver.execute_script("window.__hlFeed(arguments[0])", events)


def wait_for_turn(driver, player_id):
    """
    Дочекатися, поки хід дійде до гравця НА СТОЛІ, а не на сервері.

    Між ними — опитування раз на кілька секунд. Скинути спостерігач одразу
    після серверної команди означало б викинути з нього чужий хід, який ще
    навіть не почав програватися.
    """
    wait_for(
        driver,
        f"return !!window.__hlView && !!window.__hlView() && window.__hlView().current_player_id === '{player_id}'",
        f"стіл так і не дізнався, що ходить {player_id[:8]}",
    )


def ready_to_act(driver, table, idx=0):
    """Роздати, дочекатися ходу гравця `idx` і вийти на чистий спостерігач."""
    me = open_room(driver, table)
    deal(driver, table)
    table.hand_turn_to(idx)
    wait_for_turn(driver, table.pid(idx))
    wait_settled(driver)
    probe_reset(driver)
    return me


def sample(driver, every_ms=20):
    driver.execute_script(f"window.__hlProbe.sample({every_ms})")


def samples(driver):
    driver.execute_script("window.__hlProbe.stopSampling()")
    return driver.execute_script("return window.__hlProbe.samples()")
