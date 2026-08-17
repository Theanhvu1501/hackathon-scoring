-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "revealState",
ADD COLUMN     "judgeScoresRevealed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "revealedAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "RevealState";

