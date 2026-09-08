"""Database operations for explanation reservations and history."""
from datetime import datetime, timezone
from sqlalchemy import select, update, func
from app.models.code_risk import RiskExplanation, RiskExplanationRequest
from app.models.user import User


def lock_account(db, user_id):
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).one()


def expire(db, user_id):
    now = datetime.now(timezone.utc)
    db.execute(update(RiskExplanation).where(RiskExplanation.created_by == user_id,
        RiskExplanation.status == 'pending', RiskExplanation.expires_at <= now).values(
        status='failed', failure='Request expired. Its provider outcome is unknown; retry explicitly.', finished_at=now))


def by_key(db, user_id, request_key):
    return db.scalar(select(RiskExplanation).join(RiskExplanationRequest).where(
        RiskExplanationRequest.created_by == user_id, RiskExplanationRequest.request_key == request_key))


def cached(db, user_id, context_digest):
    return db.scalar(select(RiskExplanation).where(RiskExplanation.created_by == user_id,
        RiskExplanation.context_digest == context_digest, RiskExplanation.status.in_(['pending', 'completed']))
        .order_by(RiskExplanation.id.desc()))


def count(db, user_id, *, since=None, pending=False):
    query = select(func.count()).select_from(RiskExplanation).where(RiskExplanation.created_by == user_id)
    if since is not None:
        query = query.where(RiskExplanation.created_at >= since)
    if pending:
        query = query.where(RiskExplanation.status == 'pending')
    return db.scalar(query)


def history(db, occurrence_id, offset, limit):
    query = select(RiskExplanation).where(RiskExplanation.occurrence_id == occurrence_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return db.scalars(query.order_by(RiskExplanation.id.desc()).offset(offset).limit(limit)).all(), total


def remember_key(db, user_id, request_key, explanation_id):
    db.add(RiskExplanationRequest(created_by=user_id, request_key=request_key, explanation_id=explanation_id))
