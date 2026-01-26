"""The WhatsApp integration."""
import asyncio
import logging
import os
import subprocess
import threading
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN
from .whatsapp_web_client import WhatsAppWebClient

_LOGGER = logging.getLogger(__name__)

# Global storage for the UI thread
UI_THREAD = None

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up WhatsApp from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # Ensure Playwright browsers are installed (runs in background thread)
    def install_playwright():
        try:
            _LOGGER.info("Checking Playwright browsers...")
            subprocess.run(["python3", "-m", "playwright", "install", "chromium"], check=True)
        except Exception as e:
            _LOGGER.error(f"Failed to install Playwright browsers: {e}")

    await hass.async_add_executor_job(install_playwright)

    # Initialize client
    user_data_dir = hass.config.path(f"whatsapp_sessions/{entry.data['name']}")
    os.makedirs(user_data_dir, exist_ok=True)
    client = WhatsAppWebClient(user_data_dir=user_data_dir)
    
    # Start the Web UI Gateway locally on the HA server
    global UI_THREAD
    if UI_THREAD is None:
        from .gateway_ui import start_gateway
        UI_THREAD = threading.Thread(target=start_gateway, args=(hass, client), daemon=True)
        UI_THREAD.start()
        _LOGGER.info("WhatsApp Web UI Gateway started on port 5001")

    hass.data[DOMAIN][entry.entry_id] = {
        "client": client,
        "name": entry.data["name"]
    }

    # Register Sidebar Panel pointing to the local HA IP
    hass.components.frontend.async_register_panel(
        "iframe",
        "whatsapp",
        "mdi:whatsapp",
        title="WhatsApp",
        url="http://127.0.0.1:5001", # Localhost works for the iframe if accessed locally, 
                                     # but we'll use the external URL in reality
        require_admin=True,
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["client"].close()
    
    if not hass.data[DOMAIN]:
        hass.components.frontend.async_remove_panel("whatsapp")
    
    return True