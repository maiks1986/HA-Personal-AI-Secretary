import voluptuous as vol
from homeassistant import config_entries, core
from .const import DOMAIN, CONF_ENGINE_HOST, CONF_ENGINE_PORT, CONF_API_KEY, DEFAULT_ENGINE_PORT, DEFAULT_ENGINE_HOST
import logging
import os

_LOGGER = logging.getLogger(__name__)

class WhatsAppConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self):
        self._client = None
        self.user_data_dir = None
        self.account_name = None
        self.qr_base64 = None
        self.monitor_only = False

    async def async_step_user(self, user_input=None):
        """Handle a flow initiated by the user."""
        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema({
                    vol.Required(CONF_ENGINE_HOST, default=DEFAULT_ENGINE_HOST): str,
                    vol.Required(CONF_ENGINE_PORT, default=DEFAULT_ENGINE_PORT): int,
                    vol.Required(CONF_API_KEY): str,
                }),
            )

        await self.async_set_unique_id("whatsapp_engine")
        self._abort_if_unique_id_configured()

        return self.async_create_entry(
            title="WhatsApp Engine", 
            data={
                CONF_ENGINE_HOST: user_input[CONF_ENGINE_HOST],
                CONF_ENGINE_PORT: user_input[CONF_ENGINE_PORT],
                CONF_API_KEY: user_input[CONF_API_KEY]
            }
        )

    async def async_step_reauth(self, user_input=None):
        """Handle re-authentication."""
        # This will be called if the session becomes invalid.
        # We can implement this later.
        pass
