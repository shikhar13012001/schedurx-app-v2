from pathlib import Path

import pytest

from schedurx_browser_qa.config import QAConfig, _validated_https_url


def test_rejects_decoy_and_wrong_hosts() -> None:
    with pytest.raises(ValueError):
        _validated_https_url("QA_STAFF_URL", "https://schedurx-app-v1.vercel.app", "app.schedurx.com")
    with pytest.raises(ValueError):
        _validated_https_url("QA_STAFF_URL", "http://app.schedurx.com", "app.schedurx.com")


def test_defaults_target_confirmed_staging(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("QA_STAFF_URL", raising=False)
    monkeypatch.delenv("QA_PATIENT_BASE_URL", raising=False)
    config = QAConfig.from_env(env_file=tmp_path / "missing.env")
    assert config.staff_url == "https://app.schedurx.com"
    assert config.patient_base_url == "https://book.schedurx.com"
    assert "schedurx-app-v1.vercel.app" not in config.allowed_domains

