from enum import Enum


class AudioSourceType(str, Enum):
    UPLOAD = "uploaded"
    TELEGRAM_VOICE = "microphone"
    EXTERNAL_URL = "external_url"


class AudioProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ConspectStatus(str, Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ConspectVariantType(str, Enum):
    FULL = "full"
    BRIEF = "brief"
    COMPRESSED = "compressed"


class QuizStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class GenerationJobType(str, Enum):
    TRANSCRIPTION = "transcription"
    CONSPECT = "conspect"
    QUIZ = "quiz"


class GenerationJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
