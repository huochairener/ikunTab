from __future__ import annotations
"""应用配置：环境变量 / 默认值。"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IKUN_", env_file=".env", extra="ignore")

    # 运行环境 dev / prod
    env: str = "dev"

    # 数据库
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_db: str = "ikuntab"
    mysql_user: str = "root"
    mysql_password: str = "123456"

    # JWT
    jwt_secret: str = "ikun-tab-secret-key-change-me-in-production-please-use-a-long-random-string-2026"
    jwt_cookie_name: str = "ikun_token"
    jwt_expire_minutes: int = 43200  # 30 days

    # 上传
    upload_dir: str = "/tmp/ikun-uploads"
    upload_url_prefix: str = "/uploads"

    # CORS
    cors_origins: str = "*"

    # 第三方代理
    hotlist_api_url: str = "http://localhost:3000"
    hotlist_cache_minutes: int = 20
    weather_cache_minutes: int = 30
    favicon_cache_days: int = 7

    @property
    def database_url(self) -> str:
        return (
            f"mysql+aiomysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}?charset=utf8mb4"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
