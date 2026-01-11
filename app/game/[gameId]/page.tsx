import { GameProvider } from "@/lib/contexts/game-context";
import { GameBoard } from "@/components/game/GameBoard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const { gameId } = await params;

  return (
    <GameProvider gameId={gameId}>
      <GameBoard />
    </GameProvider>
  );
}
