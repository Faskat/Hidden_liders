const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API = `${BASE.replace(/\/$/, "")}/v1`;

function headers(token?: string): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (token) (h as Record<string, string>)["X-Player-Token"] = token;
  return h;
}

/** Parse error response: FastAPI detail.message or detail, else plain text. */
function parseErrorResponse(text: string): string {
  try {
    const d = JSON.parse(text);
    const detail = d.detail;
    if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
    if (typeof detail === "string") return detail;
    return text;
  } catch {
    return text;
  }
}

/** Thrown when API returns non-2xx. status is set so callers can treat 401 (session invalid) differently. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function createRoom(numPlayers: number = 2, gameMode: string = "full") {
  const r = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ num_players: numPlayers, game_mode: gameMode }),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

export async function joinRoom(roomId: string, name: string) {
  const r = await fetch(`${API}/rooms/${roomId}/join`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

export async function startGame(roomId: string, token: string) {
  const r = await fetch(`${API}/rooms/${roomId}/start`, {
    method: "POST",
    headers: headers(token),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

/** Return to lobby after game end (same players, can start a new game). */
export async function backToLobby(roomId: string, token: string) {
  const r = await fetch(`${API}/rooms/${roomId}/back_to_lobby`, {
    method: "POST",
    headers: headers(token),
  });
  const text = await r.text();
  if (!r.ok) {
    if (r.status === 404 && text.includes("Not Found") && !text.includes("ROOM_NOT_FOUND")) {
      throw new Error("Ендпоінт не знайдено. Перезапустіть бекенд (python run.py у src/back).");
    }
    throw new Error(parseErrorResponse(text));
  }
  return text ? JSON.parse(text) : {};
}

export async function getState(roomId: string, token: string) {
  const r = await fetch(`${API}/rooms/${roomId}/state`, {
    headers: headers(token),
  });
  const text = await r.text();
  if (!r.ok) throw new ApiError(parseErrorResponse(text), r.status);
  return JSON.parse(text);
}

export async function sendCommand(
  roomId: string,
  token: string,
  command: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string
) {
  const h = headers(token) as Record<string, string>;
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  const r = await fetch(`${API}/rooms/${roomId}/commands`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ command, payload }),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

export async function rejoin(roomId: string, playerToken: string) {
  const r = await fetch(`${API}/rooms/${roomId}/rejoin`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ player_token: playerToken }),
  });
  const text = await r.text();
  if (!r.ok) throw new ApiError(parseErrorResponse(text), r.status);
  return text ? JSON.parse(text) : {};
}

/** Leave the room (lobby only). Creator role transfers to the next player. */
export async function leaveRoom(roomId: string, token: string) {
  const r = await fetch(`${API}/rooms/${roomId}/leave`, {
    method: "POST",
    headers: headers(token),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

/** Kick a player from the lobby. Creator only, lobby only. */
export async function kickPlayer(roomId: string, token: string, playerId: string) {
  const r = await fetch(`${API}/rooms/${roomId}/kick`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ player_id: playerId }),
  });
  if (!r.ok) throw new Error(parseErrorResponse(await r.text()));
  return r.json();
}

/** Fire-and-forget leave request on page unload. Uses sendBeacon (token in body) so it works when tab is closed. */
export function leaveRoomBeacon(roomId: string, token: string): boolean {
  const url = `${API}/rooms/${roomId}/leave`;
  const payload = JSON.stringify({ player_token: token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    return navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
  return true;
}

/** Add a bot to the room (lobby only). For testing. */
export async function addBot(roomId: string, token: string) {
  const url = `${API}/rooms/${roomId}/add_bot`;
  const r = await fetch(url, {
    method: "POST",
    headers: headers(token),
  });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 404 && text.includes("Not Found")) {
      throw new Error("Ендпоінт не знайдено. Перезапустіть бекенд (python run.py у src/back).");
    }
    throw new Error(parseErrorResponse(text));
  }
  return r.json();
}
