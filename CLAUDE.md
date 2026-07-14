# Flock Off (working name) — Anti-ALPR Advocacy & Organizing Site

Client project folder: `Client Details/DeFlock Bexar/` inside the
`ainightshiftsatx-website` repo. This is a standalone static site project,
independent of the parent repo's Cloudflare Pages/Workers site (root
`CLAUDE.md` governs that site only — do not conflate the two).

## Mission

Build a world-class advocacy website and grassroots organizing engine whose
goal is to remove Flock Safety ALPR cameras from communities — starting in
Bexar County, TX, expanding across Texas, then nationally — and to end
domestic mass surveillance. "Flock Off" is a working name; branding lives in
one config file so it can be renamed later without a global find/replace.

═══════════════════════════════════════════════
## ARCHITECTURE (decided — do not relitigate)
═══════════════════════════════════════════════
- Static-first site: Astro (or plain Vite if justified), deployed to
  Cloudflare Pages or GitHub Pages. No backend server, no database, no
  accounts.
- All case/legal data lives in versioned JSON files in `/data`, validated by
  JSON Schema in CI. Volunteers contribute via pull requests.
- Interactive map: Leaflet + OpenStreetMap tiles + marker clustering
  (Leaflet.markercluster). Must handle 100k+ points via clustering and
  viewport-based loading without jank.
- Camera locations: DO NOT invent camera coordinates. The only legitimate
  dataset is crowdsourced OpenStreetMap data (nodes tagged
  `man_made=surveillance` + `surveillance:type=ALPR`), the same source
  DeFlock.me uses via the Overpass API. Build a GitHub Action that runs
  weekly: Overpass query → GeoJSON extracts (bexar.geojson, texas.geojson,
  national summary/clustered tiles) → commit. Attribute OpenStreetMap
  contributors (ODbL) and credit/link DeFlock.me visibly on the map page.
- Email capture: embed a form service (Buttondown, Action Network, or
  similar — put the provider behind one component so it can be swapped). No
  PII stored in the repo.

═══════════════════════════════════════════════
## NON-NEGOTIABLE DATA INTEGRITY RULES
═══════════════════════════════════════════════
This site's only asset is credibility. One fabricated case and the whole
project is dead on arrival — and possibly defamatory.

1. NEVER fabricate, embellish, or "fill in" an abuse case, court holding,
   quote, date, or camera location. Every abuse-case entry requires at least
   one primary source URL (court filing, government record, audit log, or
   reporting from a named outlet). No source, no entry.
