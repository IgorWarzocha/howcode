INSERT OR IGNORE INTO poll_options (poll_id, option_id, label, position) VALUES
  ('worktree-layout', 'sibling-suffix', 'Sibling suffix', 1),
  ('worktree-layout', 'hidden-local-hub', 'Hidden local hub', 2),
  ('worktree-layout', 'bare-repo-family', 'Bare repo family folder', 3),
  ('worktree-layout', 'project-local-hidden', 'Project-local hidden folder', 4),
  ('worktree-layout', 'zed-visible-hub', 'Zed-style visible hub', 5),
  ('worktree-layout', 'zed-git-hidden', 'Zed-supported .git hidden style', 6),
  ('worktree-layout', 'visible-container', 'Visible worktrees container', 7);

UPDATE poll_options SET position = 1, label = 'Sibling suffix' WHERE poll_id = 'worktree-layout' AND option_id = 'sibling-suffix';
UPDATE poll_options SET position = 2, label = 'Hidden local hub' WHERE poll_id = 'worktree-layout' AND option_id = 'hidden-local-hub';
UPDATE poll_options SET position = 3, label = 'Bare repo family folder' WHERE poll_id = 'worktree-layout' AND option_id = 'bare-repo-family';
UPDATE poll_options SET position = 4, label = 'Project-local hidden folder' WHERE poll_id = 'worktree-layout' AND option_id = 'project-local-hidden';
UPDATE poll_options SET position = 5, label = 'Zed-style visible hub' WHERE poll_id = 'worktree-layout' AND option_id = 'zed-visible-hub';
UPDATE poll_options SET position = 6, label = 'Zed-supported .git hidden style' WHERE poll_id = 'worktree-layout' AND option_id = 'zed-git-hidden';
UPDATE poll_options SET position = 7, label = 'Visible worktrees container' WHERE poll_id = 'worktree-layout' AND option_id = 'visible-container';
