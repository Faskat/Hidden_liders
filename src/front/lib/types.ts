/** Types matching backend /v1 projection and responses */

/** Card catalog entry from API (state.cards). Supports old format (red_delta/green_delta) and new (markers/ability). */
export interface CardCatalogEntry {
  name?: string;
  faction?: string;
  fraction_1?: string;
  fraction_2?: string;
  leader_number?: number;
  red_delta?: number;
  green_delta?: number;
  markers?: {
    red?: number | string;
    green?: number | string;
    logic?: string;
    green_alt?: number;
    red_alt?: number;
  };
  ability?: AbilityDef;
}

/** Ability definition from card catalog. */
export interface AbilityDef {
  action?: string;
  target_player?: string;
  target_zone?: string;
  source?: string | string[];
  target?: string;
  visibility?: string;
  filters?: Record<string, unknown>;
  options?: string[];
  effects?: string[];
  logic?: string;
  condition?: string;
  x_source?: string;
  count?: number;
  distribution?: boolean;
  targets?: string[];
}

/** Targets for PlayCard command. Backend accepts these in payload.targets. */
export interface PlayCardTargets {
  target_player_id?: string;
  target_card_id?: string;
  target_hidden_index?: number;
  target_guessed_faction?: string;
  perform_target_card_id?: string;
  perform_target_hidden_index?: number;
  tavern_slot?: number;
  /** Selected tavern slot indices when Draw (or similar) requires multiple (e.g. count 2). */
  tavern_slots?: number[];
  marker_choice?: string;
  marker_choice_side?: string;
  move_markers_option?: number;
  source_choice?: string;
  /** For Flip_Or_Look: "flip" = reveal card, "look" = only peek. */
  flip_or_look_choice?: "flip" | "look";
  /** For Swap other_party->self_hand: "take" = take to hand only, "swap" = swap with a card from hand. */
  take_or_swap_choice?: "take" | "swap";
  /** Card from actor hand to give in swap (when take_or_swap_choice === "swap"). */
  swap_hand_card_id?: string;
}

export interface LeaderView {
  leader_card_id: string | null;
  name: string | null;
  fraction_1: string | null;
  fraction_2: string | null;
  leader_number: number | null;
}

export interface HeroRefView {
  card_id: string;
  faction?: string;
  name?: string;
}

export interface PlayerView {
  player_id: string;
  name: string;
  leader: LeaderView;
  hand_card_ids: string[];
  hand_count: number;
  open_heroes: (HeroRefView | { count: number; order: number[] })[];
  hidden_heroes: HeroRefView[] | { count: number; order: number[] }[];
}

export interface GameStateView {
  room_id: string;
  creator_player_id?: string | null;
  current_phase: string;
  current_player_index: number;
  current_player_id: string | null;
  red_marker: number;
  green_marker: number;
  players: PlayerView[];
  tavern: ({ card_id: string; faction?: string; name?: string } | null)[];
  harbor_count: number;
  wilderness_count: number;
  graveyard_count?: number;
  graveyard_top: { card_id?: string; name?: string; faction?: string } | null;
  game_ended: boolean;
  winner_faction: string | null;
  winner_player_id: string | null;
  revealed_leaders: Record<string, unknown>;
  /** Card catalog from API: card_id -> { name, faction, markers?, ability?, ... } */
  cards?: Record<string, CardCatalogEntry>;
}

export interface CreateRoomResponse {
  room_id: string;
}

export interface JoinResponse {
  room_id: string;
  player_id: string;
  player_token: string;
  state: GameStateView;
}

export interface CommandResponse {
  state: GameStateView;
  /** Card IDs from harbor (Reveal_Harbor ability). */
  reveal_harbor?: string[];
  /** Card data for Look/Flip_Or_Look peek. */
  peek_card?: CardCatalogEntry & { card_id?: string };
}
