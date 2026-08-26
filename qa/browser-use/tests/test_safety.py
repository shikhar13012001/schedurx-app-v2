import pytest

from schedurx_browser_qa.config import QAConfig
from schedurx_browser_qa.safety import (
    SafetyPolicy,
    SafetyRefusal,
    patient_entry_url,
    redact_text,
    validate_manage_url,
)


@pytest.fixture
def config(tmp_path, monkeypatch) -> QAConfig:
    monkeypatch.chdir(tmp_path)
    return QAConfig.from_env(env_file=tmp_path / "missing.env")


def test_mutation_requires_both_authorizations() -> None:
    with pytest.raises(SafetyRefusal):
        SafetyPolicy().require_patient_mutation("booking")
    with pytest.raises(SafetyRefusal):
        SafetyPolicy(allow_appointment_mutations=True).require_patient_mutation("booking")
    SafetyPolicy(allow_appointment_mutations=True, allow_real_messages=True).require_patient_mutation("booking")


def test_patient_entry_url_encodes_phone(config: QAConfig) -> None:
    url = patient_entry_url(config, "+919876543210")
    assert url == "https://book.schedurx.com/poc-clinic-001/%2B919876543210"


def test_manage_url_is_strictly_scoped(config: QAConfig) -> None:
    good = "https://book.schedurx.com/poc-clinic-001/apt_1234-abcd"
    assert validate_manage_url(config, good) == good
    with pytest.raises(ValueError):
        validate_manage_url(config, "https://evil.example/poc-clinic-001/apt_1234")
    with pytest.raises(ValueError):
        validate_manage_url(config, "https://book.schedurx.com/other-clinic/apt_1234")


def test_report_redaction() -> None:
    value = "https://book.schedurx.com/poc-clinic-001/apt_abc-123 +919876543210 pbk_xyz-789"
    redacted = redact_text(value, patient_phone="+919876543210")
    assert "9876543210" not in redacted
    assert "apt_abc-123" not in redacted
    assert "pbk_xyz-789" not in redacted

