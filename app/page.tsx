import { getGames } from "@/lib/games";
import { HomeContent } from "./home-content";

export default async function Home() {
  const games = await getGames();
  return <HomeContent games={games} />;
}
