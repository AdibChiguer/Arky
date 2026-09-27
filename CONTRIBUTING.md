# Contributing to Arky

Thanks for helping improve Arky.

## Before you start

- Search existing issues before opening a duplicate.
- For larger changes, open an issue first so the direction can be discussed.
- Never commit `.env` files, credentials, API keys, personal clipboard data, or generated build directories.

## Development workflow

1. Fork or create a branch from the default branch.
2. Install dependencies with `npm install`.
3. Make a focused change and update documentation when behavior changes.
4. Run `npm run typecheck`, `npm run build`, and the relevant Rust checks.
5. Open a pull request describing the change and how it was tested.

Keep user data local, preserve existing configuration compatibility when possible, and prefer small, reviewable commits.
