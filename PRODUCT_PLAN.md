# AegisMap Product Plan

## Vision

AegisMap is a geospatial OSINT, situational awareness, and early warning platform.

Its purpose is to collect weak signals, correlate them across space and time, and surface emerging threats or abnormal patterns before they become fully confirmed incidents.

This is not a vigilante surveillance app.

It should be positioned as:

- crisis mapping
- threat monitoring
- early warning
- anomaly detection
- geospatial intelligence aggregation
- emergency coordination support

## Core Product Positioning

Recommended framing:

- Community Threat Intelligence Platform
- Geospatial OSINT and Early Warning Platform
- Incident Intelligence and Risk Monitoring Network

What the system should avoid becoming:

- a public accusation platform
- a doxxing tool
- a vigilante targeting app
- a system that presents AI guesses as confirmed truth

## Product Thesis

In many deployment environments, reliable security review personnel may not be available at scale.

Because of that, AegisMap should not depend on a central security-review workflow before information becomes useful.

Instead, the platform should operate as an intelligence fusion system:

`signal -> enrichment -> correlation -> confidence scoring -> pattern detection -> risk update -> alert`

The system should help users answer questions like:

- What unusual activity is emerging in this area?
- Which weak signals are likely related?
- Which corridors or zones are showing elevated risk?
- Which patterns resemble pre-incident buildup?
- Where should attention increase right now?

## Core Operating Model

The main unit of intelligence should be `Signal`, not `Incident`.

An incident may happen later, but the platform should be useful before that point.

Recommended lifecycle:

`Signal -> SignalCluster -> Pattern -> WatchZone -> Incident or Alert`

### Definitions

#### Signal

A raw observation, tip, report, anomaly, or machine-detected clue.

Examples:

- suspicious motorcycle movement at night
- unusual campfire in remote terrain
- fresh tracks on a bush route
- community tip about possible movement
- drone image showing temporary structure
- social chatter mentioning a blocked road
- smoke/fire in an unusual area

#### SignalCluster

A group of signals linked by geography, timing, type, route, or behavioral similarity.

Examples:

- three nighttime movement tips within 6 km
- repeated suspicious route use over 48 hours
- multiple clues around the same forest edge

#### Pattern

A meaningful interpreted behavior emerging from one or more clusters.

Examples:

- emerging movement corridor
- possible staging activity
- repeated route buildup
- escalating road threat pattern
- abnormal remote-area activity

#### WatchZone

A geographic zone under elevated observation because signals and patterns suggest growing concern.

Examples:

- elevated watch around a rural corridor
- monitored forest fringe zone
- protected route with increased abnormal activity

#### Incident

A higher-confidence operational event that has enough corroboration to be treated as a real occurrence.

Examples:

- confirmed road attack
- active abduction report
- repeated armed robbery event cluster
- verified fire outbreak

## How the System Works

### 1. Signal Intake

Signals enter the system from different channels:

- citizen reports
- NGO or civil society observers
- transport union contacts
- community coordinators
- journalists
- patrol operators
- drone uploads
- WhatsApp or SMS gateways
- public social posts
- environmental or road data feeds

Each signal may contain:

- text
- images
- video
- audio
- coordinates
- route description
- place name
- timestamp
- source metadata

### 2. Signal Structuring

The system converts messy raw input into structured intelligence data.

This stage should extract:

- event category
- location
- approximate time
- entities mentioned
- route references
- severity hints
- movement direction
- evidence type
- uncertainty markers

### 3. Confidence Scoring

Signals should receive a confidence score based on multiple factors, not a single moderator decision.

Inputs to confidence scoring:

- source trust history
- evidence quality
- proximity to related signals
- time consistency
- historical pattern consistency
- geospatial relevance
- corroboration from unrelated sources
- contradiction from later evidence

Example confidence labels:

- low-confidence signal
- partially corroborated
- multi-source corroborated
- high-confidence event
- disputed or degraded confidence

### 4. Correlation and Clustering

The system links weak signals together across:

- distance
- time window
- route or corridor
- event type
- repeated keywords
- movement behavior
- nearby environmental features

This is how the platform becomes useful before a full incident is proven.

### 5. Pattern Detection

Once clusters form, the system should infer emerging patterns such as:

