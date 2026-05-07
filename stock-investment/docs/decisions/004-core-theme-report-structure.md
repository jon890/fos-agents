# ADR-004: Core + Theme report structure

- Status: Accepted
- Date: 2026-05-07

## Context

The morning stock-investment brief now covers CRCL, BTC, Google/Alphabet, Nasdaq/QQQ, and AI semiconductor/infrastructure. If every new interest becomes a full daily section, the brief will become too long and less useful.

## Decision

Adopt a **Core + Theme** structure.

1. The daily morning brief remains the core report.
2. Core report sections stay compact:
   - CRCL
   - BTC
   - GOOGL/Google
   - QQQ/Nasdaq
   - AI semiconductor/infrastructure summary
3. Theme deep-dives are separate current-issue reports, run manually or when strong triggers appear.
4. Initial theme keys:
   - `ai-semiconductor-infrastructure`
   - `google-io-alphabet-ai`
   - `us-clarity-act`
5. Store theme metadata and trigger candidates in `config/theme-reports.json`.

## Operating model

- Morning brief answers: “What changed overnight and what should I watch today?”
- Theme report answers: “Is this a bigger thesis/cycle/event worth deeper analysis?”
- Default behavior: do not run every theme every morning.
- Triggered behavior: when a large move, earnings window, policy event, product launch, or infrastructure bottleneck appears, run the relevant theme report.

## Guardrails

- Keep Discord morning output readable; avoid turning it into a long research note.
- Use theme reports for depth, not daily noise.
- Explain whether a theme trigger is price-driven, news-driven, event-driven, or user-requested.
- Do not treat trigger firing as a buy/sell signal.
