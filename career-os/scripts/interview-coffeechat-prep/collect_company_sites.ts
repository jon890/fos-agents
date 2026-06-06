#!/usr/bin/env bun
// Deprecated compatibility tombstone. See ADR-048.

console.error(
  [
    'interview-coffeechat-prep collector is deprecated.',
    'Use career-os/scripts/interview-prep-analyzer/collect_interview_sites.ts --mode <first-round|final-round|offer-chat>.',
    'Coffeechat-specific automation is intentionally disabled.',
  ].join('\n'),
);

process.exit(1);
