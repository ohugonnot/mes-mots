# Mes mots (My words)

A picture-based communication app for a child who doesn't speak and can't read yet. They
touch a cell, the tablet says the word.

It works offline, installs from a link, and **nothing ever leaves the device**: no account,
no server, no data sent anywhere.

**[Try it in your browser](https://ohugonnot.github.io/mes-mots/)** · [Français](README.md)

The interface, the voices and the parent handbook are in French. Translating the interface is
a real possibility and a good first contribution: the strings live in the components, and the
vocabulary lives in a data file.

| | |
|:--|:--|
| <img src="docs/captures/a1-ecran-enfant.png" alt="The child's screen: a grid of cells, each with a picture and a word" width="380"> | <img src="docs/captures/i1-douleur.png" alt="The &quot;it hurts&quot; screen: one cell per body part" width="380"> |
| The child's screen. One cell, one word, one voice. | "It hurts", one cell per body part. |
| <img src="docs/captures/d1-editeur-entier.png" alt="The cell editor in the parent area" width="380"> | <img src="docs/captures/h1-feuille-papier.png" alt="A board laid out for printing" width="380"> |
| The parent area: what the child sees, what they hear. | The same board on paper, ready to print. |

The parent handbook, twenty-four illustrated chapters, is here:
**[docs/notice-famille.pdf](docs/notice-famille.pdf)** (French).

## What it does

A grid of cells, each with a picture and a word. One press, one voice. Below it, a few
worlds: home, outside, "it hurts". A bar of essential words that never moves.

The parent gets in through a long press in a corner, then an arithmetic question. That's
where they add a word, take a photo, record their own voice, rearrange cells, print the
boards on paper, back up and restore.

- **Family photos** replace the symbols when a face speaks better than a drawing.
- **The voices of people close to the child** are recorded cell by cell. A child recognises
  their mother's voice long before they recognise a word.
- **"It hurts"** shows one cell per body part, or two drawn bodies to touch, whichever the
  parent picks.
- **Boards print on paper**: a tablet breaks, paper doesn't.
- **Backups** are `.obz` files in [Open Board Format](https://www.openboardformat.org/),
  readable by other AAC apps.
- **A daily log** tells the parent what the child asked for, with the time, and clears at
  midnight. No statistics, no counting.

## What makes it different

Free and open AAC apps already exist, and good ones: CBoard (backed by UNICEF) and AsTeRICS
Grid (University of Applied Sciences Technikum Wien). Free is not the promise. This is.

**Nothing leaves the device.** No account to create, no server to talk to, no sync. The
words, photos and recorded voices stay in the tablet's browser storage. That's also the
trade-off: you back up yourself, and the app reminds you to.

**A cell never moves.** A child who can't read learns by where their finger goes. That
promise isn't an intention, it's held by tests, and a mutation bench checks that those tests
actually bite.

**It's small.** A grid, words, voices. No smart home, no YouTube, no dashboard. A family who
only wants a finger to make a word has nothing to wade through.

## What it doesn't do

Worth saying up front, because it decides whether this is for you.

No eye tracking and no switch access: it's used with a finger. No vocabulary of several
thousand words built by speech therapists over years, of the kind Proloquo2Go, TouchChat or
LAMP Words for Life carry. No grammar and no conjugation: you place words, you don't build
complex sentences. No sync across devices, by choice.

For scale, the apps that do all of that cost between $150 and $300 on iOS in 2026, and up to
£550 for Grid 3 on desktop. If your child needs what they do, they're worth it. This one is
for the other case: a simple grid, right now, with nothing paid up front.

## Install on a tablet

Open the link in Chrome or Edge, then "Install app" from the address bar or the menu. It then
opens like an app, with no browser chrome, and works in airplane mode.

On iPad, use Share, then "Add to Home Screen".

Once installed it never asks for the network again, except to update itself.

## Development

```bash
npm install --ignore-scripts
npm run dev          # http://localhost:5173
npm run build        # the real build, service worker included
npm run preview      # http://localhost:4173, the only one where installing can be tested
```

Vue 3 and TypeScript, with no UI library: the CSS is written by hand, component by component.
Data follows [Open Board Format](https://www.openboardformat.org/) and lives in IndexedDB.

### Tests

```bash
npm run typecheck
npx vitest run                 # pure logic
npx playwright test            # browser journeys
./mutation.sh                  # proof that the tests bite
```

The last one deserves a word. A green suite proves less than it looks: it proves nothing
broke, not that anything is checked. `mutation.sh` breaks the code on purpose, one pattern at
a time, and checks that a test turns red each time. A pattern that survives points at a
decorative test. That's what lets the claim above, that a cell never moves, be more than a
sentence.

## Symbols

The drawings come from **Mulberry Symbols** by Steve Lee, under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They are redistributed here
unchanged, only renamed after the French word of the cell they illustrate. Details in
[CREDITS.md](CREDITS.md).

Two symbols, the tick and the cross, were drawn for this app and follow its licence.

## Licence

Code under [AGPL-3.0](LICENSE). You may use, modify and redistribute it. If you host a
modified version, you must publish your changes.

Mulberry symbols keep their own CC BY-SA 4.0 licence, which does not extend to the code.

## A word of caution

This is not a medical device, and it is not a treatment. An alternative communication tool is
chosen and set up with a speech and language therapist, who knows the child and can say
whether a picture grid suits them, and which pictures.

This app was written for one child, from the needs one family described. It is published
because it may help elsewhere, not because it would suit everyone.

There is no guaranteed support, no promised roadmap, and no commitment to reply. Development
follows one family's needs and nothing else. Plenty of assistive-tech projects die of that
weight rather than of a lack of interest, so it is better said plainly than quietly hoped for.
Issues stay open, contributions are welcome, and the licence lets you take the project over if
I stop.
