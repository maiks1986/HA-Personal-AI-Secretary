"""Sensor platform for WhatsApp Pro."""
import logging
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities):
    """Set up the sensor platform."""
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
            
            # Instance Status Sensor
            instance_key = f"instance_status_{instance_id}"
            if instance_key not in added_jids:
                new_entities.append(WhatsAppInstanceSensor(coordinator, instance_id, instance_name))
                added_jids.add(instance_key)

            # Contact Last Messaged Sensors
            for contact in tracked_contacts:
                jid = contact["jid"]
                
                # Sent
                sent_key = f"{instance_id}_{jid}_last_sent"
                if sent_key not in added_jids:
                    new_entities.append(WhatsAppLastMessageSentSensor(coordinator, instance_id, instance_name, contact))
                    added_jids.add(sent_key)
                
                # Received
                received_key = f"{instance_id}_{jid}_last_received"
                if received_key not in added_jids:
                    new_entities.append(WhatsAppLastMessageReceivedSensor(coordinator, instance_id, instance_name, contact))
                    added_jids.add(received_key)
        
        if new_entities:
            async_add_entities(new_entities)

    # Register listener
    entry.async_on_unload(coordinator.async_add_listener(async_discover_sensors))
    
    # Initial discovery
    async_discover_sensors()

class WhatsAppInstanceSensor(SensorEntity):
>>>>>>> REPLACE
<<<<<<< SEARCH
class WhatsAppLastMessagedSensor(SensorEntity):
    """Representation of Last Outbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        
        self._attr_name = f"Last Messaged {self._contact_name}"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_messaged"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:history"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
    def state(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return contact.get("last_outbound_timestamp")
        return None

    @property
    def extra_state_attributes(self):
        return {
            "jid": self.jid,
            "friendly_name": f"Last Messaged {self._contact_name}"
        }

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))
=======
class WhatsAppLastMessageSentSensor(SensorEntity):
    """Representation of Last Outbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        jid_prefix = self.jid.split("@")[0]
        
        self._attr_name = f"{self._contact_name} Last Message Sent"
        self.entity_id = f"sensor.wa_last_message_sent_{jid_prefix}"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_sent"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:message-arrow-right"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
>>>>>>> REPLACE
<<<<<<< SEARCH
class WhatsAppLastMessageReceivedSensor(SensorEntity):
    """Representation of Last Inbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        
        self._attr_name = f"{self._contact_name} Last Message Received"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_received"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:message-arrow-left"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
=======
class WhatsAppLastMessageReceivedSensor(SensorEntity):
    """Representation of Last Inbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        jid_prefix = self.jid.split("@")[0]
        
        self._attr_name = f"{self._contact_name} Last Message Received"
        self.entity_id = f"sensor.wa_last_message_received_{jid_prefix}"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_received"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:message-arrow-left"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
    def native_value(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return contact.get("last_outbound_timestamp")
        return None

    @property
    def extra_state_attributes(self):
        return {
            "jid": self.jid,
            "contact_name": self._contact_name
        }

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))

class WhatsAppLastMessageReceivedSensor(SensorEntity):
    """Representation of Last Inbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        
        self._attr_name = f"{self._contact_name} Last Message Received"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_received"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:message-arrow-left"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
    def native_value(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return contact.get("last_inbound_timestamp")
        return None

    @property
    def extra_state_attributes(self):
        return {
            "jid": self.jid,
            "contact_name": self._contact_name
        }

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))
    """Representation of a WhatsApp Instance Status sensor."""

    def __init__(self, coordinator, instance_id, instance_name):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self._instance_name = instance_name
        self._attr_name = f"WhatsApp {instance_name} Status"
        self._attr_unique_id = f"whatsapp_{instance_id}_status"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
            "name": f"WhatsApp {instance_name}",
            "manufacturer": "Gemini Ecosystem",
        }

    @property
    def state(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return inst["status"]
        return "unknown"

    @property
    def extra_state_attributes(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                return {
                    "presence": inst.get("presence", "unknown"),
                    "instance_id": self.instance_id
                }
        return {}

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class WhatsAppLastMessagedSensor(SensorEntity):
    """Representation of Last Outbound Message timestamp."""

    def __init__(self, coordinator, instance_id, instance_name, contact_data):
        self.coordinator = coordinator
        self.instance_id = instance_id
        self.jid = contact_data["jid"]
        self._contact_name = contact_data.get("name") or self.jid.split("@")[0]
        
        self._attr_name = f"Last Messaged {self._contact_name}"
        self._attr_unique_id = f"whatsapp_{instance_id}_{self.jid}_last_messaged"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = "mdi:history"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"instance_{instance_id}")},
        }

    @property
    def state(self):
        for inst in self.coordinator.data:
            if inst["id"] == self.instance_id:
                for contact in inst.get("tracked", []):
                    if contact["jid"] == self.jid:
                        return contact.get("last_outbound_timestamp")
        return None

    @property
    def extra_state_attributes(self):
        return {
            "jid": self.jid,
            "friendly_name": f"Last Messaged {self._contact_name}"
        }

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))