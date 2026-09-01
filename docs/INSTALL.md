# Nerdier — Build & Run

For someone who has never built an Android app before. Everything you need is
**already installed on this Mac** — you don't have to set anything up. This guide
just shows you how to open the project, run the game, and get it onto your phone.

Follow it top to bottom. Every step tells you what "it worked" looks like.

---

## First, five words you'll see a lot

You don't need to understand these deeply, but they'll stop the screens from
looking like nonsense.

| Word | What it actually means |
|---|---|
| **Android Studio** | The app you write and run Android apps in. Like Word, but for code. |
| **Gradle** | The thing that turns the code into an app. When Android Studio says "syncing" or "building", Gradle is doing it. |
| **SDK** | Android's toolbox — the pieces Gradle needs to build for a particular Android version. |
| **Emulator / AVD** | A fake Android phone that runs in a window on your Mac, so you can test without a real phone. AVD = "Android Virtual Device". |
| **APK** | The finished app file. This is the thing you install on a phone. |

---

## What's already done

You don't need to install, download, or configure any of this. It's done.

- ✅ Android Studio 2026.1, including the Java it needs
- ✅ Android SDK Platform 37 and build tools
- ✅ An emulator image (a virtual Pixel 7 running Android 37)
- ✅ A virtual device already created, named **`nerdier_test`**
- ✅ The project builds — **54 tests pass** and an APK has been produced

**The one thing not yet done:** nobody has actually *looked* at the app running.
It compiles and packages correctly, but it has never been on a screen. Section 2
is how you become the first person to see it.

---

## 1. Open the project

1. Open **Android Studio** from your Applications folder.
2. If you see a welcome screen, click **Open**. If a different project opens
   instead, use **File → Open**.
   > Choose **Open**, not "New Project" — the project already exists.
3. Navigate to **Desktop → Claude Files → Nerdle Clone** and select that folder.
   > Select the **`Nerdle Clone`** folder itself. Not the `app` folder inside it,
   > and not any individual file.
4. If it asks whether you trust the project, click **Trust Project**.
5. Wait. A progress bar runs along the bottom saying *"Gradle sync"*. This is
   Android Studio reading the project and working out how to build it.

**It worked when:** the bottom bar says **"Gradle sync finished"** and the panel
on the left shows a folder called **`app`**.

**If it fails:** see Section 6.

---

## 2. Run the game on the emulator

This is the fun part.

1. Look at the toolbar along the top. There's a dropdown showing a device name —
   it should already say **`nerdier_test`**. If it doesn't, click the dropdown and
   pick it.
2. Click the green ▶ **Run** button next to it. (Or press **Ctrl+R**.)
3. A window appears showing a phone. **Be patient the first time** — the virtual
   phone has to boot up exactly like a real one, which takes a couple of minutes.
   You'll see an Android logo, then a home screen, then Nerdier will open by
   itself.

**It worked when:** you see a grid of 6 rows × 8 empty squares, a keypad below it
with digits and `+ - * / =`, a ☰ menu icon in the top-left and a chart icon in the
top-right.

**Try this to confirm it really works:**

- Tap out `12+34=46` and press **Enter**. Tiles turn green, purple or black.
- Tap out `51+21=42` and press **Enter**. You should get an error message and the
  row should shake — and importantly, you should **not** lose a guess, because
  that equation isn't true.
- Tap the ☰ icon → **How to Play** to read the rules.
- Tap the chart icon to see your Today / This Week / This Month stats.

> **Leave the emulator running** while you work. Starting it is the slow part;
> after that, pressing ▶ again reinstalls the app in a few seconds.

---

## 3. Making a change and seeing it

1. In the left panel, open `app` → `src` → `main` → `res` → `values` →
   `strings.xml`.
2. Change some text between the `>` and `<` marks — for example the app name.
3. Press ▶ again.

The app rebuilds and relaunches with your change. That loop — edit, press ▶,
look — is basically all of Android development.

---

## 4. Put the game on your actual phone

Two ways. The first is easier.

