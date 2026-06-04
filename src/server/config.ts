/**
 * Configuration for the managed (deployed) project repository.
 *
 * These values were previously hardcoded in the codebase. They are read from
 * environment variables so this repository can be public without leaking the
 * specific GitHub owner/repo it operates on. See `.env.example` for details.
 */

export const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "";
export const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME ?? "";
export const GITHUB_REPO_ID = process.env.GITHUB_REPO_ID ?? "";

/** "owner/name" form used by Vercel's `gitRepository.repo`. */
export const GITHUB_REPO_SLUG = `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

/** Full GitHub URL used by Vercel's `repoUrl` project filter. */
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
