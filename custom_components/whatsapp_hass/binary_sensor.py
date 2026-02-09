"""Binary sensor platform for WhatsApp Pro."""
import logging
from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities):
    """Set up the binary sensor platform."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator = data["coordinator"]

    added_jids = set()

    @callback
    def async_discover_sensors():
        """Discover new tracked contacts."""
        new_entities = []
        for instance in coordinator.data:
            instance_id = instance["id"]
            instance_name = instance["name"]
            tracked_contacts = instance.get("tracked", [])
            
            # Also keep the main instance connectivity sensor
            instance_key = f"instance_{instance_id}"
            if instance_key not in added_jids:
                new_entities.append(WhatsAppInstanceBinarySensor(coordinator, instance_id, instance_name))
                added_jids.add(instance_key)

            for contact in tracked_contacts:
                jid = contact["jid"]
                unique_key = f"{instance_id}_{jid}"
                if unique_key not in added_jids:
                    new_entities.append(WhatsAppContactBinarySensor(coordinator, instance_id, instance_name, contact))
                    added_jids.add(unique_key)
        
        if new_entities:
            async_add_entities(new_entities)

    # Register listener for dynamic discovery
    entry.async_on_unload(coordinator.async_add_listener(async_discover_sensors))
    
    # Initial discovery
    async_discover_sensors()

class WhatsAppInstanceBinarySensor(BinarySensorEntity):
    """Representation of a WhatsApp Instance Connectivity sensor."""

    def __init__(self, coordinator, instance_id, instance_name):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self._instance_name = instance_name
        self._attr_name = f"WhatsApp {instance_name} Connectivity"
        self._attr_unique_id = f"whatsapp_{instance_id}_connectivity"
        self._attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
            "name": f"WhatsApp {instance_name}",
            "manufacturer": "Gemini Ecosystem",
        }

    @property
    def is_on(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return inst["status"] == "connected"
        return False

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class WhatsAppContactBinarySensor(BinarySensorEntity):
    """Representation of a Tracked Contact Online Status."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        jid_prefix = self.jid.split("@")[0]
        
        self._attr_name = self._contact_name
        self.entity_id = f"binary_sensor.wa_social_{jid_prefix}"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_online"
        self._attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
    def is_on(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return contact.get("presence") == "available"
        return False

    @property
    def extra_state_attributes(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return {
                            "contact_name": self._contact_name,
                            "status_since": contact.get("status_since"),
                            "last_seen": contact.get("last_online"),
                            "today_duration_seconds": contact.get("today_duration"),
                            "jid": self.jid
                        }
        return {}

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))