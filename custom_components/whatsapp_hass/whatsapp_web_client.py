import asyncio
import base64
import logging
import os
from playwright.async_api import async_playwright

_LOGGER = logging.getLogger(__name__)

class WhatsAppWebClient:
    def __init__(self, user_data_dir=None):
        self._user_data_dir = user_data_dir
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    async def _init_browser(self):
        if self._page:
            return
        
        self._playwright = await async_playwright().start()
        
        # Launch with persistent context if data dir provided
        if self._user_data_dir:
            self._context = await self._playwright.chromium.launch_persistent_context(
                self._user_data_dir,
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            self._page = self._context.pages[0]
        else:
            self._browser = await self._playwright.chromium.launch(headless=True)
            self._page = await self._browser.new_page()

    async def get_qr_code_or_login(self):
        await self._init_browser()
        await self._page.goto("https://web.whatsapp.com")
        
        try:
            # Wait for chat list or QR code
            await self._page.wait_for_selector("#side", timeout=10000)
            return "logged_in", None
        except:
            pass

        # If not logged in, get QR
        try:
            qr_selector = "canvas"
            await self._page.wait_for_selector(qr_selector, timeout=30000)
            
            # Get base64 of the canvas
            qr_base64 = await self._page.evaluate(
                "canvas => canvas.toDataURL('image/png').substring(21)", 
                await self._page.query_selector(qr_selector)
            )
            return "qr_code", qr_base64
        except Exception as e:
            _LOGGER.error(f"Failed to get QR: {e}")
            return "error", str(e)

    async def is_logged_in(self):
        if not self._page:
            return False
        try:
            return await self._page.query_selector("#side") is not None
        except:
            return False

    async def send_message(self, contact_name, message):
        if not await self.is_logged_in():
            raise Exception("Not logged in")

        # Search for contact
        search_box = 'div[contenteditable="true"][data-tab="3"]'
        await self._page.wait_for_selector(search_box)
        await self._page.click(search_box)
        await self._page.fill(search_box, "") # Clear
        await self._page.type(search_box, contact_name)
        await asyncio.sleep(2)

        # Click contact
        contact_xpath = f'//span[@title="{contact_name}"]'
        await self._page.wait_for_selector(contact_xpath)
        await self._page.click(contact_xpath)
        await asyncio.sleep(1)

        # Type message
        msg_box = 'div[contenteditable="true"][data-tab="10"]'
        await self._page.wait_for_selector(msg_box)
        await self._page.type(msg_box, message)
        await self._page.keyboard.press("Enter")

    async def close(self):
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._page = None