#!/bin/zsh
# 원티드 이력서의 한 필드에 값을 넣고 저장한다.
# 사용법: wanted_set_field.sh <handle> <field-index> <본문파일>
#
# 원티드 폼은 React 로 만들어져 있어 value 를 직접 대입하면 React 가 되돌린다.
# execCommand 로 실제 입력 경로를 타고, onBlur 핸들러를 직접 불러야 PATCH 가 나간다.
#
# browser-driver 는 JS 가 실행되기만 하면 종료 코드 0 을 낸다.
# 반환값을 받아 기대한 값인지 확인해야 실패를 잡을 수 있다.
#
# JS 를 큰따옴표로 감싸는 이유는 셸 변수를 끼워 넣기 위해서다.
# 이 안에 명령 치환이나 백틱을 넣으면 셸이 먼저 먹으므로 넣지 않는다.
set -e
H="$1"; IDX="$2"; FILE="$3"

[ -z "$H" ] || [ -z "$IDX" ] || [ -z "$FILE" ] && {
  echo "사용법: $0 <handle> <field-index> <본문파일>" >&2; exit 2; }
[[ "$IDX" =~ ^[0-9]+$ ]] || { echo "field-index 는 숫자여야 한다: $IDX" >&2; exit 2; }
[ -r "$FILE" ] || { echo "본문 파일을 읽을 수 없다: $FILE" >&2; exit 2; }

B=~/.claude/scripts/browser-driver
B64=$(base64 < "$FILE" | tr -d '\n')

GOT=$($B js "$H" "(function(){
  var v = new TextDecoder().decode(Uint8Array.from(atob('$B64'), function(c){return c.charCodeAt(0)}));
  var el = document.querySelectorAll('input,textarea')[$IDX];
  if(!el) return 'NO_ELEMENT';
  if(el.maxLength > 0 && v.length > el.maxLength) return 'TOO_LONG ' + v.length + '/' + el.maxLength;
  el.scrollIntoView({block:'center'});
  el.focus();
  el.setSelectionRange(0, el.value.length);
  if(!document.execCommand('insertText', false, v)) return 'INSERT_FAIL';
  var k = Object.keys(el).find(function(x){return x.indexOf('__reactProps') === 0;});
  if(!k) return 'NO_PROPS';
  el[k].onBlur({target: el, currentTarget: el, type: 'blur', preventDefault: function(){}, stopPropagation: function(){}});
  return 'OK ' + el.getAttribute('data-agent-field-key') + ' len=' + el.value.length;
})()")

case "$GOT" in
  OK\ *) echo "$GOT" ;;
  *) echo "입력 실패: $GOT" >&2; exit 1 ;;
esac
