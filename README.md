# Conference Events Platform

Static multi-event conference/events platform built with HTML, CSS, and vanilla JavaScript.

## Overview

The site is now JSON-driven for multiple events across states.

- Home (`index.html`) shows featured events and a state selector.
- `pages/state.html` lists events for the selected state.
- `pages/event.html` is an event gateway page.
- Existing pages (`agenda`, `speakers`, `vendors`, `announcements`) are event-aware.

## Routing and Context

Event context is carried via query params and local storage:

- `state`: two-letter state code (example: `CA`)
- `event`: event id (example: `ca-global-summit-2026`)

Examples:

- `pages/state.html?state=CA`
- `pages/event.html?state=CA&event=ca-global-summit-2026`
- `pages/agenda.html?state=CA&event=ca-global-summit-2026`

## Data Model

Primary data file:

- `data/events.json`

Top-level shape:

```json
{
	"events": [
		{
			"id": "string",
			"name": "string",
			"state": "CA",
			"city": "string",
			"venue": "string",
			"dateRange": "string",
			"featured": true,
			"description": "string",
			"speakers": [
				{ "name": "string", "bio": "string" }
			],
			"sessions": [
				{
					"id": "string",
					"title": "string",
					"time": "string",
					"day": "string",
					"track": "string",
					"room": "string",
					"speaker": "string"
				}
			],
			"vendors": [
				{
					"id": "string",
					"name": "string",
					"booth": "string",
					"categories": ["string"],
					"deal": "string",
					"email": "string"
				}
			],
			"announcements": [
				{
					"id": "string",
					"date": "YYYY-MM-DD",
					"title": "string",
					"body": "string",
					"urgent": false
				}
			]
		}
	]
}
```

## JavaScript Modules

Shared core modules:

- `js/shared/basePath.js`: GitHub Pages-safe URL/path resolution helpers.
- `js/shared/dataLoader.js`: event catalog loading and selectors.
- `js/shared/eventContext.js`: read/write event context and build context-aware links.

Page modules:

- `js/home.js`: featured events + state selector on home.
- `js/state.js`: state event listing behavior.
- `js/event-gateway.js`: selected event overview and deep links.
- `js/speakers/speakers.js`: event-aware speaker rendering.
- `js/announcements/announcements.js`: event-aware announcements rendering.
- Existing agenda/vendors modules remain and now load from selected event context.

## Local Usage

Because this site fetches JSON, run it with a local static server (instead of opening files directly).

Options:

- VS Code Live Server
- Python: `python -m http.server 8000`

Then open `http://localhost:8000/`.

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript (ES modules)
- JSON data files