### Option A: Just send yourself the APK

The finished app file is here:

```
app/build/outputs/apk/debug/app-debug.apk
```

Email it to yourself, AirDrop it, or put it in Dropbox. On the Android phone, open
it and tap **Install**.

Android will warn you about installing from an unknown source — that's normal for
an app that didn't come from the Play Store. Tap through to **Settings**, allow
installs from whichever app you used to open the file, then go back and install.

To rebuild the APK after making changes, in Android Studio use
**Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

### Option B: Plug the phone in

1. On the phone: **Settings → About phone**, then tap **Build number** seven times
   in a row. It'll say "You are now a developer". This is a real Android feature,
   not a trick.
2. **Settings → System → Developer options** → turn on **USB debugging**.
3. Plug the phone into the Mac. **The cable matters** — some charging cables have
   no data wires and won't work. If nothing happens, try another cable.
4. The phone shows *"Allow USB debugging?"* — tick **Always allow** and accept.
5. In Android Studio, the device dropdown now lists your phone. Pick it and
   press ▶.

---

## 5. Running the tests

The project has 54 automated tests that check the game logic — the tile colours,
the win detection, the equation rules, the stats.

In Android Studio: right-click the folder `app` → `src` → `test` → `java` and
choose **Run 'Tests in java'**.

**It worked when:** a panel opens at the bottom showing a green checkmark and
**54 passed**.

Run these after you change any game logic. If one goes red, it's telling you the
change broke something — click it to see which.

[TESTING.md](TESTING.md) explains what each test group covers.

---

## 6. When something goes wrong

**Gradle sync fails, or red errors appear everywhere right after opening**

Usually just a stale cache. **File → Invalidate Caches → Invalidate and Restart**,
then let it sync again.

**A message about `org.jetbrains.kotlin.android`**

Something added that plugin back into a build file. It has to be removed — this
project uses a newer build system that supplies Kotlin by itself. The exact error
text is *"no longer required for Kotlin support since AGP 9.0"*.

**"SDK location not found"**

There should be a file called `local.properties` in the project folder containing:

```
sdk.dir=/Users/thomascarnevale/Library/Android/sdk
```

If it's missing, create it with exactly that line.

**The emulator is extremely slow, or the window is black**

Close it fully and start it again from the device dropdown. If it's still bad,
**Tools → Device Manager**, click the ▾ next to `nerdier_test` and choose **Wipe
Data** — this resets the virtual phone to factory settings. You'll lose any saved
game stats on it, nothing else.

**The Compose previews on the right show a grey box**

They need the code compiled first. **Build → Make Project**, then click
**Refresh** in the preview panel.

**Nothing happens when I press ▶**

Check the device dropdown actually has a device selected. If it's empty, open
**Tools → Device Manager** and press ▶ next to `nerdier_test` to start it manually
first.

---

## 7. Where things live

```
Nerdle Clone/
├── app/src/main/java/com/nerdier/game/
│   ├── model/     shared vocabulary (tiles, rows, results)
│   ├── math/      making and checking equations
│   ├── logic/     scoring, win detection, game state
│   ├── data/      saving your stats
│   └── ui/        everything you see on screen
├── app/src/test/  the 54 tests
└── docs/          this guide, the testing notes, the design contract
```

If you want to change how the game **looks**, everything is under `ui/`. If you
want to change how it **plays**, look in `logic/` and `math/`.

---

## 8. A note on what's been checked

Being straight with you about what's verified, so you know where to look
carefully:

- **The code compiles and the tests pass.** The game logic — scoring, win
  detection, equation validity, the stats maths — is well covered by tests that
  genuinely run.
- **The visual side has never been seen.** The screens compile, but no one has
  looked at them. Colours, spacing, animations and the layout on a small screen
  are unverified. When you run it in Section 2, you're the first check on that,
  so do look critically — especially whether the grid and keypad both fit
  comfortably.
- **The app icon is a placeholder** made of simple shapes. To replace it:
  **File → New → Image Asset**.
