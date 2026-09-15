#!/usr/bin/env python3
"""Hermes cron에서 위시켓 전용 Browser Use Cloud 세션을 관리한다."""

from __future__ import annotations

import argparse
import json
import os


DAEMON_NAME = "wishket-cron"
PROFILE_NAME = "wishket-home"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("start", "status", "stop"))
    return parser.parse_args()


def profile() -> dict:
    from browser_harness.admin import list_cloud_profiles

    matches = [item for item in list_cloud_profiles() if item.get("name") == PROFILE_NAME]
    if len(matches) != 1:
        raise RuntimeError(
            f"Browser Use Cloud profile {PROFILE_NAME!r} 개수는 1이어야 합니다: {len(matches)}"
        )
    return matches[0]


def main() -> int:
    from browser_harness.admin import daemon_alive, start_remote_daemon, stop_remote_daemon

    args = parse_args()
    current = profile()

    if args.action == "start":
        if not daemon_alive(DAEMON_NAME):
            os.environ["BH_OPEN_LIVE_URL"] = "0"
            start_remote_daemon(
                DAEMON_NAME,
                profileId=current["id"],
                proxyCountryCode="kr",
                timeout=30,
            )
        result = {"ok": True, "action": "start", "session": DAEMON_NAME}
    elif args.action == "status":
        result = {
            "ok": True,
            "action": "status",
            "session": DAEMON_NAME,
            "running": daemon_alive(DAEMON_NAME),
            "authenticatedDomains": sorted(current.get("cookieDomains") or []),
        }
    else:
        if daemon_alive(DAEMON_NAME):
            stop_remote_daemon(DAEMON_NAME)
        result = {"ok": True, "action": "stop", "session": DAEMON_NAME}

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
