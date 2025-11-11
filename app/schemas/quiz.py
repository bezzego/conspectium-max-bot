from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuizStatus


class QuizAnswerRead(BaseModel):
    id: int
    text: str
    is_correct: bool
    position: int

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionRead(BaseModel):
    id: int
    title: str
    explanation: Optional[str] = None
    position: int
    answers: List[QuizAnswerRead]

    model_config = ConfigDict(from_attributes=True)


class QuizSummaryRead(BaseModel):
    id: int
    user_id: int
    conspect_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: QuizStatus
    created_at: datetime
    updated_at: datetime
    latest_result: Optional["QuizResultRead"] = None

    model_config = ConfigDict(from_attributes=True)


class QuizRead(QuizSummaryRead):
    instructions: Optional[str] = None
    questions: List[QuizQuestionRead] = []
    results: List["QuizResultRead"] = []


class QuizCreateFromConspectRequest(BaseModel):
    conspect_id: int
    questions_count: Optional[int] = Field(default=5, ge=1, le=20, description="Количество вопросов в тесте")


class QuizUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, description="Новое название теста")
    description: Optional[str] = Field(default=None, description="Описание теста")


class QuizListResponse(BaseModel):
    items: List[QuizSummaryRead]


class QuizResultCreate(BaseModel):
    answers: List[int]


class QuizResultRead(BaseModel):
    id: int
    quiz_id: int
    user_id: int
    score: Optional[float] = None
    total_questions: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


QuizSummaryRead.model_rebuild()
QuizRead.model_rebuild()


class QuizManualAnswerCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuizManualQuestionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=2000)
    explanation: Optional[str] = Field(default=None, max_length=2000)
    answers: List[QuizManualAnswerCreate] = Field(min_length=2)


class QuizManualCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=5000)
    questions: List[QuizManualQuestionCreate] = Field(min_length=1, max_length=50)
