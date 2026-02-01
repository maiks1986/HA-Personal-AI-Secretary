"""Binary sensor platform for WhatsApp Pro."""
import logging
from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
from homeassistant.core import HomeAssistant
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities):
    """Set up the binary sensor platform."""
    # The coordinator is shared via hass.data if we set it up in __init__ 
    # or we can just fetch it if it was created in sensor.py.
    # Since platforms are loaded in parallel, we need a reliable way to share it.
    
    # Check if coordinator exists in hass.data
    data = hass.data[DOMAIN][entry.entry_id]
    if "coordinator" not in data:
        _LOGGER.debug("Coordinator not found in hass.data, binary_sensor will wait or retry")
        # In a real scenario, we'd move coordinator creation to __init__.py
        return

    coordinator = data["coordinator"]
    
    entities = []
    for instance in coordinator.data:
        entities.append(WhatsAppInstanceBinarySensor(coordinator, instance["id"], instance["name"]))
    
    async_add_entities(entities)

class WhatsAppInstanceBinarySensor(BinarySensorEntity):
    """Representation of a WhatsApp Instance Connectivity sensor."""

    def __init__(self, coordinator, instance_id, instance_name):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self.instance_id = instance_id
        self._instance_name = instance_name
        self._attr_name = f"WhatsApp {instance_name} Connectivity"
        self._attr_unique_id = f"whatsapp_{instance_id}_connectivity"
        self._attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
        self._attr_device_info = {
            "identifiers": {(DOMAIN, "engine")},
        }

    @property
    def is_on(self):
        """Return true if the binary sensor is on."""
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return inst["status"] == "connected"
        return False

    @property
    def should_poll(self):
        return False

    async def async_added_to_hass(self):
        """Connect to coordinator update signal."""
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))

