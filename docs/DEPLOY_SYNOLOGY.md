# Hosting Nerdier on a Synology NAS (Web Station)

Nerdier is a plain static site — HTML, CSS and JavaScript, about 300 KB, with no
backend, no database and no network calls once it loads. Web Station serves that
directly, so this is a genuinely simple deployment.

This guide covers serving it from a **subfolder** (`http://your-nas/nerdier/`)
on your **home network only**.

> **Verified before writing:** the subfolder build was served from a simulated
> NAS web root and loaded in a browser — every asset resolved, the board and
> keypad rendered, and the `.webmanifest` was served with the correct MIME type.

---

## What this setup does and doesn't give you

| | |
|---|---|
| ✅ Plays fully | Board, keypad, rules, stats — everything works |
| ✅ Any device on your wi-fi | Phone, tablet, laptop |
| ✅ Free, nothing exposed | No router changes, no ports opened |
| ❌ Not installable to a home screen | Needs HTTPS — see the last section |
| ❌ No offline play | Same reason: service workers require HTTPS |
| ❌ Not reachable off your network | By design here |

**Why no PWA over plain HTTP:** browsers only register service workers on HTTPS
or `localhost`. Over `http://192.168.1.x` the site works perfectly, but the
"Add to Home Screen" behaviour and offline caching silently do not activate.
That is a browser rule, not a limitation of the app. The last section fixes it.

---

## Step 1 — Build for the subfolder

The built asset URLs are absolute, so the app has to know the folder name at
**build time**. From the project:

```bash
cd "/Users/thomascarnevale/Desktop/Claude Files/Nerdle Clone/web" && npm run build:nas
```

That runs `BASE_PATH=/nerdier/ npm run build` and writes everything into
`web/dist/`.

**It worked when:** `web/dist/index.html` references `/nerdier/assets/…` rather
than `/assets/…`. Check with:

```bash
grep -o 'src="[^"]*"' "/Users/thomascarnevale/Desktop/Claude Files/Nerdle Clone/web/dist/index.html"
```

> Using a different folder name? Run `BASE_PATH=/whatever/ npm run build`
> instead — the name is baked in, so it must match the folder you create in
> step 2 exactly, including the trailing slash.

---

## Step 2 — Copy the files onto the NAS

Synology's default web root is the shared folder named **`web`**
(`/volume1/web`). Put the build in a `nerdier` subfolder of it.

**Easiest way — File Station:**

1. Open **File Station** in DSM.
2. Go to the **`web`** shared folder. If it isn't there, install **Web Station**
   from Package Center first — it creates the folder.
3. Create a folder called **`nerdier`**.
4. Upload the **contents** of `web/dist/` into it.

> Upload what's *inside* `dist`, not the `dist` folder itself. You want
> `web/nerdier/index.html`, not `web/nerdier/dist/index.html`.

**Or over the network,** if you have the NAS mounted (adjust the mount path):

```bash
rsync -av --delete "/Users/thomascarnevale/Desktop/Claude Files/Nerdle Clone/web/dist/" "/Volumes/web/nerdier/"
```

The trailing slash on the source is what copies the contents rather than the
folder. `--delete` removes stale files from previous builds — the JS filename
changes every build, so without it the folder accumulates junk.

---

## Step 3 — Make sure Web Station is serving that folder

1. **Package Center → Web Station** — install it if you haven't.
2. Open **Web Station → Web Service**. You need a service pointing at the `web`
   shared folder as a **static website**. If you already host something at
   `http://your-nas/`, this exists and you're done — subfolders are served
   automatically.
3. If nothing is configured yet, create a **Web Service** of type *Static
   website* with `web` as its document root, then create a **Web Portal** for it.
   A **port-based** portal is simplest on a home network — pick a port such as
   `8081`.

**It worked when:** browsing to `http://YOUR-NAS-IP/nerdier/` (or
`http://YOUR-NAS-IP:8081/nerdier/`) shows the 6×8 grid with the keypad below it.

Find your NAS's address in DSM under **Control Panel → Network → Network
Interface**, or use its hostname, e.g. `http://diskstation/nerdier/`.

---

## Step 4 — Play it on your phone

Connect the phone to the same wi-fi and open the same URL. Bookmark it.

You can add it to your home screen, but on plain HTTP it will be a **bookmark
shortcut**, not an installed app — it opens in the browser with the address bar
visible, and it won't work without a connection.

---

## Updating it later

Rebuild and re-copy:

```bash
cd "/Users/thomascarnevale/Desktop/Claude Files/Nerdle Clone/web" && npm run build:nas && rsync -av --delete dist/ /Volumes/web/nerdier/
```

Then hard-refresh in the browser. Asset filenames are content-hashed, so the
browser picks up changes immediately — no cache-busting needed.

---

## Troubleshooting

**Blank page, and the console shows 404s for `/assets/…`**

The build's base path doesn't match the folder. You either built with
`npm run build` (root) instead of `npm run build:nas`, or the folder isn't
called `nerdier`. Rebuild with the matching `BASE_PATH`.

**403 Forbidden**

Permissions on the `web` shared folder. In **Control Panel → Shared Folder →
web → Edit → Permissions**, make sure the `http` system user has read access.
Uploading via SMB from a Mac sometimes strips this.

**The page loads but is unstyled**

Same cause as the blank page — the CSS 404'd. Check the base path.

**The manifest 404s or the console complains about its MIME type**

Some Web Station configurations don't know `.webmanifest`. It's harmless on a
LAN-only setup, since the PWA can't activate over HTTP anyway. It matters only
once you move to HTTPS.

**My stats are empty / reset**

