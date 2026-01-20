-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "winningSong" TEXT,
    "mapType" TEXT,
    "mapLayout" TEXT,
    "totalRounds" INTEGER,
    "isPOTS" BOOLEAN NOT NULL DEFAULT false,
    "turnOrderA" TEXT,
    "turnOrderB" TEXT,
    "turnOrderC" TEXT,
    "highlightedEdges" TEXT,
    "currentTurnIndex" INTEGER,
    "placementTimeout" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Game" ("createdAt", "currentTurnIndex", "highlightedEdges", "id", "mapLayout", "mapType", "placementTimeout", "roomCode", "roundNumber", "status", "totalRounds", "turnOrderA", "turnOrderB", "turnOrderC", "updatedAt", "winningSong") SELECT "createdAt", "currentTurnIndex", "highlightedEdges", "id", "mapLayout", "mapType", "placementTimeout", "roomCode", "roundNumber", "status", "totalRounds", "turnOrderA", "turnOrderB", "turnOrderC", "updatedAt", "winningSong" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_roomCode_key" ON "Game"("roomCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
