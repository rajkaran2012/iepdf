from pydantic import BaseModel


class EncryptedFile(BaseModel):
    index: int
    name: str


class PasswordRequiredResponse(BaseModel):
    needs_password: bool
    encrypted_files: list[EncryptedFile]