- repeated night movement in remote areas
- movement toward isolated settlements
- route buildup along forest-highway edges
- abnormal temporary structure activity
- repeated signals near protected assets

### 6. WatchZone and Risk Updates

Patterns should raise or lower area-level risk over time.

Examples:

- baseline
- elevated watch
- medium risk
- high risk
- active alert state

Risk should be updated continuously based on:

- recent signal volume
- cluster intensity
- corroboration level
- severity type
- time-of-day weighting
- proximity to sensitive locations
- historical incident history

### 7. Alerts

Alerts should trigger when thresholds or rules are crossed.

Examples:

- 4 related signals detected within 5 km in 2 hours
- corridor risk increased from low to medium
- abnormal night movement pattern detected near protected route
- repeated suspicious activity near village perimeter

## Users and Roles

The product should support different trust and visibility levels.

### Community Reporter

Can:

- submit tips and reports
- attach media
- provide optional coordinates
- stay anonymous if allowed

Should not:

- see sensitive intelligence details
- see exact high-risk operational coordinates unless policy allows

### Trusted Verifier

Examples:

- NGO field staff
- journalists
- transport network observers
- health responders
- civic monitors

Can:

- confirm, dispute, or add context to signals
- increase corroboration without being security personnel

Trust and reputation should be handled as a reliability system, not a harsh punishment system.

Recommended rules:

- accurate reports and useful confirmations increase trust
- false or repeated abusive reports reduce trust gradually
- low-trust users can still contribute, but their reports carry less weight and may require more corroboration
- temporary cooldowns should be reserved for repeated abuse, not ordinary mistakes
- avoid immediate permanent bans for a single incorrect report

Example weighting:

- `+5 trust` for confirmed report
- `+2 trust` for useful verification
- `-10 trust` for false report
- `-20 trust` for repeated abuse

### Analyst / Operator

Can:

- review map layers
- inspect clusters and patterns
- manage watch zones
- configure alert thresholds
- review signal timelines

### Admin

Can:

- manage roles
- define source categories
- manage geofences
- view audits
- tune scoring rules

## Human Review Model

AegisMap should be human-assisted, but not human-blocked.

That means:

- the system can publish signals and patterns with explicit uncertainty
- human verification improves confidence
- no central security body is required for the product to operate

Recommended verification sources:

- trusted local civil society organizations
- transport unions
- field coordinators
- local media partners
- humanitarian responders
- vetted community monitors

## AI and Intelligence Functions

### Essential AI for MVP+1

- NLP classification for incoming reports
- location/entity extraction
- duplicate detection
- cluster detection
- anomaly detection
- confidence scoring
- risk scoring

### Advanced AI for Later Phases

- drone imagery analysis
- thermal anomaly interpretation
- satellite change detection
- route emergence detection
- predictive modeling for pre-incident patterns
- graph intelligence across people, places, and routes

## Recommended Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Mapbox GL

### Backend

- Django
- Django REST Framework
- PostgreSQL
- PostGIS

### Async / Processing

- Celery
- Redis

### Storage

- S3-compatible object storage for media

### Mobile Later

- React Native

## Why PostGIS Is Critical

This product depends on geospatial operations such as:

- radius search
- hotspot clustering
- route analysis
- polygon queries
- geofencing
- corridor detection
- proximity alerts
- temporal-spatial correlation

SQLite is not suitable as the long-term core database for this product.

## Core Domain Model

Recommended primary entities:

- `User`
- `SourceProfile`
- `Signal`
- `SignalEvidence`
- `SignalCluster`
- `Pattern`
- `WatchZone`
- `Incident`
- `RiskSnapshot`
- `Geofence`
- `Alert`
- `VerificationEvent`
- `PatrolUpload`

### Draft Relationship Direction

- A `SourceProfile` can create many `Signal` records.
- A `Signal` can have many evidence attachments.
- Many `Signal` records can belong to one `SignalCluster`.
- Many clusters can contribute to one `Pattern`.
- A `Pattern` can affect one or more `WatchZone` records.
- A `Pattern` or cluster may later produce an `Incident`.
- A `WatchZone` maintains rolling `RiskSnapshot` records.
- `Alert` records are created when thresholds are crossed.

## Suggested Confidence Model

Confidence should be compositional rather than manual-only.

Suggested scoring inputs:

