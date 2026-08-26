from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

CheckStatus = Literal["pass", "fail", "blocked", "not_run"]
JourneyOutcome = Literal["passed", "failed", "blocked", "partial"]


class CheckResult(BaseModel):
    name: str
    status: CheckStatus
    evidence: str


class JourneyResult(BaseModel):
    journey_id: str
    persona: Literal["patient", "doctor", "clinic_admin", "system"]
    outcome: JourneyOutcome
    summary: str
    checks: list[CheckResult] = Field(default_factory=list)
    observed_urls: list[str] = Field(default_factory=list)
    created_records: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)


class ScenarioRecord(BaseModel):
    journey_id: str
    started_at: str
    finished_at: str
    result: JourneyResult
    agent_successful: bool | None
    agent_errors: list[str]
    steps: int
    duration_seconds: float
    screenshot_paths: list[str]
    gif_path: str | None = None

    @classmethod
    def started_now(cls) -> str:
        return datetime.now(UTC).isoformat()


class RunReport(BaseModel):
    run_id: str
    started_at: str
    finished_at: str
    target: str
    clinic_id: str
    safety: dict[str, bool]
    scenarios: list[ScenarioRecord]

