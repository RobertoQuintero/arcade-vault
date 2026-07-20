"use client";

import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";

export function GameTable({ games }: { games: Game[] }) {
  const router = useRouter();

  return (
    <div className="catalog-table">
      <div className="ct-inner">
        <div className="th">
          <div>TÍTULO</div>
          <div>CATEGORÍA</div>
          <div>MEJOR PUNTUACIÓN</div>
          <div>PARTIDAS</div>
        </div>
        {games.map((g, i) => (
          <div
            key={g.id}
            className="row"
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => router.push(`/games/${g.id}`)}
          >
            <div className="title">{g.title}</div>
            <div className={"cat " + g.color}>{g.cat}</div>
            <div className="best">{g.best.toLocaleString("es-ES")}</div>
            <div className="plays">{g.plays}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