2. When naming officers, agencies, or officials, state only what the cited
   source states, with attribution ("according to a 404 Media
   investigation…", "per the court filing…"). Use "alleged" for anything not
   adjudicated.
3. Legal summaries must be accurate about what a case actually held.
   Specifically: *Chatrie v. United States*, 609 U.S. ___ (No. 25-112,
   decided June 29, 2026, 6–3, Kagan) held that police acquisition of
   geofence location data from Google is a Fourth Amendment SEARCH; the
   Court vacated and remanded to the Fourth Circuit on warrant
   particularity/probable cause. It did NOT rule on ALPRs or Flock. Frame it
   as the doctrinal foundation the ALPR challenges are now building on — not
   as a ruling against Flock.
4. Research every seeded item below with web search before publishing;
   verify status, dates, and outcomes as of the build date. Cases evolve —
   check for the latest docket activity.

═══════════════════════════════════════════════
## CORE FEATURES
═══════════════════════════════════════════════

1. **Abuse counter (homepage hero)**
   - Large animated count-up ticker: "Documented cases of Flock camera abuse
     and warrantless surveillance." The number is DERIVED at build time from
     `data/abuse-cases/*.json` — never hardcoded. Show "last updated" date
     and link to the full database and methodology page (what counts as a
     case, how entries are sourced, how to submit one).
   - Secondary counters, also data-derived: cities that have canceled or
     rejected Flock contracts; pending lawsuits.

2. **Interactive camera map**
   - Three zoom presets: Bexar County / Texas / National.
   - Every camera pin clickable → popup with location, OSM metadata,
     operator if tagged.
   - Distinct "abuse incident" pins layered on top: where an abuse case has
     a known geography (agency jurisdiction or specific cameras), pin it
     with a different marker. Click-down reveals: who abused access, what
     they did, what data was queried, outcome, and source links.
   - Layer toggles: cameras / abuse incidents / cities that canceled Flock.
   - ODbL attribution + DeFlock credit + "report a camera" link that teaches
     users how to add ALPRs to OpenStreetMap (this grows our own dataset).

3. **Legal tracker**
   - Filterable case library from `data/legal-cases/*.json`: court, status,
     issue (geofence, ALPR, data-sharing, First Amendment), plain-English
     "why it matters," and links to opinions/filings/dockets.
   - A "state of the law" explainer page anchored on Chatrie and the
     third-party-doctrine shift, written for non-lawyers, with a prominent
     "this is not legal advice" disclaimer.

4. **Abuse database**
   - `data/abuse-cases/*.json` rendered as a searchable, sortable table +
     detail pages. Schema (enforce in CI):
     ```
     { id, title, date, location {city, county, state, lat?, lng?},
       agency, actor (as reported), category (stalking | immigration |
       reproductive | protest/1A | data-sharing | warrantless-dragnet |
       other), summary, outcome, sources [{url, outlet, date}], verified:
       bool, addedBy, addedDate }
     ```
   - A "submit a case" page: GitHub PR instructions + a plain web form (form
     service) for non-technical submitters, with an explicit note that
     submissions are verified before publication.

5. **Organizing action kit**
   - "Act in your city" flow: pick a municipality (seed all Bexar County
     municipalities: San Antonio, Live Oak, Converse, Cibolo, Universal
     City, Schertz, Leon Valley, Alamo Heights, Balcones Heights, Windcrest,
     Kirby, etc.) → shows that city's Flock status, council meeting schedule
     link, public-comment signup process, and a tailored one-page brief.
   - Templates: public-comment scripts (60/90/180-second versions), letters
     to council members, Texas Public Information Act request templates for
     Flock contracts + audit logs (the audit logs are how abuse gets
     found), op-ed skeleton, social share cards.
   - "Wins" page: every city that canceled or rejected Flock, with dates and
     sources — proof this works.
   - Email list signup on every page footer + a dedicated `/join` page with
     county/city segmentation fields.

═══════════════════════════════════════════════
## SEED DATA (verify each with web search before publishing; expand the list)
═══════════════════════════════════════════════
**Legal:** Chatrie v. United States (SCOTUS, decided 6/29/2026, remanded to
4th Cir.); Schmidt v. City of Norfolk (Institute for Justice ALPR
challenge); ACLU + EFF v. San Jose (Nov 2025 — ~3.97M warrantless ALPR
searches in one year); California AG Bonta v. City of El Cajon (Oct 2025,
illegal out-of-state data sharing); Gibbs Mura class action v. Flock Safety
(amended complaint Apr 2026, CA privacy law); Boulder residents v. City of
Boulder (filed 5/28/2026).

**Abuse cases:** Johnson County TX sheriff's nationwide search of ~83,000
cameras to track a woman over a suspected self-managed abortion (404
Media); Kechi, KS police chief using Flock to stalk his ex (404 Media,
2025); federal immigration authorities gaining ALPR data via local-agency
side-door searches (404 Media / EFF, Illinois and elsewhere); Shaker
Heights OH — ~693,000 of ~700,000 database searches made by outside
agencies; protester tracking and discriminatory search patterns documented
by EFF (2025 year-in-review).

**Wins:** San Marcos TX (canceled Dec 2025, cameras removed Feb 2026),
Evanston, Flagstaff, Cambridge, Watertown, Coralville, Greenfield. Find
more.

**Bexar-area context:** Bexar County has an official Flock program page;
Live Oak (23 cameras, expanding), Converse, Cibolo deployed; KSAT and SA
Report have covered the expansion. Research current counts per city.

═══════════════════════════════════════════════
## DESIGN DIRECTION
═══════════════════════════════════════════════
World-class means restrained, fast, and trustworthy — closer to ProPublica
or EFF than to a campaign splash page. Dark, serious palette with one hot
accent for CTAs and the counter. Strong typographic hierarchy, real
information design on the map and tables. Mobile-first: organizers share
links at council meetings from phones. Lighthouse ≥ 95 on all categories.
WCAG 2.1 AA. Semantic HTML, OpenGraph cards for every page (share cards are
an organizing weapon). Nonpartisan tone throughout — this coalition spans
left and right; write copy that a progressive and a libertarian can both
forward.

═══════════════════════════════════════════════
## PROCESS
═══════════════════════════════════════════════
1. Write this CLAUDE.md. 2. Plan mode → get approval. 3. Scaffold + data
schemas + CI validation first. 4. Then map, counter, legal tracker, abuse
DB, action kit — in that order, one PR-sized commit per feature, tested.
5. Research pass: verify all seed data with citations before it enters
`/data`. 6. Final pass: accessibility audit, Lighthouse, link check, and a
data-integrity check that every abuse case has ≥1 working source URL.

**Ask before:** choosing the email/form provider, buying anything, or
publishing anything with a named individual in it.
