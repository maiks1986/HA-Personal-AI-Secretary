# WhatsApp Integration for Home Assistant & Web Client

This project provides a comprehensive solution for integrating WhatsApp with Home Assistant, complete with a custom Web UI for managing chats and leveraging AI for smart replies.

## Overview

The system consists of two main components:
1.  **Home Assistant Custom Component (`whatsapp_hass`):** A custom integration for Home Assistant that automates WhatsApp Web using Selenium. It allows you to send messages via Home Assistant services and forwards received messages to the Web UI.
2.  **Web UI (`whatsapp_ui`):** A Flask-based web application that serves as a dashboard for your WhatsApp chats. It stores message history, manages account statuses, and integrates with Google's Gemini AI to suggest smart replies.

## Features

*   **Home Assistant Integration:**
    *   Send WhatsApp messages using the `whatsapp_hass.send_message` service.
    *   Automated browser management (Selenium/WebDriver).
*   **Web Dashboard:**
    *   View chat history and active account statuses.
    *   Real-time message updates via webhooks.
    *   User-friendly interface for managing settings.
*   **AI-Powered Suggestions:**
    *   Integrates with Google Gemini API (`gemini-2.0-flash-exp`) to generate context-aware reply suggestions for your conversations.
*   **Message History:**
    *   Local SQLite database to store and retrieve message logs.
    *   Support for bulk history upload from the integration.

## Installation & Setup

### 1. Home Assistant Integration

1.  Copy the `custom_components/whatsapp_hass` directory to your Home Assistant's `custom_components` folder.
    *   Final path should look like: `/config/custom_components/whatsapp_hass/`
2.  Restart Home Assistant.
3.  The integration should now be loaded. (Note: Further configuration via HA UI or YAML might be required depending on the implementation details in `config_flow.py`).

### 2. Web UI Application

1.  Navigate to the `whatsapp_ui` directory.
2.  Install the required Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Run the Flask application:
    ```bash
    python app.py
    ```
4.  The application will start on `http://0.0.0.0:5001`.

## Configuration

Once the Web UI is running, navigate to the **Settings** page (e.g., `http://localhost:5001/settings`) to configure the connection:

*   **Home Assistant URL:** The base URL of your Home Assistant instance (e.g., `http://192.168.1.10:8123`).
*   **Home Assistant Token:** A Long-Lived Access Token created in your Home Assistant profile.
*   **Gemini API Key:** Your Google Gemini API key for enabling AI reply suggestions.

## Usage

### Sending Messages from Home Assistant
You can use the `whatsapp_hass.send_message` service in Home Assistant automations or scripts.
```yaml
service: whatsapp_hass.send_message
data:
  sender: "Your Profile Name"
  contact: "Contact Name"
  message: "Hello from Home Assistant!"
```

### Using the Web UI
*   **Dashboard:** View incoming messages and active chats.
*   **Reply:** Click on a chat to view details and use the suggested AI replies to respond quickly.