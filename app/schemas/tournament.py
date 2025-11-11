from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuizStatus
from app.models.tournament import MedalType, TournamentLobbyStatus


class TournamentParticipantRead(BaseModel):
    id: int
    user_id: int
    is_ready: bool
    is_host: bool
    score: Optional[int] = None
    time_seconds: Optional[int] = None
    place: Optional[int] = None
    joined_at: datetime
    finished_at: Optional[datetime] = None
    
    # User info
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class TournamentLobbyRead(BaseModel):
    id: int
    quiz_id: int
    host_id: int
    invite_code: str
    max_participants: int
    status: TournamentLobbyStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Quiz info
    quiz_title: Optional[str] = None
    quiz_questions_count: Optional[int] = None
    
    # Participants
    participants: List[TournamentParticipantRead] = Field(default_factory=list)
    participants_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class TournamentLobbyCreateRequest(BaseModel):
    quiz_id: int
    max_participants: int = Field(default=8, ge=2, le=20)


class TournamentLobbyJoinRequest(BaseModel):
    invite_code: str


class TournamentParticipantUpdateRequest(BaseModel):
    is_ready: Optional[bool] = None


class MedalRead(BaseModel):
    id: int
    user_id: int
    lobby_id: Optional[int] = None
    medal_type: MedalType
    description: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class MedalStatsRead(BaseModel):
    total_medals: int
    gold_count: int
    silver_count: int
    bronze_count: int
    winner_count: int
    perfect_score_count: int
    participant_count: int

