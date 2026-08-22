from pydantic import BaseModel

from app.schemas.project import ProjectRead


class DemoDataStatusRead(BaseModel):
    enabled: bool
    reason: str | None = None


class DemoDataSeedRead(BaseModel):
    created: bool
    project: ProjectRead
    message: str
