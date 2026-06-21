from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import os


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", env="OPENAI_MODEL")

    # TTS
    tts_model: str = Field(
        default="tts_models/en/ljspeech/tacotron2-DDC", env="TTS_MODEL"
    )

    # Whisper
    whisper_model: str = Field(default="base", env="WHISPER_MODEL")

    # Paths
    output_dir: str = Field(default="../outputs", env="OUTPUT_DIR")
    database_url: str = Field(default="sqlite+aiosqlite:///./eduanimate.db", env="DATABASE_URL")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000", env="CORS_ORIGINS"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
