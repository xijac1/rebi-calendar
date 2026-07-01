ALTER TABLE calendars ADD COLUMN IF NOT EXISTS progress_mode text NOT NULL DEFAULT 'show_all';
