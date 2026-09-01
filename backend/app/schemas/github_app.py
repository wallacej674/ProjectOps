from pydantic import BaseModel, Field


class GitHubAppStatusRead(BaseModel):
    enabled: bool
    authorize_url: str | None = None


class GitHubAppCallbackRequest(BaseModel):
    code: str = Field(min_length=1, max_length=512)
    state: str = Field(min_length=1, max_length=2048)


class GitHubAppCallbackRead(BaseModel):
    project_id: int
    installation_count: int


class GitHubRepositoryChoiceRead(BaseModel):
    id: int
    installation_id: int
    full_name: str
    html_url: str
    default_branch: str | None
    private: bool


class GitHubRepositoryAttachRequest(BaseModel):
    installation_id: int
    repository_id: int
