import bcrypt


def hash_password(password: str) -> str:
    """Хеширует пароль с использованием bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Проверяет пароль против хеша."""
    try:
        password_bytes = plain_password.encode('utf-8')
        hash_bytes = password_hash.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except (ValueError, TypeError):
        return False
