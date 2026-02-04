-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "currentMapNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "firstMapLayout" TEXT,
ADD COLUMN     "firstMapResults" TEXT,
ADD COLUMN     "isMultiMap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondMapLayout" TEXT;
