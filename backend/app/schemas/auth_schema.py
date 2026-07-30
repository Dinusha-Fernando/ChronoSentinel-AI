from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expiry


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class ResetPasswordRequest(BaseModel):
    """Used by admin to force-reset another user's password."""
    new_password: Optional[str] = None  # If None, a temp password is generated
    send_email: bool = False             # Whether to email the new password


class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    role: str
    status: str
    department: Optional[str] = None
    last_login_at: Optional[str] = None
    must_change_password: bool = False

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    username_or_email: str


class UserResetPasswordRequest(BaseModel):
    token: str
    new_password: str
