from flask import Flask, render_template, request, jsonify
import logging
import os

# Define paths relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, 
            template_folder=TEMPLATE_DIR,
            static_folder=STATIC_DIR)

# Shared state
hass_instance = None

def start_gateway(hass, client=None):
    global hass_instance
    hass_instance = hass
    # Run Flask
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/connect')
def connect():
    return "<h1>Server Connection Not Supported</h1><p>Your Home Assistant server lacks the required browser environment. Please run the connection gateway on your Windows PC.</p>"

@app.route('/api/start_connection', methods=['POST'])
def start_connection():
    return jsonify({"error": "Browser not available on this server"}), 500

@app.route('/api/check_login', methods=['GET'])
def check_login():
    return jsonify({"status": "error", "message": "Browser not available"})

@app.route('/api/messages', methods=['GET'])
def get_messages():
    return jsonify([])

@app.route('/api/account_status', methods=['GET'])
def get_account_status():
    return jsonify([{"account": "Server", "status": "online", "last_seen": "Now"}])
