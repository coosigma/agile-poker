export const NUMERIC_CARD_VALUES = ["0", "1", "2", "3", "5", "8", "13", "21", "34"] as const;
export const SPECIAL_CARD_VALUES = ["?", "☕"] as const;
export const MODIFIER_OPTIONS = ["flat", "base", "sharp"] as const;

export type NumericCardValue = (typeof NUMERIC_CARD_VALUES)[number];
export type SpecialCardValue = (typeof SPECIAL_CARD_VALUES)[number];
export type VoteModifier = (typeof MODIFIER_OPTIONS)[number];
export type RoomPhase = "lobby" | "countdown" | "voting" | "revealed";

export type VoteChoice =
  | {
      kind: "estimate";
      base: NumericCardValue;
      modifier: VoteModifier;
    }
  | {
      kind: "special";
      value: SpecialCardValue;
    };

export interface Participant {
  id: string;
  name: string;
  vote: VoteChoice | null;
  connected: boolean;
  isHost: boolean;
}

export interface RoomState {
  roomId: string;
  ticketTitle: string;
  phase: RoomPhase;
  countdownValue: number | null;
  participants: Participant[];
  updatedAt: number;
}

export type ClientMessage =
  | { type: "join_room"; roomId: string; name: string; claimHost?: boolean }
  | { type: "set_name"; name: string }
  | { type: "set_ticket"; ticketTitle: string }
  | { type: "vote"; vote: VoteChoice }
  | { type: "clear_vote" }
  | { type: "start_round" }
  | { type: "reveal_votes" };

export type ServerMessage =
  | { type: "room_state"; state: RoomState; selfId: string }
  | { type: "error"; message: string };
