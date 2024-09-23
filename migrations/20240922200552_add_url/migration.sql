/*
  Warnings:

  - The primary key for the `Author` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Book` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BookAuthor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Media` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Narrator` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Person` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Series` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SeriesBook` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `url` to the `Author` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `BookAuthor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Narrator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Person` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Series` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `SeriesBook` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Author" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "personId" INTEGER NOT NULL,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "Author_personId_url_fkey" FOREIGN KEY ("personId", "url") REFERENCES "Person" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Author" ("id", "insertedAt", "name", "personId", "updatedAt") SELECT "id", "insertedAt", "name", "personId", "updatedAt" FROM "Author";
DROP TABLE "Author";
ALTER TABLE "new_Author" RENAME TO "Author";
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "published" DATETIME,
    "publishedFormat" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Book" ("id", "insertedAt", "published", "publishedFormat", "title", "updatedAt") SELECT "id", "insertedAt", "published", "publishedFormat", "title", "updatedAt" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE TABLE "new_BookAuthor" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "BookAuthor_authorId_url_fkey" FOREIGN KEY ("authorId", "url") REFERENCES "Author" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookAuthor_bookId_url_fkey" FOREIGN KEY ("bookId", "url") REFERENCES "Book" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookAuthor" ("authorId", "bookId", "id") SELECT "authorId", "bookId", "id" FROM "BookAuthor";
DROP TABLE "BookAuthor";
ALTER TABLE "new_BookAuthor" RENAME TO "BookAuthor";
CREATE TABLE "new_Media" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "fullCast" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "abridged" BOOLEAN NOT NULL,
    "mpdPath" TEXT,
    "hlsPath" TEXT,
    "mp4Path" TEXT,
    "duration" TEXT,
    "published" DATETIME,
    "publishedFormat" TEXT,
    "notes" TEXT,
    "imagePath" TEXT,
    "description" TEXT,
    "publisher" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "Media_bookId_url_fkey" FOREIGN KEY ("bookId", "url") REFERENCES "Book" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Media" ("abridged", "bookId", "description", "duration", "fullCast", "hlsPath", "id", "imagePath", "insertedAt", "mp4Path", "mpdPath", "notes", "published", "publishedFormat", "publisher", "status", "updatedAt") SELECT "abridged", "bookId", "description", "duration", "fullCast", "hlsPath", "id", "imagePath", "insertedAt", "mp4Path", "mpdPath", "notes", "published", "publishedFormat", "publisher", "status", "updatedAt" FROM "Media";
DROP TABLE "Media";
ALTER TABLE "new_Media" RENAME TO "Media";
CREATE TABLE "new_Narrator" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "personId" INTEGER NOT NULL,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "Narrator_personId_url_fkey" FOREIGN KEY ("personId", "url") REFERENCES "Person" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Narrator" ("id", "insertedAt", "name", "personId", "updatedAt") SELECT "id", "insertedAt", "name", "personId", "updatedAt" FROM "Narrator";
DROP TABLE "Narrator";
ALTER TABLE "new_Narrator" RENAME TO "Narrator";
CREATE TABLE "new_Person" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "imagePath" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Person" ("description", "id", "imagePath", "insertedAt", "name", "updatedAt") SELECT "description", "id", "imagePath", "insertedAt", "name", "updatedAt" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE TABLE "new_Series" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Series" ("id", "insertedAt", "name", "updatedAt") SELECT "id", "insertedAt", "name", "updatedAt" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE TABLE "new_SeriesBook" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "bookNumber" TEXT NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "SeriesBook_bookId_url_fkey" FOREIGN KEY ("bookId", "url") REFERENCES "Book" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeriesBook_seriesId_url_fkey" FOREIGN KEY ("seriesId", "url") REFERENCES "Series" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SeriesBook" ("bookId", "bookNumber", "id", "seriesId") SELECT "bookId", "bookNumber", "id", "seriesId" FROM "SeriesBook";
DROP TABLE "SeriesBook";
ALTER TABLE "new_SeriesBook" RENAME TO "SeriesBook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
