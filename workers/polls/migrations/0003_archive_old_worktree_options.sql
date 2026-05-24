DELETE FROM poll_votes
WHERE poll_id = 'worktree-layout'
  AND option_id IN ('hidden-managed', 'sibling-folders', 'visible-hub');

DELETE FROM poll_options
WHERE poll_id = 'worktree-layout'
  AND option_id IN ('hidden-managed', 'sibling-folders', 'visible-hub');
