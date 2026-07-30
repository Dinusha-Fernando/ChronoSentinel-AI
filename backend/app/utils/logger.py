import os
import sys
from loguru import logger

# Ensure logs directory exists in backend
LOGS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logs"))
os.makedirs(LOGS_DIR, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOGS_DIR, "app.log")

# Configure loguru to match our desired format, outputting to stdout and to a file
logger.remove()  # Remove default handler

# Log to stdout with colors
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True
)

# Log to file (without color tags since file is plain text, but with standard level formatting)
logger.add(
    LOG_FILE_PATH,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="INFO",
    rotation="10 MB",
    retention="7 days",
    compression="zip",
    encoding="utf-8"
)

# Export the configured logger and log file path
__all__ = ["logger", "LOG_FILE_PATH"]
