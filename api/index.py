import sys
from pathlib import Path

# Add backend directory to sys.path so app modules are resolvable
_ROOT_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _ROOT_DIR / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.main import app

handler = app
__all__ = ["app", "handler"]


