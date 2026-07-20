import { notFound } from "next/navigation";
import { getGameById } from "@/lib/games";
import { GamePlayer } from "@/components/game-player";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
