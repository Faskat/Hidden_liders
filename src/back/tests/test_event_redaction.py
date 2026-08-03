"""
Редакція подій стрічки: що бачить власник і чого не бачить решта.

Один тест на рядок таблиці в шапці `domain/event_redaction.py`. Це не
формальність: стрічка бачить сирий журнал, де лежать і токени сесій, і seed
генератора, і весь порядок колоди, тож дірка тут коштує дорожче за будь-який
візуальний баг, заради якого стрічка й робилася.
"""
import pytest

from domain.event_redaction import redact_event_for_player
from domain.state import HeroRef
from tests.conftest import two_player_state


def _red(state, viewer, event_type, **payload):
    return redact_event_for_player(state, viewer, event_type, {"event_type": event_type, **payload})


class TestAlwaysStripped:
    def test_player_token_never_leaves_the_server(self):
        state = two_player_state()
        # Навіть власнику: він свій токен уже має, а ще одна копія в мережі — зайва.
        for viewer in ("p1", "p2"):
            out = _red(state, viewer, "PlayerJoined", player_id="p1", name="Alice", player_token="t1")
            assert "player_token" not in out
            assert out["name"] == "Alice"

    @pytest.mark.parametrize("event_type", ["GameCreated", "FirstPlayerChosen"])
    def test_seed_stripped(self, event_type):
        state = two_player_state()
        out = _red(state, "p1", event_type, seed=12345, room_id="r1")
        assert "seed" not in out


class TestDeckShuffled:
    def test_harbor_order_becomes_a_count(self):
        state = two_player_state()
        out = _red(state, "p1", "DeckShuffled", harbor_card_ids=["a", "b", "c"], source="initial")
        assert "harbor_card_ids" not in out
        assert out["count"] == 3
        assert out["source"] == "initial"


class TestLeaderDealt:
    def test_owner_sees_own_leader(self):
        state = two_player_state()
        out = _red(state, "p1", "LeaderDealt", player_id="p1", leader_card_id="leader_a")
        assert out["leader_card_id"] == "leader_a"

    def test_others_do_not(self):
        state = two_player_state()
        out = _red(state, "p2", "LeaderDealt", player_id="p1", leader_card_id="leader_a")
        assert "leader_card_id" not in out
        assert out["player_id"] == "p1"

    def test_public_after_game_end(self):
        state = two_player_state()
        state.game_ended = True
        out = _red(state, "p2", "LeaderDealt", player_id="p1", leader_card_id="leader_a")
        assert out["leader_card_id"] == "leader_a"


class TestHands:
    def test_starting_hand_owner_only(self):
        state = two_player_state()
        mine = _red(state, "p1", "StartingHandSet", player_id="p1", hand_card_ids=["hero_r", "hero_g"])
        assert mine["hand_card_ids"] == ["hero_r", "hero_g"]
        theirs = _red(state, "p2", "StartingHandSet", player_id="p1", hand_card_ids=["hero_r", "hero_g"])
        assert "hand_card_ids" not in theirs
        assert theirs["count"] == 2

    def test_discard_owner_only(self):
        state = two_player_state()
        theirs = _red(state, "p2", "CardsDiscarded", player_id="p1", card_ids=["hero_r"])
        assert "card_ids" not in theirs
        assert theirs["count"] == 1

    def test_wilderness_discard_owner_only(self):
        state = two_player_state()
        assert "card_id" not in _red(
            state, "p2", "HeroDiscardedToWilderness", player_id="p1", card_id="hero_r"
        )
        assert _red(state, "p1", "HeroDiscardedToWilderness", player_id="p1", card_id="hero_r")["card_id"] == "hero_r"


class TestDraws:
    def test_tavern_draw_is_public(self):
        state = two_player_state()
        out = _red(state, "p2", "CardDrawn", player_id="p1", card_id="hero_r", source="tavern", tavern_slot=0)
        assert out["card_id"] == "hero_r"

    def test_harbor_draw_owner_only(self):
        state = two_player_state()
        assert "card_id" not in _red(state, "p2", "CardDrawn", player_id="p1", card_id="hero_u", source="harbor")
        assert _red(state, "p1", "CardDrawn", player_id="p1", card_id="hero_u", source="harbor")["card_id"] == "hero_u"

    def test_setup_hero_drawn_follows_the_same_rule(self):
        state = two_player_state()
        assert "card_id" not in _red(state, "p2", "HeroDrawn", player_id="p1", card_id="hero_u", source="harbor")


