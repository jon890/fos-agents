#!/bin/zsh
# 원티드 이력서 편집 화면의 입력 필드를 인덱스와 함께 낸다.
# 사용법: wanted_list_fields.sh <handle> [all]
#
# 항목을 추가하면 그 아래 인덱스가 전부 밀린다.
# 값을 넣기 전과 항목을 추가한 뒤에 매번 이것으로 다시 읽는다.
# 인자에 all 을 주면 직무와 직책까지 포함한 전체를 낸다.
#
# 결과가 비면 NO_FIELDS 를 내고 종료 코드 1 로 끝낸다.
# 편집 화면이 아니거나 로그인이 풀린 상태와, 정말로 항목이 없는 상태를 구분해야 한다.
set -e
H="$1"; MODE="${2:-title}"
[ -z "$H" ] && { echo "사용법: $0 <handle> [all]" >&2; exit 2; }
B=~/.claude/scripts/browser-driver

if [ "$MODE" = "all" ]; then
  FILTER="true"
else
  FILTER="x.k === 'title' || x.k === 'about' || x.k === 'description'"
fi

GOT=$($B js "$H" "(function(){
  var all = document.querySelectorAll('input,textarea');
  if(!all.length) return 'NO_INPUTS';
  var rows = Array.from(all).map(function(e,i){
    return {i:i, k:e.getAttribute('data-agent-field-key') || '', v:(e.value||'').slice(0,40).replace(/\n/g,' / ')};
  }).filter(function(x){ return x.v && ($FILTER); });
  if(!rows.length) return 'NO_FIELDS';
  return rows.map(function(x){
    return String(x.i).padStart(3) + '  ' + (x.k || '-').padEnd(12) + '  ' + x.v;
  }).join('\n');
})()")

case "$GOT" in
  NO_INPUTS) echo "입력 요소가 하나도 없다. 편집 화면인지 로그인 상태인지 확인한다." >&2; exit 1 ;;
  NO_FIELDS) echo "조건에 맞는 필드가 없다. 화면과 필터를 확인한다." >&2; exit 1 ;;
  "") echo "빈 응답이다. 브라우저 핸들을 확인한다." >&2; exit 1 ;;
  *) echo "$GOT" ;;
esac
