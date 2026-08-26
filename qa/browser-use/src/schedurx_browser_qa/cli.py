from __future__ import annotations

import argparse
from datetime import UTC, datetime
from pathlib import Path

from .config import QAConfig
from .journeys import (
    admin_readonly,
    doctor_readonly,
    manage_readonly,
    patient_booking,
    patient_cancel,
    patient_reschedule,
    patient_validation,
    smoke_invalid_link,
    unique_patient_name,
)
from .models import RunReport, ScenarioRecord
from .reporting import write_reports
from .runner import (
    open_staff_login_page,
    prompt_human_login,
    run_journey,
    verify_staff_session,
)
from .safety import (
    SafetyPolicy,
    SafetyRefusal,
    patient_entry_url,
    prompt_patient_phone,
    typed_authorization,
    validate_manage_url,
)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="ScheduRx staging journeys driven by browser-harness CDP (no LLM API key required)"
    )
    result.add_argument(
        "--journey",
        action="append",
        choices=["smoke", "patient-validation", "patient", "doctor", "admin", "all"],
        help="Journey to run; repeat for multiple. Defaults to safe smoke.",
    )
    result.add_argument("--allow-appointment-mutations", action="store_true")
    result.add_argument("--allow-real-messages", action="store_true")
    result.add_argument("--include-reschedule", action="store_true")
    result.add_argument("--include-cancel", action="store_true")
    result.add_argument(
        "--allow-clinic-mutations",
        action="store_true",
        help="Reserved safety flag. Current admin journey remains read-only even when set.",
    )
    result.add_argument("--env-file", type=Path)
    result.add_argument("--dry-run", action="store_true", help="Print selected journeys and exit without a browser")
    result.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Per-journey CDP timeout in seconds (default 180).",
    )
    return result


def _expanded_journeys(values: list[str] | None) -> list[str]:
    selected = values or ["smoke"]
    if "all" in selected:
        selected = ["smoke", "patient-validation", "patient", "doctor", "admin"]
    return list(dict.fromkeys(selected))


def _run_journey_sync(
    journey_id: str,
    script: str,
    *,
    config: QAConfig,
    run_dir: Path,
    timeout: int,
) -> ScenarioRecord:
    print(f"\n=== Running {journey_id} ===")
    record = run_journey(
        journey_id=journey_id,
        script=script,
        run_dir=run_dir,
        config=config,
        timeout=timeout,
    )
    print(f"Outcome: {record.result.outcome} — {record.result.summary}")
    return record


def _staff_login_flow(config: QAConfig, role: str) -> None:
    """Open the staff login page, pause for human Google sign-in, then verify."""
    print(f"\n--- Staff login required: {role} ---")
    stdout, stderr, rc = open_staff_login_page(config)
    if rc != 0:
        print(f"Warning: open_staff_login_page returned rc={rc}")
        if stderr:
            print(f"stderr: {stderr[:300]}")
    prompt_human_login(role)
    payload, _stdout, _stderr = verify_staff_session()
    if payload:
        print(f"Session verified: url={payload.get('url', '?')}, title={payload.get('title', '?')}")
    else:
        print("Warning: could not verify staff session via CDP. Proceeding with journey anyway.")


