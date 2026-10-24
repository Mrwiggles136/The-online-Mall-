# Your store

A free online store that runs on GitHub Pages. Customers browse 10 items per page, search,
filter by category, add to a cart, and pay with PayPal (PayPal account, card or Venmo).
Hey Hue manages the items for you.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The shop page (10 items per page, search, categories) |
| `item.html` | The page for one item |
| `thanks.html` | Where customers land after paying |
| `customize.html` | **Your design page** — colors, background, titles, all the wording |
| `site.json` | Your settings (made by `customize.html`) |
| `products.json` | Your items (managed by Hey Hue) |
| `images/` | Item pictures and your background picture |
| `assets/` | The code that runs the store — no need to touch |

The 100 items in `products.json` are **samples**. Replace them with your own (see "Adding your items").

## 1. Put it online (one time, about 10 minutes)

1. Go to github.com and sign in as **mrwiggles136**.
2. Click **+** (top right) → **New repository**. Name it `store`, choose **Public**, click **Create repository**.
3. On the new repo page, click **uploading an existing file**. Drag in **everything inside this folder**
   (not the folder itself), then click **Commit changes**.
4. Go to the repo's **Settings → Pages**. Under "Branch" pick **main** and **/ (root)**, then **Save**.
5. After about a minute your store is live at **https://mrwiggles136.github.io/store/**

## 2. Turn on PayPal checkout

1. Go to **developer.paypal.com** and log in with your PayPal business account.
2. **Apps & Credentials** → switch the toggle at the top to **Live** → **Create App** (any name).
3. Copy the **Client ID**. (Never use the **Secret** anywhere in the store.)
4. Open `https://mrwiggles136.github.io/store/customize.html` → **Shop settings, shipping & PayPal** →
   paste it into **PayPal Client ID** → **Download site.json** → upload it to the repo (replace the old one).

Until a Client ID is set, the cart says "Checkout is being set up."

Want to test without real money first? Use the **Sandbox** Client ID from the same page and pay with a
sandbox test account, then switch to the Live ID.

## 3. Change the look and wording

Open **customize.html** on your live store (`…github.io/store/customize.html`). Pick colors (or a preset),
a background picture, fonts, the store name, and every word on the site — the preview updates as you type.
Click **Download site.json**, put it in your store folder in place of the old one, and publish
(`publish store` in Hey Hue, or upload it on GitHub).

For a background picture: put it in `images/` (e.g. `images/bg.jpg`) and type `images/bg.jpg` in the
"Background picture" box.

## 4. Connect Hey Hue (so it can add and edit items)

Hey Hue edits a copy of the store on your Mac and pushes it to GitHub.

1. Install **GitHub Desktop** (desktop.github.com) and sign in.
2. **File → Clone repository** → pick `store` → clone it to your **Desktop**.
3. In Hey Hue's `credentials.env`, add this line (with your Mac username):
   ```
   GITHUB_STORE_DIR=/Users/o/Desktop/store
   ```
4. Put `github_store.py` (and the updated `hey_hue.py`) in Hey Hue's folder and restart Hey Hue.
5. Type `stores` — it should say **site (your GitHub store): configured**.

## Adding your items

In Hey Hue:

```
add product site 29.99 hard trap beat, 140 BPM, dark piano
set image site <id> ~/Desktop/cover.jpg
list products site
publish store
```

Other commands: `set price site <id> 25`, `set stock site <id> 4`, `set category site <id> Beats`,
`set type site <id> digital`, `hide site <id>`, `show site <id>`, `remove product site <id>`.

To clear out the 100 samples at once: open `products.json` in TextEdit, replace everything with
`{"products": []}`, save, then add your own items.

## Orders, digital delivery and safety

- **Orders show up in PayPal** (paypal.com → Activity) with the items, the buyer's email and the
  shipping address for physical items. You get an email for each one.
- **Digital items:** the store is a static site, so it can't hide download links safely. Email the
  file to the buyer's PayPal email (the thank-you text tells them to expect that). Or let me know
  and we can add automatic delivery later with a small service.
- **Always check the amount in PayPal before you ship or send a file.** Prices are checked in the
  customer's browser, and someone tech-savvy could change them. If an order total looks wrong,
  refund it.
- Physical stock doesn't count down automatically when something sells — update it with
  `set stock site <id> <number>` and `publish store`.

## Testing on your Mac before publishing

The store needs a web server (double-clicking `index.html` won't load the items). In Terminal:

```
cd ~/Desktop/store
python3 -m http.server 8000
```

Then open http://localhost:8000 (and http://localhost:8000/customize.html). Press Ctrl+C to stop.
