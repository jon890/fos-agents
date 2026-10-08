"""지정한 fos-assistant 체크아웃의 실제 검증기로 이 plugin을 검사한다. 운영 설정은 바꾸지 않는다."""

import argparse
import importlib
import pathlib
import sys
import types

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--assistant-root", type=pathlib.Path, required=True)
args = parser.parse_args()
module_root = args.assistant_root.resolve() / "hermes/plugins/dashboard-profile-api"
# 서버 초기화를 실행하지 않고 상대 import에 필요한 패키지 경로만 제공한다.
package = types.ModuleType("accountbook_policy_check")
package.__path__ = [str(module_root)]
sys.modules[package.__name__] = package
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
