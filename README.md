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
- `css/base.css` and `css/look.css`: the look (the S2F3 sky look); `img/` and `video/`: the
  pictures and the walkthrough video. Credits for added pictures: `img/SOURCES.md`.

Visits are counted by GoatCounter (howisjason.goatcounter.com); each friend's ask link adds
`?ref=name`, and the counter records it.

## How to change it

The three pages are built, never edited here by hand. Their source is in `drafts/`, which git
ignores (it holds working notes), so it lives only on Jason's Mac:
draft 4 (`drafts/picks/index.html`) holds the words, `drafts/book/` and `drafts/privacy/` the
two other pages, `drafts/look-full/s2f3/` the look. From this folder:

    python3 -I drafts/look-full/build.py && python3 -I drafts/look-full/publish.py

`build.py` builds the drafts; `publish.py` copies them here, strips every comment (the drafts'
comments quote his working sessions), and fixes the picture paths. Check, commit, push: live
within a minute or two.

## Left from the old page

`kit/` (the old Moon Gate look) and `bot/` (the "Quick questions" chat box and its
`jason-bot` Cloudflare Worker) belong to the page that was live until 10 Nov 2026; the new
pages use neither.
