import { createClient } from "@/lib/supabase/client";

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const CATS: ("TODOS" | GameCategory)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export async function getGames(): Promise<Game[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("games").select("*");

  if (error) throw error;

  return data ?? [];
}

export async function getGameById(id: string): Promise<Game | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data ?? undefined;
}

const ACTIVITY_AGO = [
  "hace 2 min",
  "hace 5 min",
  "hace 8 min",
  "hace 12 min",
  "hace 18 min",
  "hace 24 min",
  "hace 31 min",
];

export interface ActivityRow {
  title: string;
  score: number;
  color: Game["color"];
  ago: string;
}

export function activityFeed(games: Game[]): ActivityRow[] {
  return games
    .filter((g) => g.id !== "duelo-pixel")
    .map((g, i) => ({
      title: g.title,
      score: g.best,
      color: g.color,
      ago: ACTIVITY_AGO[i],
    }));
}
