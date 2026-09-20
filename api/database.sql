-- Banco de dados SQLite do site de casamento.
-- Execute com: sqlite3 wedding.db ".read database.sql"

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Rsvps" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Rsvps" PRIMARY KEY AUTOINCREMENT,
    "GuestName" TEXT NOT NULL,
    "Email" TEXT NULL,
    "Attendance" INTEGER NOT NULL DEFAULT 0,
    "GuestsCount" INTEGER NOT NULL DEFAULT 1,
    "Message" TEXT NULL,
    "UpdatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Gifts" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Gifts" PRIMARY KEY AUTOINCREMENT,
    "Name" TEXT NOT NULL,
    "Description" TEXT NULL,
    "GoalAmount" TEXT NOT NULL,
    "ReservedBy" TEXT NULL,
    "ReservedMessage" TEXT NULL,
    "ReservedAt" TEXT NULL
);

CREATE TABLE IF NOT EXISTS "GiftContributions" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_GiftContributions" PRIMARY KEY AUTOINCREMENT,
    "GiftId" INTEGER NOT NULL,
    "ContributorName" TEXT NOT NULL,
    "Amount" TEXT NOT NULL,
    "Message" TEXT NULL,
    "CreatedAt" TEXT NOT NULL,
    CONSTRAINT "FK_GiftContributions_Gifts_GiftId"
        FOREIGN KEY ("GiftId") REFERENCES "Gifts" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_GiftContributions_GiftId"
    ON "GiftContributions" ("GiftId");
