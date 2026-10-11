"""지정한 fos-assistant 체크아웃의 실제 검증기로 이 plugin을 검사한다. 운영 설정은 바꾸지 않는다."""

import argparse
import importlib
import importlib.abc
import importlib.util
import copy
import json
import pathlib
import subprocess
import sys
import types

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--assistant-root", type=pathlib.Path, required=True)
parser.add_argument("--assistant-ref", default="origin/main")
args = parser.parse_args()
module_root = args.assistant_root.resolve() / "hermes/plugins/dashboard-profile-api"
# 다른 체크아웃의 작업 파일 대신 지정한 Git object의 코드만 메모리에서 읽는다.
class GitModules(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    prefix = "accountbook_policy_check."

    def find_spec(self, fullname, path=None, target=None):
        if fullname.startswith(self.prefix):
            return importlib.util.spec_from_loader(fullname, self)

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        name = module.__name__.removeprefix(self.prefix)
        relative = "hermes/plugins/dashboard-profile-api/" + name + ".py"
        source = subprocess.check_output(
            ["git", "-C", str(args.assistant_root), "show", args.assistant_ref + ":" + relative],
            text=True,
        )
        module.__file__ = str(module_root / (name + ".py"))
        exec(compile(source, module.__file__, "exec"), module.__dict__)


# 서버 초기화를 실행하지 않고 상대 import에 필요한 패키지 경로만 제공한다.
package = types.ModuleType("accountbook_policy_check")
package.__path__ = [str(module_root)]
sys.modules[package.__name__] = package
sys.meta_path.insert(0, GitModules())
manifest = importlib.import_module(package.__name__ + ".connector_manifest")
root = pathlib.Path(__file__).resolve().parent.parent
checked = manifest._load_connector("fos-accountbook", {
    "root": root,
    "command": str(pathlib.Path.home() / ".bun/bin/bun"),
    "env": {"ACCOUNTBOOK_API_BASE_URL": "https://accountbook.example.com/api/v1"},
})
print("connector_policy 및 manifest 검증 통과")
print("도구 수:", len(checked["tools"]))
print("owner_output_env:", checked["owner_output_env"])
declared = json.loads((root / "connector.json").read_text())
descriptions = importlib.import_module(package.__name__ + ".connector_description")
expected = {name: item["description"] for name, item in declared["tools"].items()}
assert checked["tool_descriptions"] == expected
assert all(descriptions._tool_description(value) == value for value in expected.values())
assert checked["link"] == declared["link"]
assert checked["readme_url"] == declared["readme_url"]
assert checked["link_kind"] == "service"
for value in (None, {}, "", " \t\n", "가" * 2001, "😀" * 2001,
              "설명\x00", "설명\x85", "설명\u202e", "설명\u2066", "설명\ud800"):
    assert descriptions._tool_description(value) is None
for value in ("가" * 2000, "😀" * 2000, "\ufeff\u00a0 설명 \n"):
    assert descriptions._tool_description(value) == value.strip(descriptions._TRIM)
policy = importlib.import_module(package.__name__ + ".connector_policy")
baseline = policy._connector_tools(declared, "list_families", {"list_families"}, "accountbook")
without_descriptions = copy.deepcopy(declared)
for tool in without_descriptions["tools"].values():
    del tool["description"]
assert policy._connector_tools(without_descriptions, "list_families", {"list_families"}, "accountbook") == baseline
for name, key, value in (("list_families", "unknown_metadata", True),
                         ("create_expense", "approval", "none"),
                         ("create_expense", "risk", "DESTRUCTIVE")):
    mutated = copy.deepcopy(declared)
    mutated["tools"][name][key] = value
    try:
        policy._connector_tools(mutated, "list_families", {"list_families"}, "accountbook")
    except ValueError:
        pass
    else:
        raise AssertionError("알 수 없는 metadata 또는 위험도 하한을 허용했다")
print("16개 설명·두 링크·Unicode 계약·정책 분리·비정상 metadata 회귀 통과")
