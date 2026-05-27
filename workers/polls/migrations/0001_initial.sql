CREATE TABLE IF NOT EXISTS poll_options (
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (poll_id, option_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (poll_id, voter_hash),
  FOREIGN KEY (poll_id, option_id) REFERENCES poll_options (poll_id, option_id)
);

CREATE TABLE IF NOT EXISTS poll_vote_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  option_id TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_option_idx ON poll_votes (poll_id, option_id);
CREATE INDEX IF NOT EXISTS poll_vote_events_voter_created_idx ON poll_vote_events (voter_hash, created_at);

INSERT OR IGNORE INTO poll_options (poll_id, option_id, label, position) VALUES
  ('worktree-layout', 'sibling-suffix', 'Sibling suffix', 1),
  ('worktree-layout', 'hidden-local-hub', 'Hidden local hub', 2),
  ('worktree-layout', 'bare-repo-family', 'Bare repo family folder', 3),
  ('worktree-layout', 'project-local-hidden', 'Project-local hidden folder', 4),
  ('worktree-layout', 'zed-visible-hub', 'Zed-style visible hub', 5),
  ('worktree-layout', 'zed-git-hidden', 'Zed-supported .git hidden style', 6),
  ('worktree-layout', 'visible-container', 'Visible worktrees container', 7);
