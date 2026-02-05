---
description: How to deploy the Next.js application to Vercel
---

# Deploying to Vercel

To host this application on Vercel, follow these steps:

## 1. Initial Deployment (Manual)

If you haven't connected your project to Vercel yet, run these commands from the `loc-counter` directory:

```bash
cd loc-counter
npm install -g vercel
vercel login
vercel link
```

Follow the prompts to create a new project. Once linked, you can deploy manually:

```bash
// turbo
vercel deploy --prod
```

## 2. GitHub Integration (Recommended)

The easiest way to maintain the deployment is to connect your GitHub repository directly to Vercel:

1. Push your code to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import your repository.
4. **Important**: Set the **Root Directory** to `loc-counter`.
5. Click **Deploy**.

## 3. GitHub Actions (Advanced Pipeline)

I have already created a workflow file in `.github/workflows/deploy.yml`. To use it:

1. In your Vercel Dashboard, go to **Settings > General** to find your **Project ID** and **Org ID**.
2. Go to **Settings > Tokens** to create a **Vercel Access Token**.
3. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
4. Add the following secrets:
   - `VERCEL_TOKEN`: Your Vercel Access Token.
   - `VERCEL_ORG_ID`: Your Vercel Organization ID.
   - `VERCEL_PROJECT_ID`: Your Vercel Project ID.

Now, every push to the `main` branch will automatically trigger a deployment.
