from __future__ import annotations

import json
from pathlib import Path

from .models import RunReport
from .safety import redact_text


def _redacted_payload(report: RunReport, patient_phone: str | None) -> dict:
    raw = report.model_dump_json(indent=2)
    return json.loads(redact_text(raw, patient_phone=patient_phone))


def write_reports(report: RunReport, run_dir: Path, *, patient_phone: str | None) -> tuple[Path, Path]:
    run_dir.mkdir(parents=True, exist_ok=True)
    payload = _redacted_payload(report, patient_phone)
    json_path = run_dir / "report.json"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = [
        f"# ScheduRx Browser QA — {report.run_id}",
        "",
        f"- Target: `{report.target}`",
        f"- Clinic: `{report.clinic_id}`",
        f"- Started: `{report.started_at}`",
        f"- Finished: `{report.finished_at}`",
        f"- Appointment mutations authorized: `{report.safety['appointment_mutations']}`",
        f"- Real messaging authorized: `{report.safety['real_messages']}`",
        f"- Clinic mutations authorized: `{report.safety['clinic_mutations']}`",
        "",
    ]
    for scenario in payload["scenarios"]:
        result = scenario["result"]
        lines.extend(
            [
                f"## {scenario['journey_id']} — {result['outcome']}",
                "",
                result["summary"],
                "",
            ]
        )
        for check in result["checks"]:
            marker = {"pass": "PASS", "fail": "FAIL", "blocked": "BLOCKED", "not_run": "NOT RUN"}[
                check["status"]
            ]
            lines.append(f"- {marker}: {check['name']} — {check['evidence']}")
        if result["concerns"]:
            lines.extend(["", "Concerns:"])
            lines.extend(f"- {item}" for item in result["concerns"])
        lines.append("")

    md_path = run_dir / "report.md"
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path

