"""The WhatsApp Home Assistant Bridge."""
import logging
import requests
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up WhatsApp Bridge from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # We assume the Node engine is running on port 5002 on the same host (the Pi)
    engine_url = "http://127.0.0.1:5002"

    async def handle_send_message(call):
        """Send message via Node.js Engine."""
        contact = call.data.get("contact")
        message = call.data.get("message")
        
        # JID format for WhatsApp is usually number@s.whatsapp.net
        # We'll do a simple conversion if it's just a number
        jid = contact
        if "@" not in jid:
            jid = f"{jid}@s.whatsapp.net"

        try:
            response = await hass.async_add_executor_job(
                lambda: requests.post(f"{engine_url}/send", 
                                   json={"jid": jid, "message": message}, 
                                   timeout=10)
            )
            response.raise_for_status()
            _LOGGER.info(f"Message sent to {jid}")
        except Exception as e:
            _LOGGER.error(f"Failed to send message via Node Engine: {e}")

    hass.services.async_register(DOMAIN, "send_message", handle_send_message)

    # Register Sidebar Panel pointing to the Node Engine UI
    # Note: Use the external HA IP for the browser to reach it
    from homeassistant.helpers.network import get_url
    try:
        base_url = get_url(hass, allow_internal=True, allow_ip=True)
        panel_url = base_url.rsplit(":", 1)[0] + ":5002"
    except:
        panel_url = "http://192.168.188.95:5002"

    hass.components.frontend.async_register_panel(
        "iframe",
        "whatsapp",
        "mdi:whatsapp",
        title="WhatsApp",
        url=panel_url,
        require_admin=True,
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload entry."""
    if not hass.data[DOMAIN]:
        hass.services.async_remove(DOMAIN, "send_message")
        hass.components.frontend.async_remove_panel("whatsapp")
    return True
