-- Create FTS5 virtual table --
CREATE VIRTUAL TABLE email USING fts5(sender, title, body);
