# Pinball Practice App: Project Plan v2

Oct 21, 2026 · @Tau

## Summary and goals

Build a pinball practice app whose main job is to be strong, explainable portfolio work, shipped to real players so it could grow into a product later. Every piece of scope must either demonstrate a hireable skill or make the app genuinely usable at a venue; anything that does neither is cut.

**Primary goal (career).** Add React Native, TypeScript and applied AI to existing backend, cloud and full-stack strengths, with a project that has real users, measured results and defensible design decisions.

**Secondary goal (product).** Make in-venue practice logging fast enough that players actually do it, then turn that data into useful advice. Revenue is upside, not a requirement; plan for $0.

**Success looks like:**

- The app is on TestFlight and Android internal testing, used by at least 20 league or tournament players.
- Logging a ball takes one or two taps, or one spoken sentence.
- Score recognition accuracy is measured on a labeled photo set and reported as a number.
- Each milestone ships on its own, so the project is complete and explainable at any stopping point.

## Target user and positioning

The target user is a league or tournament player who practices on location machines and wants to know why they drain, not just what they scored. The wedge is the fastest in-venue logging available (photo and voice) plus drain-reason insights; a game encyclopedia is not the wedge.

| Existing option | What it does well | Gap this app targets |
| --- | --- | --- |
| [PinProf](https://appshunter.io/ios/app/pinprof/id6758810754) | OPDB game library, rulesheets, score logging, goal packs, a score scanner, cloud sync beta | Ball-level drain tracking, voice logging, insights grounded in the player's own data |
| [Pindigo](https://apps.apple.com/app/id1027062831) | Social high scores with photo proof, location tags, leaderboards | Practice analysis rather than score sharing |
| [Scorbit](https://scorbit.io/faq) and Stern's connected platform | Automatic score capture on connected machines | Works on any machine with no hardware, and records why each ball ended |

Open question: after using PinProf at a real practice session, can the differentiator be stated in one sentence? If not, revisit the wedge before Milestone 2.

## Scope

Scope is cut to what either shows a skill or makes logging usable; the content library and pricing work are gone.

**In:**

- Game search backed by [OPDB](https://opdb.org/about), with links out to existing rulesheets and videos.
- Session and ball logging: cumulative score entry, one-tap drain reasons, tilt and extra-ball handling, notes.
- Offline-first storage on the device, with sync to the backend.
- Session history and charts built on medians and percentiles, not averages.
- AI features: photo score capture, voice logging, coach summaries, note tagging.
- Accounts, backup and an IFPA profile link (rank shown on the profile).
- Automated tests, CI/CD, logging and monitoring.

**Cut, and why:**

- **Written guides, community submissions and moderation.** A content business in disguise, with licensing risk and little resume value.
- **Practice versus tournament comparisons.** IFPA data is rankings and finishing positions, not machine scores, so the comparison would be noise.
- **Pricing research.** Revisit only if usage holds; a premium coach tier is the likeliest option.
- **Social features, tournament management, hardware score capture.** Others already do these well.

## Architecture

The phone keeps working with no signal, and the API is the only component that talks to third parties, so keys, AI costs and outside data are controlled in one place.

```
MOBILE APP (React Native)      ASP.NET CORE API (AWS)       EXTERNAL SERVICES
On-device OCR                  Catalog + IFPA  ---------->  OPDB + IFPA APIs
      v
Logging UI  ------------------> AI gateway  ------------->  LLM + speech APIs
      v                              v
SQLite store (source of truth)  Stats engine  ----------->  PostgreSQL
      v                                                       ^
Sync engine  -----------------> Sessions + sync  -----------+
```

Logging writes straight to SQLite on the device; the sync engine pushes new records to the API when a connection returns. Photo fallback and voice parsing queue until the phone is online.

- **Mobile app (React Native + TypeScript):** logging UI, on-device OCR, SQLite store and sync engine.
- **ASP.NET Core API (C#):** a modular monolith with four modules (sessions and sync, stats, AI gateway, catalog and IFPA) in one deployable, with module boundaries enforced in code.
- **PostgreSQL:** the server copy of user data, and the input for stats and coach summaries.
- **External services:** OPDB for the game catalog, IFPA for rankings, LLM and speech providers for photo fallback, voice parsing and summaries.
- **Delivery:** AWS hosting, CI/CD on every push, structured logging and monitoring, including AI cost per call.

## Data model

Scores are only comparable when the machine, its code version and its settings match, so machine identity is modeled in four levels and every session records all of them.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Title group | OPDB group ID, name | e.g. Godzilla; from OPDB |
| Edition | OPDB machine ID, Pro / Premium / LE | From OPDB; aliases handled through OPDB alias IDs |
| Machine instance | ID, edition, location name, settings (balls per game, ball save, tilt) | A specific physical machine the player practices on |
| Session | ID, user, machine instance, code version, started at, source (manual, photo, voice) | Practice only; competitive results live elsewhere |
| Game | ID, session, player count, final score | One session holds several games |
| Ball | ID, game, ball number, cumulative score, delta, drain reason, extra ball flag, tilt flag | The core record for analytics |
| Note | ID, game or ball, text, AI tags (shot, issue) | Tags feed mistake-pattern charts |

**Sync design.** Practice data has one writer per user, which makes sync far simpler than the general case:

- The device is the source of truth; every record gets a client-generated UUID.
- Sessions, games and balls are append-only; edits are rare and use last-write-wins with an updated-at timestamp.
- The app pushes unsynced records when it has a connection and pulls changes made on other devices since a cursor.
- OPDB data is cached on the device so game search works offline.

## AI features

AI is used only where it removes logging effort or turns the player's own stats into advice; it never writes rules or invents numbers.

| Feature | How it works | Guardrail | What it proves |
| --- | --- | --- | --- |
| Photo score capture | On-device text recognition (Apple Vision, Google ML Kit) first; a vision LLM through the API for hard cases (DMD fonts, animated LCDs, glare, multiplayer) | User confirms the number before saving | On-device ML, model fallback, accuracy measured on a labeled set |
| Voice logging | Speech-to-text, then structured extraction into a ball record ("ball two, left outlane, 340 million") | Strict schema; anything ambiguous asks for a tap | Structured extraction under tight time limits |
| Coach summary | Backend computes stats deterministically; the model only writes the narrative and suggests a practice focus | Model receives computed stats only and must not state any number not in them | Grounded generation, cost control |
| Note tagging | Free-text notes tagged with shot and issue ("left ramp, timing") | Tags are editable suggestions | Classification feeding analytics |

**Evaluation.** Build a labeled set of real display photos across many machines, track accuracy and latency per model or prompt change, and track cost per coach summary. These numbers are the most valuable portfolio material in the project.

**Out of scope:** AI-written strategy guides, a rules chatbot, and video analysis of flipper technique.

## Roadmap

Work runs in short sprints, with the Phase 0 research done alongside Milestone 1 rather than before it. Each milestone is shippable on its own; if work stops after Milestone 2, the project is still complete and explainable.

1. **Milestone 1: vertical slice, with Phase 0 running alongside.** OPDB game search, session and ball logging, drain chips, history, median charts. .NET API, Postgres, offline SQLite with sync, tests and CI from day one.
   - Sprint 1: schema, API contracts, both repos with `CLAUDE.md`, the commit hook and CI; OPDB game search.
   - Sprint 2: session and ball logging with drain chips, stored offline in SQLite.
   - Sprint 3: sync, session history, median charts; first TestFlight and Android internal build.
   - Alongside: a PinProf practice session, league night conversations, display photo collection, API keys for OPDB, IFPA and Match Play. Findings feed the next sprint.
   - Keep the logging screen behind a thin boundary so tester feedback can reshape it without touching storage or sync.
   - Exit: 5 testers log real sessions, and the differentiator fits in one sentence.
2. **Milestone 2: photo score capture.** On-device OCR, LLM fallback through the API, labeled evaluation set and accuracy dashboard.
   - Exit: accuracy measured and published in the README.
3. **Milestone 3: voice logging.** Speech-to-text and structured extraction into ball records.
   - Exit: a full game logged by voice without touching the screen between balls.
4. **Milestone 4: insights.** Coach summaries, note tagging, IFPA and LOOP profile links.
   - Exit: 20 active testers; decide whether a premium coach tier is worth pursuing.

Timeline is re-estimated at the end of each sprint rather than up front; the original 11 to 22 week range was too wide to plan against.

## Portfolio outputs

The strongest signals are real users, measured numbers and design tradeoffs you can defend; the repo and README exist to make those easy to verify.

**Deliverables:**

- README with the problem, architecture diagram, key decisions, accuracy results and a short demo video.
- Database schema diagram and generated API documentation.
- A decision log, written as you build: why on-device OCR first, why append-only sync, why OPDB, why links instead of guides.
- Test coverage and a CI/CD pipeline visible in the repo.
- App store or TestFlight presence with tester feedback summarized.

Every decision with real alternatives goes in `docs/decisions.md` on the day it is made, newest first.

**Target resume bullets** (numbers filled in as they are measured):

- Built an offline-first React Native and TypeScript app with a C# / ASP.NET Core API and Postgres, using append-only sync for unreliable venue connectivity.
- Shipped photo score capture combining on-device OCR with an LLM fallback; raised recognition accuracy from \[X\]% to \[Y\]% across \[N\] machines on a labeled evaluation set.
- Implemented voice logging that turns spoken ball results into structured records in under \[N\] seconds.
- Designed grounded AI coaching summaries generated from computed statistics, at \[cost\] per summary.
- Shipped to \[N\] league and tournament players and iterated on their feedback.

## Risks and open decisions

The biggest risk is that logging stays too slow and players fall back to recording only final scores, which would hollow out every ball-level feature.

| Risk | Mitigation |
| --- | --- |
| Logging too slow at the machine | Prototype it in Phase 0; photo and voice capture; "fill in later" from a final-display photo |
| No clear differentiator from PinProf | Phase 0 exit requires a one-sentence answer |
| Three ecosystems for one part-time developer | Strict milestone scope; each milestone ships on its own |
| OCR fails on some display types | Evaluation set per display type; LLM fallback; manual confirm |
| LLM costs grow with users | All calls through the API with per-user rate limits; summaries generated on request, not automatically |
| IFPA API access changes | Read-only, cached, and limited to a profile link, so losing it removes little; the [API](https://www.ifpapinball.com/api/documentation/) asks callers to go easy on a small server |

**Open decisions:**

- [ ] Navigation, charting and state-management libraries
- [ ] Authentication provider
- [ ] Hosting setup on AWS (container service and managed Postgres)
- [ ] LLM provider and model for the fallback and summaries
- [ ] Speech-to-text: on-device or server-side

## Immediate next steps

- [ ] Download PinProf and use it for one full practice session
- [ ] Attend a league night; talk to 8 to 10 players about how they practice
- [ ] Paper-prototype the between-ball logging flow and time it
- [ ] Start the labeled display photo set (aim for 50 to begin)
- [ ] Request OPDB and IFPA API keys
- [ ] Draft the Milestone 1 screens and the database schema
- [ ] Create both repos with CI running on the first commit

## Backlog

Ideas worth building, not yet scheduled into a milestone.

- **App shell: tab bar and headers** (requested 2026-10-22). Once there's more than the Practice screen, add bottom tabs (likely Practice, Machines, Stats, Profile) with Expo Router's tab layout, a consistent screen header, and arcade styling on the tab bar. The art-header screens (session, machine, stats) keep their transparent headers on top of the tab stack.
- **Location from GPS** (requested 2026-10-22). When setting up a machine, suggest the venue the player is standing in instead of typing it. Candidate source: Pinball Map's public API, which lists venues with coordinates and the machines at each, so it could also pre-select the machine. Needs location permission (asked only on the setup screen) and a decision on whether venues become a table of their own rather than the current free-text `location_name`.

## Sources

- [PinProf listing](https://appshunter.io/ios/app/pinprof/id6758810754)
- [Pindigo on the App Store](https://apps.apple.com/app/id1027062831)
- [Scorbit FAQ](https://scorbit.io/faq)
- [About OPDB](https://opdb.org/about) and [OPDB API docs](https://opdb.org/api)
- [IFPA API documentation](https://www.ifpapinball.com/api/documentation/)
