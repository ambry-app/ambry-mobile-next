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

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Author" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "personId" TEXT NOT NULL,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "Author_personId_url_fkey" FOREIGN KEY ("personId", "url") REFERENCES "Person" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Author" ("id", "insertedAt", "name", "personId", "updatedAt", "url") SELECT "id", "insertedAt", "name", "personId", "updatedAt", "url" FROM "Author";
DROP TABLE "Author";
ALTER TABLE "new_Author" RENAME TO "Author";
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "published" DATETIME,
    "publishedFormat" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Book" ("id", "insertedAt", "published", "publishedFormat", "title", "updatedAt", "url") SELECT "id", "insertedAt", "published", "publishedFormat", "title", "updatedAt", "url" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE TABLE "new_BookAuthor" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "BookAuthor_authorId_url_fkey" FOREIGN KEY ("authorId", "url") REFERENCES "Author" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookAuthor_bookId_url_fkey" FOREIGN KEY ("bookId", "url") REFERENCES "Book" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookAuthor" ("authorId", "bookId", "id", "url") SELECT "authorId", "bookId", "id", "url" FROM "BookAuthor";
DROP TABLE "BookAuthor";
ALTER TABLE "new_BookAuthor" RENAME TO "BookAuthor";
CREATE TABLE "new_Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
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
INSERT INTO "new_Media" ("abridged", "bookId", "description", "duration", "fullCast", "hlsPath", "id", "imagePath", "insertedAt", "mp4Path", "mpdPath", "notes", "published", "publishedFormat", "publisher", "status", "updatedAt", "url") SELECT "abridged", "bookId", "description", "duration", "fullCast", "hlsPath", "id", "imagePath", "insertedAt", "mp4Path", "mpdPath", "notes", "published", "publishedFormat", "publisher", "status", "updatedAt", "url" FROM "Media";
DROP TABLE "Media";
ALTER TABLE "new_Media" RENAME TO "Media";
CREATE TABLE "new_Narrator" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "personId" TEXT NOT NULL,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "Narrator_personId_url_fkey" FOREIGN KEY ("personId", "url") REFERENCES "Person" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Narrator" ("id", "insertedAt", "name", "personId", "updatedAt", "url") SELECT "id", "insertedAt", "name", "personId", "updatedAt", "url" FROM "Narrator";
DROP TABLE "Narrator";
ALTER TABLE "new_Narrator" RENAME TO "Narrator";
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "imagePath" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Person" ("description", "id", "imagePath", "insertedAt", "name", "updatedAt", "url") SELECT "description", "id", "imagePath", "insertedAt", "name", "updatedAt", "url" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "insertedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("id", "url")
);
INSERT INTO "new_Series" ("id", "insertedAt", "name", "updatedAt", "url") SELECT "id", "insertedAt", "name", "updatedAt", "url" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE TABLE "new_SeriesBook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "bookNumber" TEXT NOT NULL,

    PRIMARY KEY ("id", "url"),
    CONSTRAINT "SeriesBook_bookId_url_fkey" FOREIGN KEY ("bookId", "url") REFERENCES "Book" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeriesBook_seriesId_url_fkey" FOREIGN KEY ("seriesId", "url") REFERENCES "Series" ("id", "url") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SeriesBook" ("bookId", "bookNumber", "id", "seriesId", "url") SELECT "bookId", "bookNumber", "id", "seriesId", "url" FROM "SeriesBook";
DROP TABLE "SeriesBook";
ALTER TABLE "new_SeriesBook" RENAME TO "SeriesBook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
