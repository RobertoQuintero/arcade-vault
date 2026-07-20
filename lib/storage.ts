export interface StoredUser {
  name: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy, derivado de created_at
}

const USER_KEY = "av_user";

export function getUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setUser(user: StoredUser | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

async function getSupabaseClient() {
  if (typeof window === "undefined") {
    const { createClient } = await import("@/lib/supabase/server");
    return createClient();
  }
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export async function saveScore(entry: ScoreEntry): Promise<void> {
  const supabase = await getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("scores").insert({
    game: entry.game,
    score: entry.score,
    name: entry.name,
    user_id: user?.id ?? null,
  });

  if (error) throw error;
}

export async function getScoresForGame(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}
