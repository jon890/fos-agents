#!/bin/zsh
# 원티드 프로젝트 항목의 기간을 설정한다.
# 사용법: wanted_set_period.sh <handle> <title-field-index> <start|end> <YYYY> <M>
#
# 기간 선택기는 년도 그리드를 먼저 보여주고 년도를 고르면 월 그리드로 바뀐다.
# 항목 경계를 넘어 옆 프로젝트의 기간을 건드리는 사고가 나므로,
# 컨테이너가 title 을 하나만 담는지 확인한 뒤에 클릭한다.
#
# browser-driver 는 JS 가 실행되기만 하면 종료 코드 0 을 낸다.
# 단계마다 반환값을 받아 기대한 값인지 확인해야 실패를 잡을 수 있다.
#
# JS 를 큰따옴표로 감싸는 이유는 셸 변수를 끼워 넣기 위해서다.
# 이 안에 명령 치환 `$(` 나 백틱을 넣으면 셸이 먼저 먹으므로 넣지 않는다.
set -e
H="$1"; IDX="$2"; WHICH="$3"; Y="$4"; M="$5"

[ -z "$H" ] || [ -z "$IDX" ] || [ -z "$WHICH" ] || [ -z "$Y" ] || [ -z "$M" ] && {
  echo "사용법: $0 <handle> <title-field-index> <start|end> <YYYY> <M>" >&2; exit 2; }
[[ "$IDX" =~ ^[0-9]+$ ]] || { echo "field-index 는 숫자여야 한다: $IDX" >&2; exit 2; }
[[ "$Y" =~ ^[0-9]{4}$ ]] || { echo "연도는 네 자리 숫자여야 한다: $Y" >&2; exit 2; }
[[ "$M" =~ ^([1-9]|1[0-2])$ ]] || { echo "월은 1부터 12 사이여야 한다: $M" >&2; exit 2; }
[[ "$WHICH" == "start" || "$WHICH" == "end" ]] || { echo "start 또는 end 여야 한다: $WHICH" >&2; exit 2; }

B=~/.claude/scripts/browser-driver
POS=$([ "$WHICH" = "start" ] && echo 0 || echo 1)

step() {  # step <기대값> <설명> <JS>
  local want="$1" what="$2" js="$3" got
  got=$($B js "$H" "$js")
  [ "$got" = "$want" ] || { echo "$what 실패: $got" >&2; exit 1; }
}

step opened "선택기 열기" "(function(){
  var t = document.querySelectorAll('input,textarea')[$IDX];
  if(!t || t.getAttribute('data-agent-field-key') !== 'title') return 'NOT_TITLE';
  var box = t.parentElement, found = null;
  for(var n=0; n<8 && box; n++){
    var titles = box.querySelectorAll('[data-agent-field-key=title]');
    var dates = Array.from(box.querySelectorAll('button')).filter(function(x){
      var s = (x.textContent||'').trim();
      return s === 'YYYY.MM' || /^\d{4}\.\d{1,2}\$/.test(s);
    });
    if(titles.length === 1 && dates.length >= 2){ found = box; break; }
    if(titles.length > 1) return 'BOUNDARY_CROSSED';
    box = box.parentElement;
  }
  if(!found) return 'NO_BOX';
  var bs = Array.from(found.querySelectorAll('button')).filter(function(x){
    var s = (x.textContent||'').trim();
    return s === 'YYYY.MM' || /^\d{4}\.\d{1,2}\$/.test(s);
  });
  found.scrollIntoView({block:'center'});
  bs[$POS].click();
  return 'opened';
})()"

$B waitjs "$H" "document.querySelectorAll('div.wds-z4o2j').length === 1" 5000 >/dev/null

# 선택기 안의 항목은 innerText 가 비어 있어 textContent 로 잡는다
step year "연도 선택" "(function(){
  var g = document.querySelectorAll('div.wds-z4o2j');
  if(g.length !== 1) return 'GRID_COUNT ' + g.length;
  var y = Array.from(g[0].querySelectorAll('button')).filter(function(x){return (x.textContent||'').trim() === '$Y';})[0];
  if(!y) return 'NO_YEAR';
  y.click(); return 'year';
})()"

$B waitjs "$H" "(function(){var g=document.querySelectorAll('div.wds-z4o2j'); return g.length===1 && Array.from(g[0].querySelectorAll('button')).some(function(x){return /월\$/.test((x.textContent||'').trim());});})()" 5000 >/dev/null

step month "월 선택" "(function(){
  var g = document.querySelectorAll('div.wds-z4o2j');
  if(g.length !== 1) return 'GRID_COUNT ' + g.length;
  var m = Array.from(g[0].querySelectorAll('button')).filter(function(x){return (x.textContent||'').trim() === '${M}월';})[0];
  if(!m) return 'NO_MONTH';
  m.click(); return 'month';
})()"

step confirmed "확인" "(function(){
  var ok = Array.from(document.querySelectorAll('button')).filter(function(x){
    return (x.textContent||'').trim() === '확인' && x.getBoundingClientRect().width > 0;
  });
  if(!ok.length) return 'NO_CONFIRM';
  ok[ok.length-1].click(); return 'confirmed';
})()"

echo "confirmed"
