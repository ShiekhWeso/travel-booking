from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    model_config = SettingsConfigDict(env_file=".env")
    cors_origins: str = "http://localhost:5173"
    timezone: str = "Asia/Kuala_Lumpur"
    
settings = Settings()