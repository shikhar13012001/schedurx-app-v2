from __future__ import annotations

import getpass
import re
from dataclasses import dataclass
from urllib.parse import quote, urlparse

from .config import EXPECTED_PATIENT_HOST, QAConfig


class SafetyRefusal(RuntimeError):
    """Raised when a requested live action is outside the authorized policy."""


@dataclass(frozen=True)
class SafetyPolicy:
    allow_appointment_mutations: bool = False
    allow_real_messages: bool = False
    allow_clinic_mutations: bool = False

    def require_patient_mutation(self, action: str) -> None:
        if not self.allow_appointment_mutations:
            raise SafetyRefusal(
                f"{action} changes live test-clinic data. Re-run with --allow-appointment-mutations."
            )
        if not self.allow_real_messages:
            raise SafetyRefusal(
                f"{action} can trigger real, billable SMS/WhatsApp sends. Re-run with --allow-real-messages."
            )

    def require_clinic_mutation(self, action: str) -> None:
        if not self.allow_clinic_mutations:
            raise SafetyRefusal(f"{action} changes clinic configuration and is not authorized in this harness.")


def prompt_patient_phone() -> str:
    raw = getpass.getpass(
        "Test patient's Indian mobile number (hidden; real messages may be delivered): "
    ).strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return f"+91{digits}"


def patient_entry_url(config: QAConfig, phone: str) -> str:
    return f"{config.patient_base_url}/{config.clinic_id}/{quote(phone, safe='')}"


def validate_manage_url(config: QAConfig, value: str) -> str:
    url = value.strip()
    parsed = urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.scheme != "https" or parsed.hostname != EXPECTED_PATIENT_HOST:
        raise ValueError(f"Manage URL must be on https://{EXPECTED_PATIENT_HOST}")
    if len(parts) != 2 or parts[0] != config.clinic_id or parts[1] == "pay":
        raise ValueError(f"Expected /{config.clinic_id}/<appointmentId> manage URL")
    if not (parts[1].startswith("apt_") or parts[1].startswith("appt_")):
        raise ValueError("The manage URL does not contain an appointment identifier")
    return url


def typed_authorization(action: str) -> None:
    phrase = f"AUTHORIZE {action.upper()}"
    entered = input(
        f"\nLIVE ACTION: {action} may mutate poc-clinic-001 and send real messages.\n"
        f"Type {phrase!r} to continue: "
    ).strip()
    if entered != phrase:
        raise SafetyRefusal(f"Operator did not authorize {action}")


def redact_text(value: str, *, patient_phone: str | None = None) -> str:
    redacted = value
    if patient_phone:
        variants = {patient_phone, re.sub(r"\D", "", patient_phone), re.sub(r"\D", "", patient_phone)[-10:]}
        for variant in sorted(variants, key=len, reverse=True):
            if variant:
                redacted = redacted.replace(variant, "[REDACTED_PHONE]")
    redacted = re.sub(r"\b(?:apt|appt)_[0-9A-Za-z-]+", "[REDACTED_APPOINTMENT_ID]", redacted)
    redacted = re.sub(r"\bpbk_[0-9A-Za-z-]+", "[REDACTED_PENDING_ID]", redacted)
    return redacted

