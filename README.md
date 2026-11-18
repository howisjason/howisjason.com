# howisjason.com

Jason Tang's page. GitHub Pages serves this repo's `main` branch at https://howisjason.com
(the `CNAME` file names the domain; DNS lives at Porkbun, whose MX and TXT records carry his
email forwarding: never touch them).

Everything in this repo is public. Nothing private belongs here.

## What is live (since 10 Nov 2026)

- `index.html`: the offer page. One offer up front (past customers, back and paying again in
  30 days, free setup, paid only from a share of what returning customers spend), with the
  other two of the three ways to make more money (more customers, higher prices) below it.
- `book.html`: the free setup call, with his Cal.com calendar (cal.com/howisjason/setup) inside.
- `privacy.html`: what the booking form and the visit counter collect, and the picture credits.
- `hi/index.html` (https://howisjason.com/hi/, since 18 Nov 2026): the small page for people he meets in
  person, one screen with his photo, his name, a WhatsApp button, an Instagram button and a link to
  the main page. The QR code on his phone's lock screen leads here as `/hi/?ref=qr`, so never move or
  rename it. It is built from its own copy of the Sky kit in `hi/kit/` (the kit's home is
  `Projects/design-kit/sky/`), not from `css/`.
- `css/base.css` and `css/look.css`: the look (the S2F3 sky look); `img/` and `video/`: the
  pictures and the walkthrough video. Credits for added pictures: `img/SOURCES.md`.

Visits are counted by GoatCounter (howisjason.goatcounter.com); each friend's ask link adds
`?ref=name`, and the counter records it.

## How to change it

Edit the page files here directly: `index.html`, `book.html`, `privacy.html`, `css/base.css` and
`css/look.css`. Check the page in a browser, commit, push: live within a minute or two.

**Never run `drafts/look-full/build.py` or `publish.py`.** They rebuild the three pages from the
drafts in `drafts/` (git ignores that folder, so it lives only on Jason's Mac), and the drafts
stopped at 10 Nov 2026. Everything changed here since then exists only in these page files: the
car shop in the five steps, the name The Free 30-Day Winback and the 42% figure (17 Nov 2026), and
the Ribbon (18 Nov 2026). A rebuild writes the 10 Nov page over all of it. `publish.py` refuses
to run for that reason.

## Left from the old page

`kit/` (the old Moon Gate look) and `bot/` (the "Quick questions" chat box and its
`jason-bot` Cloudflare Worker) belong to the page that was live until 10 Nov 2026; the new
pages use neither. The worker is switched off (J's word, 10 Nov 2026): `workers_dev = false`
in `bot/worker/wrangler.toml`, so it has no public address. Its code, key and ledger are kept
on purpose, to reuse for a future chatbot build; the toml says how to switch it back on.
