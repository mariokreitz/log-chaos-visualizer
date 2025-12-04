# LogChaosVisualizer

A small demo Angular application to visualize synthetic log files and explore different log formats and distributions.

This repository contains a single-page Angular app that was created for the mini hackathon 3.0 by Kevin Chromik. It is a
demo project and is not intended for production use.

Quick links

- Project: log-chaos-visualizer
- Author / Hackathon: Kevin Chromik (mini hackathon 3.0)
- Demo / Not for production: This project is a demo only — do not use it in production.

What it does

- Visualizes log files (Pino, Winston, Loki/Promtail, Docker JSON, and plain text).
- Provides charts and tables to explore log levels, kinds, and timelines.
- Supports loading large sample logs (20k — 200k lines) located in `public/data`.
- Comes with a Python helper (`generate_logs.py`) to generate synthetic logs for testing.

Prerequisites

- Node.js (recommended: a recent LTS; the project uses npm@11.6.1 via `packageManager` in package.json)
- npm (comes with Node.js)
- Python 3 (for the log generator script) if you want to generate sample logs
- Docker & Docker Compose (optional, to run the app inside a container)

Repository layout (high-level)

- src/ — Angular application source
- public/data/ — pre-generated example log files (generated-20k/50k/100k/200k)
- generate_logs.py — script to create synthetic log files
- Dockerfile, compose.yaml — container images and compose setup for running the built app behind nginx

Quick development run

1. Install dependencies

```bash
npm ci
```

2. Start development server (live-reload)

```bash
npm start
# or
ng serve
```

Open http://localhost:4200/ in your browser.

Build for production

```bash
npm run build
# The built files are placed into dist/log-chaos-visualizer/browser
```

Run in Docker (build + run)

Note: `compose.yaml` references an external Docker network named `webproxy`. If you do not have this network locally,
either create it or remove/adjust the network section in `compose.yaml` before using Docker Compose locally.

Build the image locally with Docker (example):

```bash
# build image (uses the Dockerfile and sets default BASE_HREF to '/')
docker build -t log-chaos-visualizer:local .

# run container exposing port 80 (adjust as needed)
docker run --rm -p 8080:80 log-chaos-visualizer:local
```

Using Docker Compose (may require an existing `webproxy` network):

```bash
docker compose up --build
```

If Compose fails because the external network `webproxy` doesn't exist, create it or remove the network stanza in
`compose.yaml` for local testing:

```bash
# create the external network expected by compose.yaml
docker network create webproxy
```

Log generation

This project includes `generate_logs.py`, a Python 3 script that produces synthetic logs in several formats. The
package.json exposes convenient npm scripts to create sample files:

Available npm scripts (log generation)

- npm run gen:logs:20k — generate 20k lines -> public/data/generated-20000.log
- npm run gen:logs:50k — generate 50k lines -> public/data/generated-50000.log
- npm run gen:logs:100k — generate 100k lines -> public/data/generated-100000.log
- npm run gen:logs:200k — generate 200k lines -> public/data/generated-200000.log
- npm run gen:logs:all — run all of the above sequentially

Manually using the generator:

```bash
# generate 50k mixed logs
python3 generate_logs.py --lines 50000 --output public/data/generated-50000.log

# specify a mix of formats and a reproducible seed
python3 generate_logs.py --lines 20000 --output public/data/generated-20000.log --mix pino,winston,text --seed 42
```

Notes and caveats

- The app was developed as a hackathon demo and lacks production hardening (security, authentication, rate limiting,
  rigorous tests, etc.).
- `compose.yaml` expects an external Docker network `webproxy`; adapt it for your environment.
- The project is private in package.json. There is no LICENSE file included — add a license if you plan to publish.

Contact / Author

- Kevin Chromik (author of the hackathon demo)

Acknowledgements

- Built with Angular and ng2-charts / Chart.js

Disclaimer (important)
This repository was created as a demo for the mini hackathon 3.0 by Kevin Chromik. It is provided "as-is" for
demonstration purposes only and is not intended for production use.
