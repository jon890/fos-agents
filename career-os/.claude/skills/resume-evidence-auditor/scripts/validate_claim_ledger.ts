#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';

type Evidence = {
  kind: 'code' | 'test' | 'git' | 'document' | 'user' | 'artifact' | 'runtime';
  path: string;
  locator?: string;
  supports: string;
};

type Axis<T extends string> = {
  status: T;
  evidence: Evidence[];
};

type Claim = {
  id: string;
  text: string;
  location: string;
  type: 'timeline' | 'technology' | 'implementation' | 'ownership' | 'metric' | 'outcome' | 'causal';
  implementation: Axis<'code_verified' | 'test_verified' | 'artifact_verified' | 'document_only' | 'user_attested' | 'not_applicable' | 'unsupported' | 'contradicted'>;
  ownership: Axis<'git_verified' | 'document_only' | 'user_attested' | 'team_result' | 'not_claimed' | 'unsupported' | 'contradicted'>;
  outcome: Axis<'measured' | 'test_verified' | 'documented' | 'user_attested' | 'not_claimed' | 'unsupported' | 'contradicted'>;
  verdict: 'safe' | 'soften' | 'ask_user' | 'remove';
  proposedText: string;
};

const ledgerPath = process.argv[2];

if (!ledgerPath || !existsSync(ledgerPath)) {
  console.error(JSON.stringify({ passed: false, error: 'claim-ledger.json 경로를 찾을 수 없습니다.' }, null, 2));
  process.exit(2);
}

const data = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { artifact?: string; claims?: Claim[] };
const errors: string[] = [];
const ids = new Set<string>();
const claims = data.claims ?? [];

if (!data.artifact) errors.push('artifact 경로가 필요합니다.');
if (claims.length === 0) errors.push('claims가 비어 있습니다.');

for (const claim of claims) {
  if (!claim.id || ids.has(claim.id)) errors.push(`중복되거나 비어 있는 claim id: ${claim.id || '(empty)'}`);
  ids.add(claim.id);

  if (!claim.text || !claim.location || !claim.proposedText) {
    errors.push(`${claim.id}: text, location, proposedText가 필요합니다.`);
  }

  const axes = [claim.implementation, claim.ownership, claim.outcome];
  if (axes.some((axis) => !axis || !Array.isArray(axis.evidence))) {
    errors.push(`${claim.id}: 세 검증 축과 evidence 배열이 필요합니다.`);
    continue;
  }

  const statuses = axes.map((axis) => axis.status);
  const hasBlockingStatus = statuses.some((status) => status === 'unsupported' || status === 'contradicted');
  if (claim.verdict === 'safe' && hasBlockingStatus) {
    errors.push(`${claim.id}: unsupported 또는 contradicted 상태는 safe일 수 없습니다.`);
  }

  const allEvidence = axes.flatMap((axis) => axis.evidence);
  const isNumeric = /\d/.test(claim.text);
  if (isNumeric && allEvidence.length === 0) {
    errors.push(`${claim.id}: 수치 주장에는 근거가 필요합니다.`);
  }

  const strongOwnership = /단독|처음부터 설계|직접 설계|직접 구현|주도/.test(claim.text);
  if (strongOwnership && claim.verdict === 'safe' && !['git_verified', 'user_attested'].includes(claim.ownership.status)) {
    errors.push(`${claim.id}: 강한 소유권 표현은 git_verified 또는 user_attested가 필요합니다.`);
  }

  const strongOutcome = /해결|제거|안정화|개선|감소|증가|전환/.test(claim.text);
  if (strongOutcome && claim.verdict === 'safe' && ['not_claimed', 'unsupported', 'contradicted'].includes(claim.outcome.status)) {
    errors.push(`${claim.id}: 강한 결과 표현에는 결과 근거가 필요합니다.`);
  }

  for (const evidence of allEvidence) {
    if (!evidence.kind || !evidence.path || !evidence.supports) {
      errors.push(`${claim.id}: evidence에는 kind, path, supports가 필요합니다.`);
    }
    if (evidence.path.startsWith('/') && !existsSync(evidence.path)) {
      errors.push(`${claim.id}: 로컬 근거 경로가 존재하지 않습니다: ${evidence.path}`);
    }
  }
}

const result = {
  passed: errors.length === 0,
  file: ledgerPath,
  summary: {
    totalClaims: claims.length,
    safe: claims.filter((claim) => claim.verdict === 'safe').length,
    soften: claims.filter((claim) => claim.verdict === 'soften').length,
    askUser: claims.filter((claim) => claim.verdict === 'ask_user').length,
    remove: claims.filter((claim) => claim.verdict === 'remove').length,
    errors: errors.length,
  },
  errors,
};

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length === 0 ? 0 : 1);

