"""아이폰에서 열어 사진을 올릴 페이지를 만든다.

브라우저에 비밀 키를 둘 수 없으므로, 서명한 업로드 주소를 미리 발급해 페이지에 심는다.
주소 하나가 사진 한 장을 받는다. 정해진 기간이 지나면 그 주소는 쓸 수 없다.

만든 페이지는 홈서버에 올리고, 그 페이지를 여는 주소도 서명해서 함께 알려준다.
아이폰에서 그 주소를 열어 사진을 고르면 바로 올라간다.

파일 이름은 `001.jpg` 부터 차례로 정해진다.
올린 순서가 뒤섞여도 촬영시각으로 다시 세우므로 문제가 되지 않는다.

사용법:
    python3 make_upload_page.py 2026-09-04-순돌이곱창
    python3 make_upload_page.py 2026-09-04-순돌이곱창 --slots 120 --hours 48
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from seaweed_s3 import S3ConfigError, SeaweedS3, load_env  # noqa: E402

PAGE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ 사진 올리기</title>
<style>
:root { color-scheme: light dark; --bg:#f2f3f5; --card:#fff; --ink:#1a1a1a; --muted:#767676;
        --line:#e5e5e5; --ok:#1f8b4c; --bad:#c0392b; --accent:#2f6ecb; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#16171a; --card:#1f2023; --ink:#e8e8e8; --muted:#9a9a9a; --line:#33343a;
          --ok:#4cc38a; --bad:#e5695b; --accent:#7aa7ee; }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
       font-family:-apple-system,"Apple SD Gothic Neo",sans-serif; }
.wrap { max-width:520px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:20px; margin:0 0 4px; }
.sub { color:var(--muted); font-size:13px; margin:0 0 24px; }
.card { background:var(--card); border-radius:14px; padding:20px;
        box-shadow:0 1px 3px rgba(0,0,0,.08); }
label.pick { display:block; text-align:center; border:2px dashed var(--line); border-radius:12px;
             padding:36px 16px; cursor:pointer; color:var(--accent); font-size:16px; font-weight:600; }
label.pick input { display:none; }
#status { margin-top:18px; font-size:14px; }
.row { display:flex; justify-content:space-between; padding:7px 0;
       border-bottom:1px solid var(--line); font-size:13px; }
.row:last-child { border-bottom:0; }
.ok { color:var(--ok); } .bad { color:var(--bad); } .muted { color:var(--muted); }
.bar { height:6px; background:var(--line); border-radius:3px; overflow:hidden; margin:16px 0 8px; }
.bar > i { display:block; height:100%; width:0; background:var(--accent); transition:width .2s; }
.done { text-align:center; padding:18px; font-size:15px; font-weight:600; }
</style></head>
<body><div class="wrap">
<h1>__TITLE__</h1>
<p class="sub">사진을 고르면 홈서버로 바로 올라갑니다. 최대 __SLOTS__장.</p>
<div class="card">
  <label class="pick">사진 고르기
    <input type="file" id="pick" accept="image/*" multiple>
  </label>
  <div class="bar"><i id="bar"></i></div>
  <div id="status"><span class="muted">아직 고른 사진이 없습니다.</span></div>
</div>
</div>
<script>
const SLOTS = __SLOT_JSON__;
const status = document.getElementById('status');
const bar = document.getElementById('bar');

document.getElementById('pick').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  if (files.length > SLOTS.length) {
    status.innerHTML = '<span class="bad">사진이 ' + files.length +
      '장인데 자리가 ' + SLOTS.length + '개뿐입니다. 나눠서 올려주세요.</span>';
    return;
  }
  status.innerHTML = '';
  let done = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<span>' + (i + 1) + '. ' + files[i].name +
      '</span><span class="muted">올리는 중</span>';
    status.appendChild(row);

    try {
      const res = await fetch(SLOTS[i].url, {
        method: 'PUT',
        body: files[i],
        headers: { 'Content-Type': files[i].type || 'image/jpeg' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      row.lastChild.textContent = '완료';
      row.lastChild.className = 'ok';
      done++;
    } catch (err) {
      row.lastChild.textContent = '실패 ' + err.message;
      row.lastChild.className = 'bad';
      failed++;
    }
    bar.style.width = Math.round(((done + failed) / files.length) * 100) + '%';
  }

  const summary = document.createElement('div');
  summary.className = 'done ' + (failed ? 'bad' : 'ok');
  summary.textContent = failed
    ? done + '장 올렸고 ' + failed + '장 실패했습니다.'
    : done + '장 모두 올렸습니다.';
  status.appendChild(summary);
});
</script>
</body></html>
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", help="날짜와 장소로 만든 폴더 이름. 예: 2026-09-04-순돌이곱창")
    parser.add_argument("--slots", type=int, default=100, help="받을 사진 장수")
    parser.add_argument("--hours", type=int, default=24, help="주소가 살아 있는 시간")
    parser.add_argument("--out", help="페이지를 로컬에도 저장할 경로")
    args = parser.parse_args()

    try:
        s3 = SeaweedS3()
    except S3ConfigError as exc:
        print(exc, file=sys.stderr)
        return 2

    prefix = load_env().get("JI_YOON_BLOG_PHOTO_PREFIX", "photos/")
    base = f"{prefix.rstrip('/')}/{args.folder}"
    expires = args.hours * 3600

    slots = [
        {"key": f"{base}/{i:03d}.jpg", "url": s3.presign("PUT", f"{base}/{i:03d}.jpg", expires)}
        for i in range(1, args.slots + 1)
    ]

    page = (
        PAGE.replace("__TITLE__", html.escape(args.folder))
        .replace("__SLOTS__", str(args.slots))
        .replace("__SLOT_JSON__", json.dumps(slots, ensure_ascii=False))
    )

    page_key = f"{base}/올리기.html"
    put_url = s3.presign("PUT", page_key, expires)
    import urllib.request

    req = urllib.request.Request(
        put_url,
        data=page.encode("utf-8"),
        method="PUT",
        headers={"Content-Type": "text/html; charset=utf-8"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status not in (200, 204):
            print(f"페이지 업로드 실패: HTTP {resp.status}", file=sys.stderr)
            return 1

    if args.out:
        Path(args.out).write_text(page, encoding="utf-8")

    print("아이폰에서 이 주소를 열어 사진을 고른다.")
    print(s3.presign("GET", page_key, expires))
    print()
    print(f"사진은 {base}/ 아래에 001.jpg 부터 저장된다.", file=sys.stderr)
    print(f"주소는 {args.hours}시간 뒤에 만료된다.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
