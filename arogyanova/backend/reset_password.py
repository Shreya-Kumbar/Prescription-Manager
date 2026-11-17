"""
Reset a user's password in the local ArogyaNova database.

Usage (from arogyanova/backend):
    .venv\\Scripts\\python reset_password.py someone@example.com

The new password is typed at a hidden prompt and stored as an Argon2id hash.
"""
import getpass
import sqlite3
import sys

from app.security.passwords import hash_password

DB_PATH = "arogyanova.db"


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python reset_password.py <email>")
        sys.exit(1)
    email = sys.argv[1].strip().lower()

    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT id FROM users WHERE lower(email) = ?", (email,)).fetchone()
    if row is None:
        print(f"No user found with email {email}")
        sys.exit(1)

    pw = getpass.getpass("New password: ")
    if pw != getpass.getpass("Repeat new password: "):
        print("Passwords do not match. Nothing changed.")
        sys.exit(1)
    if len(pw) < 8 or not any(c.isupper() for c in pw) or not any(c.islower() for c in pw) or not any(c.isdigit() for c in pw):
        print("Password must be 8+ characters with uppercase, lowercase and a digit. Nothing changed.")
        sys.exit(1)

    conn.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hash_password(pw), row[0]))
    conn.commit()
    conn.close()
    print(f"Password updated for {email}. You can log in now.")


if __name__ == "__main__":
    main()
