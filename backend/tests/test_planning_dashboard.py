import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models import Course, DeadlineStatus
from app.schemas import DeadlineCreate, DeadlineUpdate
from app.services.dashboard import DashboardService
from app.services.planning import PlanningService


@pytest.mark.asyncio
async def test_deadline_crud_and_dashboard_aggregate(session, users) -> None:
    owner, _ = users
    course = Course(id=uuid.uuid4(), owner_id=owner.id, name="Planning")
    session.add(course)
    await session.commit()
    planning = PlanningService(session, owner.id)
    deadline = await planning.create_deadline(
        DeadlineCreate(
            course_id=course.id,
            title="Submit assignment",
            due_at=datetime.now(UTC) + timedelta(days=2),
        )
    )
    rows, total = await planning.list_deadlines(1, 20, "upcoming")
    assert total == 1 and rows[0].id == deadline.id
    await planning.update_deadline(deadline.id, DeadlineUpdate(status=DeadlineStatus.DONE))
    dashboard = await DashboardService(session, owner.id).get()
    assert dashboard.courses_count == 1
    assert dashboard.upcoming_deadlines_count == 0
