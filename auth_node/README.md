# Identity Gate (Auth Node)

## Overview
The Identity Gate is the centralized Authentication & Authorization service for the Personal Secretary ecosystem. It manages users, issues JWTs, and provides a unified login interface.

## Features
*   **User Management:** SQLite-based user database.
*   **Authentication:** Password-based login with Bcrypt hashing.
*   **Authorization:** RBAC (Role-Based Access Control) via Signed JWTs.
*   **UI:** React-based login portal.

## Development

### Prerequisites
*   Node.js v20+
*   NPM

### Setup
1.  Install dependencies:
    ```bash
    npm install
    cd frontend && npm install
    ```

2.  Run Backend (Dev):
    ```bash
    npm run dev
    ```

3.  Run Frontend (Dev):
    ```bash
    cd frontend
    npm run dev
    ```

## Configuration
See `config.yaml` for Home Assistant specific options.
