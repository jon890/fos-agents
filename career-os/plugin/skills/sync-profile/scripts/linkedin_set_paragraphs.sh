#!/bin/zsh
# LinkedIn 편집 화면의 contenteditable 칸에 여러 문단짜리 글을 넣는다. 저장은 하지 않는다.
# 사용법: linkedin_set_paragraphs.sh <handle> <본문파일>
#
# 본문 파일에서 빈 줄로 나뉜 덩어리를 문단 하나로 본다.
# 문단 사이에는 insertParagraph 를 두 번 부른다. 이 편집기는 문단을 <p> 로 갖는다.
# insertLineBreak 나 문자열 안의 줄바꿈으로 넣으면 화면에서는 나뉘어 보여도
# 저장할 때 한 덩어리로 붙는다(2026-10 실측. 864자가 줄바꿈 0개로 저장됐다).
#
# 화면에 contenteditable 칸이 하나일 때만 쓴다. 둘 이상이면 어느 칸인지 알 수 없어 거절한다.
# 넣은 뒤 문단 수를 되읽어 파일의 문단 수와 다르면 종료 코드 1 로 끝낸다.
set -e
H="$1"; FILE="$2"
[ -z "$H" ] || [ -z "$FILE" ] && { echo "사용법: $0 <handle> <본문파일>" >&2; exit 2; }
[ -r "$FILE" ] || { echo "본문 파일을 읽을 수 없다: $FILE" >&2; exit 2; }
B="${BROWSER_DRIVER:-browser-driver}"

B64=$(python3 -c "
import base64,json,re,sys
t=open(sys.argv[1],encoding='utf-8').read().strip()
p=[x.strip() for x in re.split(r'\n\s*\n',t) if x.strip()]
print(base64.b64encode(json.dumps(p,ensure_ascii=False).encode()).decode())
" "$FILE")

GOT=$($B js "$H" "(function(){
  var paras = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('$B64'), function(c){return c.charCodeAt(0)})));
  var all = document.querySelectorAll('[contenteditable=true]');
  if(all.length !== 1) return 'ERR editable=' + all.length;
  var el = all[0];
  el.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  paras.forEach(function(p, i){
    if(i > 0){ document.execCommand('insertParagraph', false, null); document.execCommand('insertParagraph', false, null); }
    document.execCommand('insertText', false, p);
  });
  var got = el.innerText.split(/\n\s*\n/).filter(function(x){ return x.trim(); }).length;
  return (got === paras.length ? 'OK' : 'ERR') + ' paragraphs=' + got + '/' + paras.length + ' chars=' + el.innerText.length;
})()" | tail -1)

case "$GOT" in
  OK*) echo "$GOT" ;;
  *) echo "넣지 못했다: $GOT" >&2; exit 1 ;;
esac