def _run(args: argparse.Namespace) -> int:
    config = QAConfig.from_env(env_file=args.env_file)
    journeys = _expanded_journeys(args.journey)
    policy = SafetyPolicy(
        allow_appointment_mutations=args.allow_appointment_mutations,
        allow_real_messages=args.allow_real_messages,
        allow_clinic_mutations=args.allow_clinic_mutations,
    )

    if "patient" in journeys:
        policy.require_patient_mutation("patient booking")
    if (args.include_reschedule or args.include_cancel) and "patient" not in journeys:
        raise SafetyRefusal("--include-reschedule/--include-cancel require --journey patient")

    if args.dry_run:
        print(f"Journeys: {', '.join(journeys)}")
        print(f"Staff target: {config.staff_url}")
        print(f"Patient target: {config.patient_base_url}/{config.clinic_id}/<phone-or-appointment>")
        print(f"Allowed domains: {', '.join(config.allowed_domains)}")
        print(f"Appointment mutations: {policy.allow_appointment_mutations}")
        print(f"Real messages: {policy.allow_real_messages}")
        print("No browser launched.")
        return 0

    run_started = datetime.now(UTC)
    run_id = run_started.strftime("%Y%m%dT%H%M%SZ")
    run_dir = config.artifact_root / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    patient_phone: str | None = None
    patient_name: str | None = None
    entry_url: str | None = None
    records: list[ScenarioRecord] = []
    timeout = args.timeout

    try:
        if "smoke" in journeys:
            records.append(
                _run_journey_sync(
                    "patient-invalid-appointment-link",
                    smoke_invalid_link(config),
                    config=config,
                    run_dir=run_dir,
                    timeout=timeout,
                )
            )

        if "patient-validation" in journeys or "patient" in journeys:
            patient_phone = prompt_patient_phone()
            patient_name = unique_patient_name()
            entry_url = patient_entry_url(config, patient_phone)

        if "patient-validation" in journeys and entry_url and patient_name:
            records.append(
                _run_journey_sync(
                    "patient-required-field-validation",
                    patient_validation(config, entry_url, patient_name),
                    config=config,
                    run_dir=run_dir,
                    timeout=timeout,
                )
            )

        manage_url: str | None = None
        if "patient" in journeys and entry_url and patient_name:
            typed_authorization("BOOKING")
            records.append(
                _run_journey_sync(
                    "patient-mandatory-token-booking",
                    patient_booking(config, entry_url, patient_name),
                    config=config,
                    run_dir=run_dir,
                    timeout=timeout,
                )
            )
            raw_manage_url = input(
                "\nPaste the appointment manage link received after payment, or press Enter to skip manage tests: "
            )
            if raw_manage_url.strip():
                manage_url = validate_manage_url(config, raw_manage_url)
                records.append(
                    _run_journey_sync(
                        "patient-manage-readonly",
                        manage_readonly(config, manage_url),
                        config=config,
                        run_dir=run_dir,
                        timeout=timeout,
                    )
                )

            if args.include_reschedule:
                if not manage_url:
                    raise SafetyRefusal("Reschedule requested but no appointment manage link was supplied")
                typed_authorization("RESCHEDULE")
                records.append(
                    _run_journey_sync(
                        "patient-reschedule",
                        patient_reschedule(config, manage_url),
                        config=config,
                        run_dir=run_dir,
                        timeout=timeout,
                    )
                )

            if args.include_cancel:
                if not manage_url:
                    raise SafetyRefusal("Cancellation requested but no appointment manage link was supplied")
                typed_authorization("CANCEL")
                records.append(
                    _run_journey_sync(
                        "patient-cancel",
                        patient_cancel(config, manage_url),
                        config=config,
                        run_dir=run_dir,
                        timeout=timeout,
                    )
                )

        if "doctor" in journeys:
            _staff_login_flow(config, "invited non-owner doctor")
            records.append(
                _run_journey_sync(
                    "doctor-dashboard-readonly",
                    doctor_readonly(config, patient_name),
                    config=config,
                    run_dir=run_dir,
                    timeout=timeout,
                )
            )

        if "admin" in journeys:
            _staff_login_flow(config, "clinic owner")
            records.append(
                _run_journey_sync(
                    "clinic-owner-dashboard-readonly",
                    admin_readonly(config),
                    config=config,
                    run_dir=run_dir,
                    timeout=timeout,
                )
            )
    finally:
        report = RunReport(
            run_id=run_id,
            started_at=run_started.isoformat(),
            finished_at=datetime.now(UTC).isoformat(),
            target="ScheduRx staging",
            clinic_id=config.clinic_id,
            safety={
                "appointment_mutations": policy.allow_appointment_mutations,
                "real_messages": policy.allow_real_messages,
                "clinic_mutations": policy.allow_clinic_mutations,
            },
            scenarios=records,
        )
        json_path, md_path = write_reports(report, run_dir, patient_phone=patient_phone)
        print(f"\nReports:\n- {md_path}\n- {json_path}")

    failed = any(record.result.outcome in {"failed", "blocked"} for record in records)
    return 1 if failed else 0


def main() -> None:
    args = parser().parse_args()
    try:
        raise SystemExit(_run(args))
    except (SafetyRefusal, ValueError) as exc:
        raise SystemExit(f"Safety/configuration error: {exc}") from exc


if __name__ == "__main__":
    main()