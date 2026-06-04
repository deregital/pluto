# Pluto

Pluto is an internal admin dashboard for provisioning and managing deployments
of an application across [Vercel](https://vercel.com). From a single UI it can
create new "instances" of a managed app, configure their environment, attach
custom domains, store assets in S3, manage GitHub Actions secrets, and trigger
redeploys.

> Pluto orchestrates **another** repository (the "managed instance" repo). Which
> repository it deploys is fully configurable via environment variables — see
> [Configuration](#configuration).

## Features

- 🔐 **Authentication** with Google via [Auth.js / NextAuth](https://authjs.dev).
- 🚀 **Instance provisioning** — create a Vercel project from the managed repo,
  seed its environment variables, link a custom domain, copy shared team env
  vars, write a per-instance GitHub Actions secret, run migration/seed
  workflows, and ship the first deployment.
- ✏️ **Instance management** — update environment variables and redeploy.
- 🖼️ **Favicon management** — upload/replace per-instance favicons stored in S3.
- 🗓️ **Calendar dashboard** — operational view of the managed instances.
- 🔁 **Credentials webhook** — an HMAC-signed `POST /api/credentials` endpoint to
  configure a project's Mercado Pago credentials by hostname and redeploy.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, React 19, React Compiler)
- [tRPC v11](https://trpc.io) + [TanStack Query](https://tanstack.com/query) & [Form](https://tanstack.com/form)
- [Auth.js (NextAuth v5)](https://authjs.dev)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix UI)
- [Vercel SDK](https://github.com/vercel/sdk) + REST, [Octokit](https://github.com/octokit/rest.js), [AWS SDK for S3](https://aws.amazon.com/sdk-for-javascript/)
- [libsodium](https://doc.libsodium.org) (sealed boxes for GitHub secrets), [zod](https://zod.dev), [ky](https://github.com/sindresorhus/ky)

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io)
- Accounts/credentials for: a Google OAuth app, a Vercel team token, an AWS IAM
  user with access to the favicon bucket, and a GitHub token for the managed repo.

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# …then fill in every value in .env

# 3. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

All configuration is provided through environment variables. Copy
[`.env.example`](.env.example) to `.env` and fill in every value — the file
documents what each variable is for. At a glance:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Session signing secret (`npx auth secret`). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials. |
| `VERCEL_BEARER_TOKEN` / `VERCEL_TEAM_ID` | Vercel API token and target team. |
| `NEXT_PUBLIC_S3_BUCKET_URL` | Base URL of the S3 bucket (the image hostname and bucket name are derived from it). |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS S3 credentials. |
| `GITHUB_TOKEN` | Token to manage the managed repo's secrets/workflows. |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` / `GITHUB_REPO_ID` | The repository Pluto deploys instances from. |
| `CREDENTIALS_SIGNING_SECRET` | HMAC secret for the `/api/credentials` webhook. |

## Available scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm build` | Production build. |
| `pnpm start` | Run the production build. |
| `pnpm lint` | Run ESLint. |

## Project structure

```
src/
├── app/              # Next.js App Router (pages, server actions, API routes)
│   └── api/
│       ├── auth/        # NextAuth handler
│       ├── credentials/ # HMAC-signed credentials webhook
│       └── trpc/        # tRPC HTTP handler
├── components/       # UI (shadcn/ui) and feature components
├── lib/              # Shared utilities
└── server/           # tRPC routers, services, auth, config & security
    ├── config.ts        # Managed-repo configuration (from env)
    ├── routers/         # tRPC routers (vercel, aws, app)
    ├── security/        # Signed-request (HMAC) verification
    └── services/        # Vercel / S3 / GitHub / calendar clients
```

## Deployment

Pluto is a standard Next.js app and deploys to Vercel (or any Node host) out of
the box. Configure all variables from [`.env.example`](.env.example) in your
hosting provider's environment settings before deploying.

## Security

- Never commit `.env`. Only `.env.example` (with empty values) is tracked.
- Use least-privilege credentials: scope the AWS IAM user to the favicon bucket
  and prefer a fine-grained GitHub token limited to the managed repository.
- Set a strong, random `CREDENTIALS_SIGNING_SECRET`.
