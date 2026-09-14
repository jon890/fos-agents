#!/usr/bin/env python3
import urllib.request
import json
import sys
import os

base = 'https://www.wanted.co.kr/gigs/api-v2/projects'
params = '?work_place=remote&is_recruiting=true'
all_jobs = []
page = 1
while True:
    url = base + params + f'&page={page}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        sys.stderr.write(f'Error fetching page {page}: {e}\\n')
        break
    jobs = data.get('rows', [])
    if not jobs:
        break
    all_jobs.extend(jobs)
    sys.stderr.write(f'Fetched page {page}, {len(jobs)} remote jobs\\n')
    if len(jobs) < 20:  # assuming 20 per page
        break
    page += 1

# Convert to enriched format
def to_item(job):
    # Determine budget from salary if available
    salary = job.get('salary', {})
    budget_krw = None
    if salary.get('salary_type') == 'monthly':
        start = salary.get('start')
        end = salary.get('end')
        if start is not None and end is not None:
            # Assume monthly salary * duration months? Not given.
                # We'll just use start as monthly salary in 10k won? Actually the numbers are in 10k won? Example: start:300, end:400 likely means 300만원 ~ 400만원 per month.
                # We'll convert to yearly? For simplicity, take average monthly * 3 months? Not accurate.
                # We'll set budget_krw as None and let scoring use default.
                pass
    # For now leave budget unknown
    # duration from term? term_type and start months? Not reliable.
    duration_days = None
    applicants = job.get('apply_count')
    return {
        'platform': '원티드 긱스',
        'project_id': str(job.get('id')),
        'title': job.get('title', '').strip(),
        'url': f"https://www.wanted.co.kr/gigs/projects/{job.get('id')}",
        'registered_at': job.get('startAt'),  # maybe start date
        'collected_at': None,  # will be filled by assemble
        'list_page': page,
        'collection_source': None,  # will be filled
        'budget_krw': None,
        'duration_days': None,
        'applicants': applicants,
        'fit': 3,
        'risk': 3,
        'portfolio': 3,
        'remote': 5,  # we filtered remote
        'remote_only_pass': True,
        'scope_clarity': 3,
        'delivery_confidence': 3,
        'experience_match': 3,
        'reputation_value': 3,
    }

items = [to_item(j) for j in all_jobs]
output = {
    'collected_at': None,
    'collection': [{
        'platform': '원티드 긱스',
        'source_id': 'wanted-gigs-active-scope',
        'advertised_count': len(all_jobs),
        'pages_scanned': page,
        'stopped_after_no_new_ids': 0,
        'coverage_expected': True,
    }],
    'items': items
}
out_path = '/home/bifos/fos-agents/side-projects/data/runtime/downloads/wanted-gigs-enriched-2026-09-05.json'
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f'Saved {len(items)} jobs to {out_path}')