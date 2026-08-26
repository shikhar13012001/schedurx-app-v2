"""Execute ScheduRx QA journeys via the browser-harness CDP CLI.

Each journey is a Python script string that runs inside the ``browser-harness``
namespace (helpers ``new_tab``, ``page_info``, ``js``, ``cdp``, ``click_at_xy``,
``fill_input`` are pre-imported there). The shared helpers from ``cdp_helpers``
are prepended to every script. The script prints a single
``JOURNEY_RESULT_JSON:`` line which this module parses into a ``ScenarioRecord``.

No LLM API key is required. Chrome is driven directly via CDP.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from .config import QAConfig
from .models import JourneyResult, ScenarioRecord

BROWSER_HARNESS_BIN = "browser-harness"
_RESULT_PREFIX = "JOURNEY_RESULT_JSON:"


def _helpers_source() -> str:
    helpers_path = Path(__file__).with_name("cdp_helpers.py")
    return helpers_path.read_text(encoding="utf-8")


def _run_script(script: str, *, timeout: int = 180) -> tuple[str, str, int]:
    """Pipe ``script`` into browser-harness. Returns (stdout, stderr, returncode)."""
    try:
        proc = subprocess.run(
            [BROWSER_HARNESS_BIN],
            input=script,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return proc.stdout, proc.stderr, proc.returncode
    except FileNotFoundError:
        raise RuntimeError(
            f"{BROWSER_HARNESS_BIN} not found. Install with: "
            "uv tool install --python 3.12 --upgrade --force browser-harness"
        ) from None


def _parse_result(stdout: str) -> dict | None:
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if line.startswith(_RESULT_PREFIX):
            return json.loads(line[len(_RESULT_PREFIX):])
    return None


def execute_cdp(journey_id: str, script: str, *, timeout: int = 180) -> tuple[JourneyResult, str, str]:
    """Run one journey script. Returns (result, stdout, stderr)."""
    full = _helpers_source() + "\n\n" + script
    stdout, stderr, rc = _run_script(full, timeout=timeout)
    payload = _parse_result(stdout)
    if payload is None:
        result = JourneyResult(
            journey_id=journey_id,
            persona="system",
            outcome="blocked",
            summary="No JOURNEY_RESULT_JSON line emitted by the CDP script.",
            concerns=[f"returncode={rc}", (stderr or "")[:500]],
        )
    else:
        result = JourneyResult.model_validate(payload)
    return result, stdout, stderr


def run_journey(
    *,
    journey_id: str,
    script: str,
    run_dir: Path,
    config: QAConfig,
    timeout: int = 180,
) -> ScenarioRecord:
    started = datetime.now(UTC)
    result, stdout, stderr = execute_cdp(journey_id, script, timeout=timeout)

    # Persist raw stdout/stderr for debugging.
    log_path = run_dir / f"{journey_id}.log"
    log_path.write_text(
        f"=== stdout ===\n{stdout}\n\n=== stderr ===\n{stderr}\n", encoding="utf-8"
    )

    return ScenarioRecord(
        journey_id=journey_id,
        started_at=started.isoformat(),
        finished_at=datetime.now(UTC).isoformat(),
        result=result,
        agent_successful=result.outcome == "passed",
        agent_errors=[stderr[:500]] if stderr else [],
        steps=0,
        duration_seconds=(datetime.now(UTC) - started).total_seconds(),
        screenshot_paths=[],
        gif_path=None,
    )


def open_staff_login_page(config: QAConfig) -> tuple[str, str, int]:
    """Navigate the visible browser to the staff dashboard login page.

    Returns (stdout, stderr, returncode). The human completes Google sign-in
    in the visible Chrome window between this call and ``verify_staff_session``.
    """
    script = (
        "new_tab(" + repr(config.staff_url) + ")\n"
        "wait_for_load(30.0)\n"
        "info = page_info()\n"
        'print("STAFF_PAGE_STATE:" + str(info))\n'
    )
    return _run_script(_helpers_source() + "\n\n" + script, timeout=60)


def verify_staff_session() -> tuple[dict | None, str, str]:
    """Read the current page state to confirm the dashboard (not login) loaded."""
    script = (
        "info = page_info()\n"
        "body = body_text()\n"
        'print("STAFF_SESSION_JSON:" + __import__("json").dumps({"url": info["url"], "title": info["title"], "body_head": body[:300]}))\n'
    )
    stdout, stderr, rc = _run_script(_helpers_source() + "\n\n" + script, timeout=30)
    payload = None
    for line in reversed(stdout.splitlines()):
        if line.strip().startswith("STAFF_SESSION_JSON:"):
            payload = json.loads(line.strip()[len("STAFF_SESSION_JSON:"):])
            break
    return payload, stdout, stderr


def prompt_human_login(role: str) -> None:
    print(
        f"\nHuman login required for role: {role}.\n"
        "Use the visible Chrome window to complete Google sign-in yourself. "
        "Do not paste credentials into this terminal.\n"
        "Reach the ScheduRx Home page, then return here."
    )
    input("Press Enter after login is complete: ")


def refresh_session() -> None:
    """No-op placeholder; browser-harness daemon keeps the tab alive between calls."""
    return None