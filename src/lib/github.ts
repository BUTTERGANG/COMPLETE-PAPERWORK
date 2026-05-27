import { ReplitConnectors } from '@replit/connectors-sdk';

const connectors = new ReplitConnectors();
const githubFetch = connectors.createProxyFetch('github');

const GITHUB_API = 'https://api.github.com';

async function ghGet<T>(path: string): Promise<T> {
  const res = await githubFetch(`${GITHUB_API}${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function ghPost<T>(path: string, body: unknown): Promise<T> {
  const res = await githubFetch(`${GITHUB_API}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub API POST ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  public_repos: number;
  followers: number;
  following: number;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
}

export interface GitHubOrg {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
  html_url: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  html_url: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Authenticated user profile. */
export const getAuthenticatedUser = () => ghGet<GitHubUser>('/user');

/** Repos the authenticated user has access to. */
export const listUserRepos = (perPage = 30, page = 1) =>
  ghGet<GitHubRepo[]>(`/user/repos?per_page=${perPage}&page=${page}&sort=updated`);

/** Organizations the authenticated user belongs to. */
export const listUserOrgs = () => ghGet<GitHubOrg[]>('/user/orgs');

/** Repos for a specific org. */
export const listOrgRepos = (org: string, perPage = 30, page = 1) =>
  ghGet<GitHubRepo[]>(`/orgs/${org}/repos?per_page=${perPage}&page=${page}&sort=updated`);

/** Directory listing or single file metadata for a repo path. */
export const getRepoContents = (owner: string, repo: string, path = '') =>
  ghGet<GitHubContent | GitHubContent[]>(`/repos/${owner}/${repo}/contents/${path}`);

/** Create or update a file in a repo (base64-encoded content). */
export const putRepoFile = (
  owner: string,
  repo: string,
  path: string,
  message: string,
  contentBase64: string,
  sha?: string,
) =>
  ghPost<{ content: GitHubContent }>(`/repos/${owner}/${repo}/contents/${path}`, {
    message,
    content: contentBase64,
    ...(sha ? { sha } : {}),
  });

/** Create a new repository under the authenticated user. */
export const createRepo = (name: string, isPrivate = true, description = '') =>
  ghPost<GitHubRepo>('/user/repos', { name, private: isPrivate, description, auto_init: true });

/** Check whether the GitHub connector is connected and working. */
export async function checkGitHubConnection(): Promise<{ connected: boolean; login?: string }> {
  try {
    const user = await getAuthenticatedUser();
    return { connected: true, login: user.login };
  } catch {
    return { connected: false };
  }
}
