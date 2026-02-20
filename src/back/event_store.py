"""
Event store: single table game_events, append and load by room_id.
Works with SQLite (local) and Postgres via SQLAlchemy sync.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from config import settings


class Base(DeclarativeBase):
    pass


class GameEventModel(Base):
    __tablename__ = "game_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    room_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)  # SQLite stores as TEXT with JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sequence: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)


# Ensure data dir exists for default SQLite path
def _ensure_db_path():
    if settings.database_url.startswith("sqlite"):
        path = settings.database_url.replace("sqlite:///", "").strip()
        if path != ":memory:":
            dirname = os.path.dirname(path)
            if dirname:
                os.makedirs(dirname, exist_ok=True)


_ensure_db_path()
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    json_serializer=lambda x: json.dumps(x, ensure_ascii=False),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create game_events table if not exists."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency-style: yield a session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class EventStore:
    """Append events and load by room_id."""

    def __init__(self, session_factory=None):
        self._session = session_factory or SessionLocal

    def append(self, room_id: str, event_type: str, payload: dict[str, Any], sequence: int | None = None) -> str:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        if sequence is None:
            # Get next sequence for room
            with self._session() as db:
                max_seq = (
                    db.query(GameEventModel.sequence)
                    .filter(GameEventModel.room_id == room_id)
                    .order_by(GameEventModel.sequence.desc())
                    .limit(1)
                    .scalar()
                )
                sequence = (max_seq or 0) + 1
        with self._session() as db:
            row = GameEventModel(
                id=event_id,
                room_id=room_id,
                event_type=event_type,
                payload=payload,
                created_at=now,
                sequence=sequence,
            )
            db.add(row)
            db.commit()
        return event_id

    def append_many(self, room_id: str, events: list[tuple[str, dict[str, Any]]]) -> list[str]:
        """Append multiple events in one transaction; sequence auto-incremented."""
        ids: list[str] = []
        with self._session() as db:
            max_seq = (
                db.query(GameEventModel.sequence)
                .filter(GameEventModel.room_id == room_id)
                .order_by(GameEventModel.sequence.desc())
                .limit(1)
                .scalar()
            )
            seq = (max_seq or 0) + 1
            now = datetime.now(timezone.utc)
            for event_type, payload in events:
                event_id = str(uuid.uuid4())
                row = GameEventModel(
                    id=event_id,
                    room_id=room_id,
                    event_type=event_type,
                    payload=payload,
                    created_at=now,
                    sequence=seq,
                )
                db.add(row)
                ids.append(event_id)
                seq += 1
            db.commit()
        return ids

    def get_events_for_room(self, room_id: str) -> list[tuple[str, str, dict, int]]:
        """Return list of (event_id, event_type, payload, sequence) ordered by sequence."""
        with self._session() as db:
            rows = (
                db.query(GameEventModel)
                .filter(GameEventModel.room_id == room_id)
                .order_by(GameEventModel.sequence)
                .all()
            )
            return [(r.id, r.event_type, r.payload, r.sequence) for r in rows]
