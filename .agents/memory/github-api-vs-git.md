---
name: GitHub sync versus local Git state
description: Verify which parts of a GitHub update reached the local checkout before claiming a pull.
---

Do not infer local Git state from a successful GitHub API request or copied files. A file sync can leave the branch and index stale, while the workspace may also refresh origin tracking refs asynchronously.

**Why:** Remote file content, remote-tracking refs, Git objects, and the working tree can update at different times in a connected workspace.

**How to apply:** Check `origin/main`, `HEAD`, object availability, and worktree status separately. If the remote ref is current and synced source files already match it, a mixed reset can align the branch and index while preserving local config/package changes; otherwise avoid claiming a Git pull.
