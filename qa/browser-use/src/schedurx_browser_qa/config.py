from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

EXPECTED_STAFF_HOST = "app.schedurx.com"
EXPECTED_PATIENT_HOST = "book.schedurx.com"
DECOY_HOST = "schedurx-app-v1.vercel.app"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _validated_https_url(name: str, value: str, expected_host: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != expected_host:
        raise ValueError(f"{name} must be https://{expected_host}, got {value!r}")
    if parsed.hostname == DECOY_HOST:
        raise ValueError(f"{name} points at the explicitly prohibited v1 decoy")
    return value.rstrip("/")


@dataclass(frozen=True)
class QAConfig:
    staff_url: str
    patient_base_url: str
    clinic_id: str
    clinic_name: str
    doctor_name: str
    expected_token_rupees: int
    timezone: str
    browser_channel: str
    max_steps: int
    capture_gif: bool
    capture_video: bool
    artifact_root: Path

    @classmethod
    def from_env(cls, *, env_file: Path | None = None) -> QAConfig:
        load_dotenv(env_file or Path.cwd() / ".env")
        staff_url = _validated_https_url(
            "QA_STAFF_URL",
            os.getenv("QA_STAFF_URL", "https://app.schedurx.com"),
            EXPECTED_STAFF_HOST,
        )
        patient_url = _validated_https_url(
            "QA_PATIENT_BASE_URL",
            os.getenv("QA_PATIENT_BASE_URL", "https://book.schedurx.com"),
            EXPECTED_PATIENT_HOST,
        )
        return cls(
            staff_url=staff_url,
            patient_base_url=patient_url,
            clinic_id=os.getenv("QA_CLINIC_ID", "poc-clinic-001").strip(),
            clinic_name=os.getenv("QA_CLINIC_NAME", "Dr. Sharma's Clinic").strip(),
            doctor_name=os.getenv("QA_DOCTOR_NAME", "Rahul Mehta").strip(),
            expected_token_rupees=int(os.getenv("QA_EXPECTED_TOKEN_RUPEES", "120")),
            timezone=os.getenv("QA_TIMEZONE", "Asia/Kolkata").strip(),
            browser_channel=os.getenv("QA_BROWSER_CHANNEL", "chrome").strip(),
            max_steps=int(os.getenv("QA_MAX_STEPS", "80")),
            capture_gif=_env_bool("QA_CAPTURE_GIF"),
            capture_video=_env_bool("QA_CAPTURE_VIDEO"),
            artifact_root=Path.cwd() / ".artifacts",
        )

    @property
    def invalid_appointment_url(self) -> str:
        return f"{self.patient_base_url}/{self.clinic_id}/apt_qa-browser-use-nonexistent"

    @property
    def allowed_domains(self) -> list[str]:
        return [
            EXPECTED_STAFF_HOST,
            EXPECTED_PATIENT_HOST,
            "accounts.google.com",
            "*.google.com",
            "*.googleusercontent.com",
            "*.firebaseapp.com",
            "checkout.stripe.com",
            "*.stripe.com",
        ]

