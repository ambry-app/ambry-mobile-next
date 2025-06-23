-- Delete ALL player_states records where duplicates exist for the same logical key
-- This ensures no ID conflicts on next server sync
DELETE FROM player_states 
WHERE (url, media_id, user_email) IN (
  SELECT url, media_id, user_email 
  FROM player_states 
  GROUP BY url, media_id, user_email 
  HAVING COUNT(*) > 1
);