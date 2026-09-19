from pydantic import BaseModel, Field

from app.models import TopicStatus


class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    order_index: int | None = Field(default=None, ge=0)
    status: TopicStatus | None = None
