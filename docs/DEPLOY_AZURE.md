# Deploying Nerdier to Azure

Nerdier is a **static web app**: HTML, CSS and JavaScript that run entirely in
the player's browser. There is no server, no database and no login. Your stats
are saved in your own browser.

That matters, because it decides which Azure product is right.

## Why Azure Static Web Apps (and not the others)

| Product | Verdict |
|---|---|
| **Static Web Apps** | ✅ **Use this.** Free tier, global CDN, free HTTPS, free custom domains, deploys straight from GitHub. |
| App Service | ❌ Needs a paid always-on plan to serve files a CDN gives you for free. |
| Azure Functions | ❌ There is no server-side code to run. |
| Cosmos DB / SQL | ❌ There is nothing to store server-side. |
| Blob Storage static site | ⚠️ Works, but you'd wire up CDN, HTTPS and deployment yourself. Static Web Apps includes all three. |

**Cost: $0.** The free tier covers 100 GB of bandwidth a month, 250 MB per app,
and unlimited custom domains with free SSL certificates. A game this size will
not come close to those limits. There is no credit card charge and no meter
running — the free tier is genuinely free, not a trial.

---

## What you need before you start

- An **Azure account** — <https://portal.azure.com>
- A **GitHub account** — <https://github.com>

That's it. You don't need the Azure CLI.

---

## Step 1 — Put the code on GitHub

From the project folder in Terminal:

```bash
cd "/Users/thomascarnevale/Desktop/Claude Files/Nerdle Clone"
git init
git add .
git commit -m "Nerdier web app"
```

Now create an empty repository on GitHub: go to <https://github.com/new>, give
it a name like `nerdier`, leave **everything else unticked** (no README, no
.gitignore, no licence — the project already has them), and click
**Create repository**.

GitHub then shows you two commands. Run them:

```bash
git remote add origin https://github.com/YOUR-USERNAME/nerdier.git
git branch -M main
git push -u origin main
```

**It worked when:** refreshing the GitHub page shows your files instead of setup
instructions.

---

## Step 2 — Create the Static Web App in Azure

1. Go to <https://portal.azure.com> and sign in.
2. In the search bar at the top, type **Static Web Apps** and click it.
3. Click **+ Create**.
4. Fill in the **Basics** tab:

   | Field | What to put |
   |---|---|
   | Subscription | Whichever you have |
   | Resource Group | **Create new** → call it `nerdier-rg` |
   | Name | `nerdier` (this becomes part of your URL) |
   | Plan type | **Free** |
   | Region | Whichever is closest to you |
   | Deployment source | **Other** |

   > Choose **Other**, not GitHub. Connecting GitHub here makes Azure write its
   > own deployment file, which would sit alongside the one this project already
   > has and the two would fight. Picking "Other" lets us use the existing one,
   > which is better because it runs the tests before deploying.

5. Click **Review + create**, then **Create**.
6. Wait for "Your deployment is complete", then click **Go to resource**.

---

## Step 3 — Connect Azure to GitHub

Azure needs to prove to GitHub that it's allowed to receive your code. That's
done with a token.

1. On your Static Web App's page in Azure, click **Manage deployment token** in
   the top toolbar.
2. Click the copy icon. This is a password — don't paste it into a file, a chat,
   or a commit.
3. Go to your GitHub repository → **Settings** → **Secrets and variables** →
   **Actions**.
4. Click **New repository secret**.
   - **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
     (exactly that — the deployment file looks for this name)
   - **Secret:** paste the token
5. Click **Add secret**.

---

## Step 4 — Deploy

Deployment happens automatically whenever you push to `main`. Trigger the first
one:

```bash
git commit --allow-empty -m "Trigger first deploy"
git push
```

Watch it run: on GitHub, click the **Actions** tab. You'll see a job called
**Deploy to Azure Static Web Apps**. It takes about two minutes.

It does three things in order — type-check, run the tests, then deploy. **If the
tests fail, nothing is deployed.** That's deliberate: a broken build should never
reach players.

**It worked when:** the Actions job shows a green tick.

Your game is now live. Find the address on the Azure page for your app, labelled
**URL** — it looks like:

```
https://nerdier-<random-words>.azurestaticapps.net
```

Open it on your phone.

---

## Step 5 — Install it on your phone

This is what replaces the whole APK/sideloading problem.

**iPhone (Safari):** open the URL → tap the **Share** button → scroll down → **Add
to Home Screen**.

**Android (Chrome):** open the URL → you'll get an **Install app** prompt, or use
the ⋮ menu → **Install app**.

It then behaves like a normal app: its own icon, no browser chrome, and it
**works offline** — the service worker caches everything on first visit.

---

## Making changes

```bash
git add .
git commit -m "Describe what you changed"
git push
```

That's the whole deployment process from here on. Push to `main`, wait ~2
minutes, refresh.

> Installed copies update themselves. The service worker fetches the new version
> in the background; players get it next time they open the app.

### Preview links for changes you're unsure about

If you open a pull request instead of pushing to `main`, Azure builds it to a
separate temporary URL and posts the link as a comment on the PR. You can try the
change on your phone before it goes live. Closing the PR deletes that preview
automatically.

---

## Adding your own domain name

Only worth doing once you're happy with it. You need to already own a domain.

1. On your Static Web App in Azure → **Custom domains** → **+ Add**.
2. Enter your domain, e.g. `nerdier.example.com`.
3. Azure shows you a DNS record to create. Add it at whoever you bought the
   domain from (GoDaddy, Namecheap, Cloudflare…) — it'll be a **CNAME** pointing
   at your `.azurestaticapps.net` address.
4. Back in Azure, click **Validate**.

DNS changes can take anything from a few minutes to a few hours. The HTTPS
certificate is issued and renewed by Azure automatically, at no cost.

---

## Running it on your own machine first

You don't have to deploy to see changes. From the project folder:

```bash
cd web
npm install
npm run dev
```

Then open the address it prints, usually <http://localhost:5173>. Edits appear
in the browser instantly.

To check the real production build before pushing:

```bash
npm run build
npm run preview
```

---

## Troubleshooting

**The Actions job fails at "Type-check and test"**

Your change broke something. Click the red step to see which test failed — the
message names the specific behaviour. Fix it and push again. Nothing was
deployed, so the live site is untouched.

**The Actions job fails with "deployment_token was not provided"**

The GitHub secret is missing or misnamed. It must be spelled exactly
`AZURE_STATIC_WEB_APPS_API_TOKEN`. Redo Step 3.

**The site loads but shows a blank page**

Almost always a stale service worker from an earlier visit. On the phone or in
the browser, hard-refresh, or open the site in a private window to confirm. In
desktop Chrome: DevTools → **Application** → **Service Workers** →
**Unregister**, then reload.

**Changes don't appear after pushing**

Check the Actions tab actually ran. If it's green and you still see the old
version, it's the service worker cache — close the app completely and reopen it.

**I want to start over**

Delete the `nerdier-rg` resource group in Azure. That removes everything
associated with it, and stops any possibility of charges. Your code on GitHub is
untouched.
