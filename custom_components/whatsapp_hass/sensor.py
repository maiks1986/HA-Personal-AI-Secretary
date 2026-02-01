"""Sensor platform for WhatsApp Pro."""
import logging
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant
from datetime import timedelta
import aiohttp
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities):
    """Set up the sensor platform."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator = data["coordinator"]

    entities = []
    for instance in coordinator.data:
        entities.append(WhatsAppInstanceSensor(coordinator, instance["id"], instance["name"]))
    
    async_add_entities(entities)

class WhatsAppInstanceSensor(SensorEntity):
    """Representation of a WhatsApp Instance Status sensor."""

    def __init__(self, coordinator, instance_id, instance_name):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self.instance_id = instance_id
        self._instance_name = instance_name
        self._attr_name = f"WhatsApp {instance_name} Status"
        self._attr_unique_id = f"whatsapp_{instance_id}_status"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, "engine")},
        }

    @property
    def state(self):
        """Return the state of the sensor."""
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return inst["status"]
        return "unknown"

    @property
    def extra_state_attributes(self):
        """Return extra attributes."""
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return {
                    "presence": inst.get("presence", "unknown"),
                    "instance_id": self.instance_id
                }
        return {}

    @property
    def should_poll(self):
        return False

    async def async_added_to_hass(self):
        """Connect to coordinator update signal."""
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))