class TestHiddenHeroes:
    def test_face_down_card_id_owner_only(self):
        state = two_player_state()
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_r")]
        assert "card_id" not in _red(state, "p2", "HeroPutFaceDown", player_id="p1", card_id="hero_r")
        assert _red(state, "p1", "HeroPutFaceDown", player_id="p1", card_id="hero_r")["card_id"] == "hero_r"

    def test_card_played_face_down_hides_deltas_too(self):
        """Дельти маркерів — такий самий відбиток карти, як і її id."""
        state = two_player_state()
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_r")]
        out = _red(
            state, "p2", "CardPlayed",
            player_id="p1", card_id="hero_r", red_delta=1, green_delta=0, as_open=False,
        )
        assert "card_id" not in out
        assert "red_delta" not in out
        assert "green_delta" not in out
        assert out["as_open"] is False

    def test_card_played_face_up_is_public(self):
        state = two_player_state()
        out = _red(
            state, "p2", "CardPlayed",
            player_id="p1", card_id="hero_r", red_delta=1, green_delta=0, as_open=True,
        )
        assert out["card_id"] == "hero_r"
        assert out["red_delta"] == 1

    def test_declassified_once_the_hero_is_flipped_face_up(self):
        """
        Стрічка — реплей історії. Після перевороту стара подія має бути видною,
        інакше клієнт, що опитав пізно, дізнався б менше, ніж уже дає /state.
        """
        state = two_player_state()
        state.players[0].open_heroes = [HeroRef(card_id="hero_r")]
        state.players[0].hidden_heroes = []
        out = _red(state, "p2", "HeroPutFaceDown", player_id="p1", card_id="hero_r")
        assert out["card_id"] == "hero_r"

    def test_declassified_once_the_hero_is_killed(self):
        state = two_player_state()
        state.players[0].hidden_heroes = []
        state.graveyard = ["hero_r"]
        out = _red(state, "p2", "HeroPutFaceDown", player_id="p1", card_id="hero_r")
        assert out["card_id"] == "hero_r"


class TestCardMoved:
    def test_public_zones_pass_through(self):
        state = two_player_state()
        out = _red(
            state, "p2", "CardMoved",
            card_id="hero_r", from_zone="tavern_0", to_zone="graveyard",
        )
        assert out["card_id"] == "hero_r"

    def test_hand_to_hand_visible_to_participants_only(self):
        state = two_player_state()
        kw = dict(card_id="hero_r", from_zone="hand", to_zone="hand", from_player_id="p1", to_player_id="p2")
        assert _red(state, "p1", "CardMoved", **kw)["card_id"] == "hero_r"
        assert _red(state, "p2", "CardMoved", **kw)["card_id"] == "hero_r"

    def test_hidden_party_hidden_from_bystander(self):
        state = two_player_state()
        state.players.append(state.players[0].model_copy(update={"player_id": "p3", "player_token": "t3"}))
        out = _red(
            state, "p3", "CardMoved",
            card_id="hero_r", from_zone="hand", to_zone="party_hidden",
            from_player_id="p1", to_player_id="p1",
        )
        assert "card_id" not in out


class TestPublicEvents:
    @pytest.mark.parametrize("event_type,payload", [
        ("MarkerMoved", {"red_delta": 1, "green_delta": -1}),
        ("MarkersPlaced", {"red_position": 1, "green_position": 1}),
        ("HeroRevealed", {"player_id": "p1", "card_id": "hero_r"}),
        ("HeroKilled", {"player_id": "p1", "card_id": "hero_r", "to_graveyard": True}),
        ("TavernRefilled", {"slot_index": 0, "card_id": "hero_r"}),
        ("TurnPhaseChanged", {"phase": "DRAW"}),
        ("HandsSwapped", {"player_id_1": "p1", "player_id_2": "p2"}),
        ("GraveyardInitialized", {"card_id": "hero_u"}),
        ("TavernFilled", {"tavern_slot_indices": [0, 1, 2], "card_ids": ["a", "b", "c"]}),
        ("WinnerDetermined", {"winner_player_id": "p1", "winner_faction": "Imperials"}),
    ])
    def test_passes_through_untouched(self, event_type, payload):
        state = two_player_state()
        out = _red(state, "p2", event_type, **payload)
        for key, value in payload.items():
            assert out[key] == value
