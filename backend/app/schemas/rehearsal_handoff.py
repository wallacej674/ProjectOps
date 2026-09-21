"""Bounded assignment, result and decision contracts."""
from typing import Literal
from uuid import UUID
from app.schemas.code_risk import Contract, Digest
from app.schemas.rehearsal import Text


class DecisionInput(Contract):
    request_key: UUID
    digest: Digest
    decision: Literal['go', 'no_go', 'defer']
    reason: Text
