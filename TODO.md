# To Do

## TeamSync Demo (Personara.ai)

- Finalize and operationalize TeamSync simulation demo framework:
  - Location: `teamsync-demo/`
  - Use linked Clifton/Gallup PDFs in `teamsync-demo/config/participants.json`.
  - Fill `strengthsSummary` TODO fields for all six participants.
  - Keep workflow adaptable by updating `teamsync-demo/config/workflow.json` as process changes.
  - Generate updated Codex run packet with:
    - `powershell -ExecutionPolicy Bypass -File .\teamsync-demo\scripts\build-simulation-prompt.ps1`
  - Use output packet from `teamsync-demo/runs/teamsync-simulation-prompt.txt` for demo walkthroughs.

## Foundational Asset: OpenAI Interaction Logic & Value Expansion Audit

- Map every OpenAI touchpoint in the product like tracing a river system:
  - Identify each entry point (where data enters AI flows).
  - Identify each transformation step (how raw input becomes enriched output).
  - Identify each output destination (where enriched content appears for users/admins/resellers).

- For each OpenAI API interaction, produce a plain-language explanation:
  - What goes in (user text, profile data, job data, etc.).
  - What the model does (classify, summarize, rewrite, infer traits, score fit, generate actions).
  - What comes out (structured fields, narrative content, recommendations, rankings).
  - Why it matters (decision speed, confidence, personalization, monetizable differentiation).

- Explain enrichment using simple metaphors:
  - "Refinery": raw user data is refined into decision-grade insights.
  - "Translator": complex signals become understandable guidance.
  - "GPS": static profiles become dynamic next-step navigation.

- Define transformation quality criteria for each API call:
  - Accuracy and relevance.
  - Consistency of tone and format.
  - Actionability (can the user do something immediately?).
  - Trust signals (explanations, confidence framing, source/context cues).

- Identify future enrichment opportunities to increase value for each buyer type:
  - User value:
    - Progress memory (resume where they left off, with momentum cues).
    - Personalized weekly "next best action" plans.
    - Adaptive coaching based on behavior and outcomes.
  - Reseller value:
    - Configurable prompt packs by industry/segment.
    - Co-branded insight templates and ROI dashboards.
    - Multi-client orchestration with benchmark comparisons.
  - White-label/new owner value:
    - Brand voice overlays and policy packs.
    - Domain-specific enrichment modules (recruiting, education, coaching, etc.).
    - Plug-in architecture for new model tasks without core rewrites.

- Add human-behavior retention loops to increase return usage:
  - Goal-gradient effect: show visible progress bars and "one step left" nudges.
  - Variable reward: rotate insight depth/angle so each return visit feels fresh.
  - Endowed progress: pre-fill early wins to reduce startup friction.
  - Identity reinforcement: reflect user identity growth ("you are becoming...").
  - Commitment consistency: prompt micro-commitments and revisit them in follow-ups.
  - Zeigarnik effect: leave meaningful open loops ("next best step pending").
  - Habit triggers: time-based reminders linked to user routines and prior success windows.

- Specify instrumentation needed to learn and improve:
  - Track which enrichments drive repeat sessions.
  - Track completion of suggested actions and downstream outcomes.
  - Track confidence and satisfaction feedback after key AI outputs.
  - Build cohort analysis by user, reseller tenant, and white-label deployment.

- Define output artifact format (foundational internal asset):
  - System map of all OpenAI interactions.
  - Plain-language interaction catalog.
  - Enrichment backlog with impact/effort scoring.
  - Retention strategy playbook with experimentation roadmap.
