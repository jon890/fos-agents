#!/bin/zsh
# LinkedIn 프로젝트 추가 폼을 채우고 채운 값을 되읽는다. 저장은 하지 않는다.
# 사용법: linkedin_fill_project.sh <handle> <프로필주소> <projects.json> <index>
#
# <프로필주소> 는 https://www.linkedin.com/in/<id> 까지다. 끝의 / 와 쿼리는 뺀다.
# projects.json 은 항목의 배열이고 항목은 아래 칸을 갖는다.
#   name   프로젝트 이름
#   desc   설명. 줄바꿈이 그대로 들어간다(textarea 다)
#   start  [연도, 월]
#   end    [연도, 월]. 진행 중이면 null 이고 「현재 이 프로젝트 작업 중」 을 켠다
#   assoc  연결할 경력의 앞 글자(예: "NHN"). 없으면 null
#
# 반환은 채운 값을 되읽은 JSON 한 줄이다. descLen 이 expectedLen 과 같은지,
# selects 가 넣으려던 기간과 경력인지를 보고 저장 버튼을 누른다.
# 「현재 이 프로젝트 작업 중」 을 켜면 종료 월과 연도 칸이 사라진다.
set -e
H="$1"; BASE="$2"; JSON="$3"; IDX="$4"
B=~/.claude/scripts/browser-driver
$B nav "$H" "$BASE/edit/forms/project/new/" 25000 >/dev/null 2>&1
$B waitjs "$H" '!!Array.from(document.querySelectorAll("input")).filter(function(e){var l=e.id?document.querySelector("label[for=\""+e.id+"\"]"):null; return l && /프로젝트 이름|Project name/.test(l.innerText||"")})[0]' 20000 >/dev/null 2>&1
sleep 1
B64=$(python3 -c "import json,base64,sys; d=json.load(open(sys.argv[1]))[int(sys.argv[2])]; print(base64.b64encode(json.dumps(d,ensure_ascii=False).encode()).decode())" "$JSON" "$IDX")
$B js "$H" "(function(){
  var d=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('$B64'), function(c){return c.charCodeAt(0)})));
  function lab(e){var l=e.id?document.querySelector('label[for=\"'+e.id+'\"]'):null; return l?(l.innerText||'').trim():(e.getAttribute('aria-label')||'');}
  var name=Array.from(document.querySelectorAll('input')).filter(function(e){return /프로젝트 이름|Project name/.test(lab(e))})[0];
  var desc=Array.from(document.querySelectorAll('textarea')).filter(function(e){return /설명|Description/.test(lab(e))})[0];
  if(!name||!desc) return 'ERR no name/desc field';
  name.focus(); document.execCommand('selectAll',false,null); document.execCommand('insertText',false,d.name);
  desc.focus(); document.execCommand('selectAll',false,null); document.execCommand('insertText',false,d.desc);
  var form=name.closest('form')||document;
  var cb=Array.from(form.querySelectorAll('input[type=checkbox]'))[0];
  if(!cb) return 'ERR no checkbox';
  var cbLabel=lab(cb)|| ((cb.closest('div')||{}).innerText||'').trim();
  if((d.end===null) !== cb.checked){ cb.click(); }
  function sel(s,text){ var o=Array.from(s.options).filter(function(o){return o.text.trim()===text})[0]; if(!o) return false; s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true})); return true; }
  var months=Array.from(form.querySelectorAll('select')).filter(function(s){return /^(월|Month)/.test(lab(s))});
  var years=Array.from(form.querySelectorAll('select')).filter(function(s){return /^(연도|Year)/.test(lab(s))});
  var r=[];
  r.push('startM='+sel(months[0], d.start[1]+'월')); r.push('startY='+sel(years[0], String(d.start[0])));
  if(d.end!==null){ months=Array.from(form.querySelectorAll('select')).filter(function(s){return /^(월|Month)/.test(lab(s))}); years=Array.from(form.querySelectorAll('select')).filter(function(s){return /^(연도|Year)/.test(lab(s))}); r.push('endM='+sel(months[1], d.end[1]+'월')); r.push('endY='+sel(years[1], String(d.end[0]))); }
  var assoc=Array.from(form.querySelectorAll('select')).filter(function(s){return /관련 항목|Associated/.test(lab(s))})[0];
  if(d.assoc){ var o=Array.from(assoc.options).filter(function(o){return o.text.trim().indexOf(d.assoc)===0})[0]; if(o){ assoc.value=o.value; assoc.dispatchEvent(new Event('change',{bubbles:true})); r.push('assoc='+o.text.trim()); } else r.push('assoc=NOTFOUND'); }
  var sels=Array.from(form.querySelectorAll('select')).filter(function(s){return /월|연도|Month|Year|관련|Assoc/.test(lab(s))}).map(function(s){return lab(s)+'='+(s.options[s.selectedIndex]||{}).text});
  return JSON.stringify({name:name.value, descLen:desc.value.length, descNewlines:(desc.value.match(/\n/g)||[]).length, expectedLen:d.desc.length, current:cb.checked, cbLabel:cbLabel.slice(0,40), set:r, selects:sels});
})()" | tail -1
