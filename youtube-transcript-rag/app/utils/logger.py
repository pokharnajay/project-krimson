import logging
from logging.handlers import RotatingFileHandler
import os

# Create logs directory if it doesn't exist
if not os.path.exists('logs'):
    os.makedirs('logs')

# Configure logger
logger = logging.getLogger('youtube_rag')
logger.setLevel(logging.DEBUG)

# File handler with rotation (UTF-8 encoding to avoid character issues)
file_handler = RotatingFileHandler(
    'logs/logging.txt',
    maxBytes=10485760,  # 10MB
    backupCount=5,
    encoding='utf-8'  # Fix for Unicode characters
)
file_handler.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

def log_info(message):
    logger.info(message)

def log_error(message):
    logger.error(message)

def log_debug(message):
    logger.debug(message)

def log_warning(message):
    logger.warning(message)
