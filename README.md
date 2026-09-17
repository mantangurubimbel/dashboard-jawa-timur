# dashboard-jawa-timur

## Deployment identity

This repository deploys the Jawa Timur Dashboard application.

- GitHub repository: `https://github.com/mantangurubimbel/dashboard-jawa-timur.git`
- Production Vercel project: `dashboard-jawa-timur`
- Production deployment command: `npm run deploy:prod`

`data-bayar-jatim` is a different Vercel project and must never be used for
this application. Before a CLI deployment, verify that `.vercel/project.json`
has `projectName` set to `dashboard-jawa-timur`.

Recommended deployment checklist:

```bash
git remote -v
npm run deploy:prod
```

`npm run deploy:prod` first verifies the Git remote and `.vercel` project name,
then runs lint and a production build before invoking Vercel. It stops without
deploying if either identity check fails.

When the user says `deploy`, run `npm run deploy:prod`. This does not commit or
push changes to GitHub.

For Git-based deployment, push only after reviewing the intended diff:

```bash
git status
git diff --stat
git push origin main
```
