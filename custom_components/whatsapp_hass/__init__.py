"""The WhatsApp integration."""
import asyncio
import logging
import os
import subprocess
import threading
import sys
import re
import requests
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Global storage for the UI thread
UI_THREAD = None

def cleanup_conflicts():
    """Remove conflicting libraries that break HA core integrations."""
    conflicts = ["google-generativeai", "playwright"]
    for pkg in conflicts:
        try:
            _LOGGER.info(f"Cleaning up conflicting package: {pkg}")
            subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", pkg], check=False)
        except:
            pass

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up WhatsApp from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # Run cleanup once to fix the broken ESPHome/etc
    if not hass.data.get(f"{DOMAIN}_cleaned"):
        await hass.async_add_executor_job(cleanup_conflicts)
        hass.data[f"{DOMAIN}_cleaned"] = True

    account_name = entry.data["name"]
    web_ui_url = entry.data.get("web_ui_url", "http://localhost:5001")
    
    # Start the Web UI Gateway locally on the HA server (Lite version)
    global UI_THREAD
    if UI_THREAD is None:
        from .gateway_ui import start_gateway
        UI_THREAD = threading.Thread(target=start_gateway, args=(hass, None), daemon=True)
        UI_THREAD.start()
        _LOGGER.info("WhatsApp Lite Gateway started on port 5001")

    hass.data[DOMAIN][entry.entry_id] = {
        "name": account_name,
        "web_ui_url": web_ui_url
    }

    async def handle_send_message(call):
        """Proxy send message to whichever gateway is active."""
        contact = call.data.get("contact")
        message = call.data.get("message")
        try:
            # Try to send via the configured Web UI URL
            requests.post(f"{web_ui_url}/api/proxy_send_message", 
                         json={"contact": contact, "message": message}, timeout=5)
        except Exception as e:
            _LOGGER.error(f"Failed to send message: {e}")

    hass.services.async_register(DOMAIN, "send_message", handle_send_message)

    # Register Sidebar Panel
    # Using relative path to the local gateway
    hass.components.frontend.async_register_panel(
        "iframe",
        "whatsapp",
        "mdi:whatsapp",
        title="WhatsApp",
        url="http://192.168.188.95:5001", # Point directly to the server port
        require_admin=True,
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)
    if not hass.data[DOMAIN]:
        hass.components.frontend.async_remove_panel("whatsapp")
    return True