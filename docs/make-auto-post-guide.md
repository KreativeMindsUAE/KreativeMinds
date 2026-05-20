# Make.com auto-posting guide (blog + social cards)

This connects the two GitHub pipelines to Facebook, Instagram, and LinkedIn.
The pipelines publish two public RSS feeds; Make watches them and posts new items.

- Blog feed: `https://kreativeminds.ae/blog/feed.xml`
- Social cards feed: `https://kreativeminds.ae/social/feed.xml`

Make free tier = **2 active scenarios** (exactly one per feed) and runs every 15 minutes,
which is plenty for 5 posts/week. "Watch RSS feed items" remembers what it already
posted, so there is no duplicate posting and no data store needed.

---

## One-time setup

1. Create a free account at make.com.
2. Add three connections (you only do this once, Make then refreshes tokens):
   - **Facebook Pages** (authorize your KM page).
   - **Instagram for Business** (the IG Business account must be linked to that FB Page).
   - **LinkedIn** (authorize, with the KM Company Page as an admin).
3. Confirm the feeds load in a browser (they exist after the first blog/social run).

---

## Scenario A — Blog auto-share (link posts)

**Trigger:** RSS > *Watch RSS feed items*
- URL: `https://kreativeminds.ae/blog/feed.xml`
- Maximum number of returned items: `2`

**Module 2 — Facebook Pages > Create a Post**
- Page: KM page
- Message: `{{title}}` then a line break then `{{link}}`
  (Facebook auto-pulls the article's og:image from the link.)

**Module 3 — Instagram for Business > Create a Photo Post**
- Photo URL: `{{enclosure.url}}` (the article hero image)
- Caption: `{{title}}` + a short line + relevant hashtags + `Read more on our blog (link in bio).`
  (Instagram feed posts cannot have clickable links.)

**Module 4 — LinkedIn > Create a post (as Organization)**
- Author: KM Company Page
- Commentary: `{{title}}`
- Link/Article URL: `{{link}}` (LinkedIn pulls the og:image)

Turn the scenario ON. Scheduling: every 15 minutes.

---

## Scenario B — Social card posts (image posts)

**Trigger:** RSS > *Watch RSS feed items*
- URL: `https://kreativeminds.ae/social/feed.xml`
- Maximum number of returned items: `2`

**Module 2 — Facebook Pages > Create a Photo Post**
- Page: KM page
- Photo URL: `{{enclosure.url}}` (the branded card)
- Message: `{{description}}` (caption already includes the hashtags)

**Module 3 — Instagram for Business > Create a Photo Post**
- Photo URL: `{{enclosure.url}}`
- Caption: `{{description}}`

**Module 4 — LinkedIn > Create a post with an image (as Organization)**
- Author: KM Company Page
- Image: `{{enclosure.url}}`
- Commentary: `{{description}}`

Turn the scenario ON. Scheduling: every 15 minutes.

---

## Field mapping cheat-sheet (RSS item fields Make exposes)

| Need            | RSS field        |
|-----------------|------------------|
| Headline/title  | `title`          |
| Article URL     | `link`           |
| Caption/summary | `description`    |
| Image URL       | `enclosure.url`  |
| Unique id       | `guid`           |

## Tips
- First activation may grab the latest 1-2 items; that is normal. After that it only posts new ones.
- Instagram requires a public image URL. Both feeds provide one (the site serves `/blog/...` and `/social/...`).
- If a LinkedIn or IG module needs a specific account id, pick it from the dropdown Make shows after connecting.
- To test before relying on the cron: open the scenario, click "Run once" after at least one post exists in the feed.
- Keep both scenarios ON. That is your 2 free scenarios used well.