Stats live in the browser's `localStorage`, which is scoped to the exact origin.
`http://192.168.1.50/nerdier/` and `http://diskstation/nerdier/` are *different
origins* and keep *separate* stats, even though they're the same NAS. Pick one
address and stick to it. This is the same reason multiple dev-server ports each
had their own history.

---

## Getting HTTPS: Synology DDNS + Let's Encrypt

This gets you a certificate browsers actually trust, which is what unlocks
installing the game to a phone home screen and playing it offline — **without
opening a single port on your router**.

Everything here happens in DSM's web interface. Signing in to your Synology
Account is yours to do.

### Why this works without port forwarding

Let's Encrypt normally proves you own a domain by connecting to it from the
internet on port 80 — which is why most guides tell you to forward that port.
**Synology DDNS hostnames are the exception:** DSM asks Synology to validate the
`*.synology.me` name on their side, so nothing needs to reach your NAS from
outside. This is the single biggest reason to prefer a `synology.me` name over
a custom domain for a home-only setup.

### Step 1 — Create the DDNS hostname

1. **Control Panel → External Access → DDNS → Add**.
2. **Service provider:** `Synology`.
3. **Hostname:** pick something, e.g. `yourname` → `yourname.synology.me`.
4. Click **Sign in with Synology Account** and authenticate. *(Your credentials,
   your click.)*
5. Tick **Get a certificate from Let's Encrypt and set as default**.
6. **OK**.

**It worked when:** the DDNS list shows your hostname with status **Normal**.

> The hostname now publicly resolves to your home's IP address. Nothing is
> *reachable* — you've forwarded no ports — but the mapping is public. That's
> inherent to DDNS, and worth knowing.

### Step 2 — Confirm the certificate

**Control Panel → Security → Certificate.** You should see a certificate issued
to `yourname.synology.me` by **Let's Encrypt**, with an expiry ~90 days out.

DSM renews it automatically, roughly 30 days before expiry. Renewal uses the
same Synology-side validation, so it keeps working with no ports open — but the
NAS does need to be powered on and online when it happens.

### Step 3 — Make the hostname point at the NAS *inside* your network

**This is the step people get stuck on, and it's unavoidable for a LAN-only
setup.** Your hostname resolves to your *public* IP. A phone on your wi-fi will
therefore try to reach your router from the inside and — with no port forwarding
— get nothing.

The fix is a **local DNS override**: tell your network that
`yourname.synology.me` means the NAS's LAN address (e.g. `192.168.1.50`).

**Option A — your router (best, covers every device automatically).**
Look for a feature called *Local DNS*, *DNS host entry*, *Static DNS*, *Host
records*, or *DNS Director*. Add an entry mapping the hostname to the NAS's LAN
IP. ASUS, Fritz!Box, Ubiquiti, pfSense and OPNsense all support this; many ISP
supplied routers do not.

**Option B — Synology's own DNS Server package.**
Install **DNS Server** from Package Center, create a zone for
`yourname.synology.me` pointing at the NAS's LAN IP, then set your router's DHCP
to hand out the NAS as the DNS server. More moving parts, but it works on any
router.

**Option C — per-device hosts file.**
Works on a Mac or PC. **Does not work on a stock iPhone or Android**, so it will
not get you the PWA on a phone. Fine for testing from a laptop only.

Also give the NAS a **static / reserved IP** in your router's DHCP settings —
otherwise the address changes and the override silently breaks.

**It worked when:** on a device connected to your wi-fi,
`ping yourname.synology.me` returns the NAS's **LAN** address, not a public one.

### Step 4 — Serve the site over HTTPS

1. **Web Station → Web Portal**, edit (or create) the portal serving your `web`
   folder.
2. Set it to **HTTPS**, and select the `yourname.synology.me` certificate.
3. If DSM itself already occupies 443, give the portal its own HTTPS port
   (e.g. `8443`) — the certificate is equally valid on any port.

**It worked when:** `https://yourname.synology.me/nerdier/` loads with a padlock
and **no certificate warning**. A warning means the certificate doesn't match the
name you typed — use the hostname, never the raw IP.

### Step 5 — Install it on your phone

Open `https://yourname.synology.me/nerdier/` on the phone.

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** ⋮ → **Install app**, or accept the prompt.

Now it opens without browser chrome and **plays with wi-fi off**, because the
service worker caches everything on the first visit.

> **Your stats will start empty.** `https://yourname.synology.me` is a different
> origin from `http://192.168.1.50`, and `localStorage` is per-origin. Same NAS,
> same files, separate save data. Move to the HTTPS hostname permanently and use
> only that.

### If the app installs but won't work offline

Load it once over HTTPS with a connection, wait a few seconds for the service
worker to cache (11 files, ~250 KB), then close and reopen. Caching happens on
first visit, not at install.

### A note on what I verified, and what I couldn't

The build artifacts are confirmed correct: `registerSW.js` registers
`/nerdier/sw.js` with scope `/nerdier/`, the manifest declares `start_url` and
`scope` of `/nerdier/` with three icons, and `sw.js` plus its workbox chunk are
served with the right content type.

**Service worker registration itself is unverified.** The embedded browser used
for testing blocks it (`Failed to register a ServiceWorker … unknown error`),
even on `localhost`, which is a secure context. That is a limitation of that
browser, not evidence about your NAS. The real test is step 5 on your phone —
if the install prompt appears and it runs with wi-fi off, it's working.

## The other option

If public access ever matters more than self-hosting,
[DEPLOY_AZURE.md](DEPLOY_AZURE.md) covers Azure Static Web Apps — free tier,
HTTPS and the PWA working out of the box, with no ports opened on your home
router.
