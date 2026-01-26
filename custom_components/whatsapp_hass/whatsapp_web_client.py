import asyncio
import base64
import logging
import os

_LOGGER = logging.getLogger(__name__)

class WhatsAppWebClient:
    """A placeholder client that can be expanded if a browser is available."""
    def __init__(self, user_data_dir=None):
        self._user_data_dir = user_data_dir
        self._driver = None

    async def get_qr_code_or_login(self):
        return "error", "Browser not supported on this server architecture."

    async def is_logged_in(self):
        return False

    async def send_message(self, contact_name, message):
        raise Exception("Browser not available")

    async def close(self):
        pass
