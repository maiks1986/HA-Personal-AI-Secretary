"""The Ultimate WhatsApp Home Assistant Bridge."""
import logging
import aiohttp
from datetime import timedelta
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView
from homeassistant.components import frontend, panel_custom
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers import config_validation as cv, device_registry as dr
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor"]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up WhatsApp Bridge from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    host = entry.data.get("engine_host", "localhost")
    port = entry.data.get("engine_port", 5002)
    api_key = entry.data.get("api_key", "")
    
    engine_url = f"http://{host}:{port}"
    session = aiohttp.ClientSession()

    async def async_update_data():
        """Fetch data from Node Engine."""
        headers = {"x-api-key": api_key}
        try:
            async with session.get(f"{engine_url}/api/instances", headers=headers, timeout=5) as response:
                if response.status != 200:
                    raise UpdateFailed(f"Error {response.status}")
                return await response.json()
        except Exception as err:
            raise UpdateFailed(f"Error communicating with engine: {err}")

    coordinator = DataUpdateCoordinator(
        hass,
        _LOGGER,
        name="whatsapp_instances",
        update_method=async_update_data,
        update_interval=timedelta(seconds=10),
    )

    # Initial refresh
    await coordinator.async_config_entry_first_refresh()
    
    hass.data[DOMAIN][entry.entry_id] = {
        "engine_url": engine_url,
        "api_key": api_key,
        "session": session,
        "coordinator": coordinator
    }

    # Register Panel
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="whatsapp-panel",
        sidebar_title="WhatsApp",
        sidebar_icon="mdi:whatsapp",
        frontend_url_path="whatsapp",
        module_url="/api/whatsapp_proxy/index.html",
        embed_iframe=True,
        require_admin=False,
    )

    # Register Proxy View
    hass.http.register_view(WhatsAppProxyView(hass, engine_url, api_key))

    # --- SERVICES ---
    async def engine_api_call(method: str, path: str, data: dict = None):
        """Helper to call Node.js Engine."""
        url = f"{engine_url}{path}"
        headers = {"x-api-key": api_key}
        try:
            async with session.request(method, url, json=data, headers=headers, timeout=10) as response:
                if response.status >= 400:
                    _LOGGER.error(f"Engine API Error {response.status} on {path}")
                    return None
                return await response.json()
        except Exception as e:
            _LOGGER.error(f"Failed to communicate with Node Engine at {url}: {e}")
            return None

    async def handle_send_message(call: ServiceCall):
        """Send a text message."""
        contact = call.data.get("contact")
        message = call.data.get("message")
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("POST", "/api/send_message", {
            "instanceId": instance_id,
            "contact": contact,
            "message": message
        })

    async def handle_modify_chat(call: ServiceCall):
        """Modify a chat (pin, archive, delete)."""
        jid = call.data.get("jid")
        action = call.data.get("action")
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("POST", f"/api/chats/{instance_id}/{jid}/modify", {"action": action})

    async def handle_set_presence(call: ServiceCall):
        """Set account presence."""
        presence = call.data.get("presence")
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("POST", f"/api/instances/{instance_id}/presence", {"presence": presence})

    async def handle_create_group(call: ServiceCall):
        """Create a new group."""
        title = call.data.get("title")
        participants = call.data.get("participants", [])
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("POST", f"/api/groups/{instance_id}", {"title": title, "participants": participants})

    async def handle_track_contact(call: ServiceCall):
        """Track a new contact for social presence."""
        jid = call.data.get("jid")
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("POST", "/api/social/tracked", {"instanceId": instance_id, "jid": jid})

    async def handle_untrack_contact(call: ServiceCall):
        """Stop tracking a contact."""
        jid = call.data.get("jid")
        instance_id = call.data.get("instance_id", 1)
        await engine_api_call("DELETE", f"/api/social/tracked/{instance_id}/{jid}")

    # Register Services
    hass.services.async_register(DOMAIN, "send_message", handle_send_message)
    hass.services.async_register(DOMAIN, "modify_chat", handle_modify_chat)
    hass.services.async_register(DOMAIN, "set_presence", handle_set_presence)
    hass.services.async_register(DOMAIN, "create_group", handle_create_group)
    hass.services.async_register(DOMAIN, "track_contact", handle_track_contact)
    hass.services.async_register(DOMAIN, "untrack_contact", handle_untrack_contact)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload entry."""
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["session"].close()
    
    frontend.async_remove_panel(hass, "whatsapp")
    
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


class WhatsAppProxyView(HomeAssistantView):
    """Proxy view for WhatsApp Engine."""
    url = "/api/whatsapp_proxy/{path:.*}"
    name = "api:whatsapp_proxy"
    requires_auth = True # HA Auth required!

    def __init__(self, hass, engine_url, api_key):
        self.hass = hass
        self.engine_url = engine_url
        self.api_key = api_key
        self.session = aiohttp.ClientSession()

    async def _handle(self, request, path):
        # Forward request to Node Engine
        # We forward to the root, so /api/whatsapp_proxy/api/stats -> engine_url/api/stats
        target_url = f"{self.engine_url}/{path}"
        
        method = request.method
        data = None
        if method in ['POST', 'PUT']:
            data = await request.json()

        headers = {"x-api-key": self.api_key}
        
        async with self.session.request(method, target_url, json=data, headers=headers) as resp:
            # Forward response back to UI
            text = await resp.text()
            return aiohttp.web.Response(text=text, status=resp.status, content_type=resp.content_type)

    async def get(self, request, path): return await self._handle(request, path)
    async def post(self, request, path): return await self._handle(request, path)
    async def delete(self, request, path): return await self._handle(request, path)
    async def put(self, request, path): return await self._handle(request, path)