- source reliability score
- evidence completeness score
- media presence score
- coordinate precision score
- corroboration score
- historical consistency score
- contradiction penalty
- recency score
- route or geofence relevance score

Suggested labels:

- `raw`
- `low confidence`
- `emerging`
- `corroborated`
- `high confidence`
- `disputed`

## Suggested Risk Model

Risk should exist at area level, not just record level.

Inputs:

- number of recent signals
- severity-weighted signal mix
- cluster density
- corroboration level
- known historical baseline
- proximity to forests, roads, settlements, schools, pipelines, or other protected assets
- time window patterns

Outputs:

- `baseline`
- `elevated watch`
- `medium risk`
- `high risk`
- `critical alert`

## Safety and Ethics Rules

These rules should be built into the product design:

- never publicly accuse individuals
- never expose exact suspected locations to all users
- clearly distinguish signal from incident
- clearly show confidence and uncertainty
- protect anonymous reporters where needed
- prevent doxxing and malicious submissions
- keep audit logs for status and score changes
- restrict sensitive layers to privileged roles

## MVP Scope

The first usable version should focus on operational simplicity.

### Phase 1 MVP

- interactive map
- signal submission
- signal list and detail view
- map layers for signals and watch zones
- hotspot / cluster visualization
- geofence management
- basic alerts
- trust and confidence labels
- role-based access

### Phase 2

- confidence scoring engine
- duplicate detection
- source trust scoring
- signal clustering automation
- pattern detection
- watch zone generation
- route and corridor analysis

### Phase 3

- drone upload workflows
- satellite data integration
- computer vision pipelines
- predictive intelligence
- offline field/mobile workflows
- agency/private operations dashboards

## Current Repo Status

The current repository already contains:

- a `frontend` Next.js scaffold
- a `backend` Django scaffold

Current limitations:

- frontend is still starter content
- backend is still default Django config
- database is still SQLite
- there is no API layer yet
- there is no geospatial model layer yet

## Build Plan

### Foundation

- [ ] Replace SQLite with PostgreSQL + PostGIS
- [ ] Add Django REST Framework
- [ ] Add environment-based settings management
- [ ] Set up CORS, auth, and media handling
- [ ] Create backend apps for core domains

### Backend Domain Setup

- [ ] Create apps for `users`, `signals`, `incidents`, `risk`, `alerts`, `geofences`, and `media`
- [ ] Define core models and migrations
- [ ] Add geospatial fields with PostGIS
- [ ] Add serializers and REST endpoints
- [ ] Add admin views for core entities

### Intelligence Layer

- [ ] Implement signal categorization
- [ ] Implement source trust scoring
- [ ] Implement duplicate detection
- [ ] Implement spatial-temporal clustering
- [ ] Implement confidence scoring
- [ ] Implement area risk scoring
- [ ] Implement threshold-based alert generation

### Frontend

- [ ] Replace placeholder landing page with product dashboard shell
- [ ] Integrate Mapbox
- [ ] Build signal map layer
- [ ] Build watch zone and risk overlays
- [ ] Build signal submission flow
- [ ] Build analyst/operator dashboard views
- [ ] Build alert center

### Data and Integrations

- [ ] Define media upload flow
- [ ] Add optional WhatsApp/SMS ingestion design
- [ ] Add import path for public datasets
- [ ] Define drone upload workflow

### Security and Governance

- [ ] Add role-based permissions
- [ ] Add audit logging
- [ ] Add visibility restrictions for sensitive data
- [ ] Add abuse reporting / malicious source controls

### Documentation

- [ ] Write system architecture document
- [ ] Write API contract document
- [ ] Write data model reference
- [ ] Write trust/confidence scoring rules
- [ ] Write deployment guide

## Immediate Next Steps

Recommended next implementation order:

1. Set up PostgreSQL + PostGIS in the backend.
2. Create the initial Django domain apps and models.
3. Add Django REST Framework and expose the first signal APIs.
4. Replace the frontend placeholder with a real product shell.
5. Add Mapbox and render the first signal and risk layers.
6. Add confidence labels and simple clustering before advanced AI.

## Short-Term Build Goal

Deliver a first operational version that can:

- accept signals
- display them on a map
- group nearby related signals
- show area risk states
- alert users when risk thresholds change

That version alone would already prove the core value of AegisMap.
