# n8n-nodes-one-key-hub

This is an n8n community node for **One Key Hub**, allowing you to manage API Keys, Providers, and perform Unified Chat Completions directly within your n8n workflows.

[One Key Hub Project](https://github.com/your-repo/one-key-hub)

## Features

*   **Chat**: Unified Chat Completions (OpenAI Compatible).
*   **Providers**: Manage AI Providers (Create, Update, Delete, List).
*   **API Keys**: Manage Provider API Keys (Create, Update, Delete, List, **Test**).
*   **Unified Keys**: Manage Unified Access Keys.

---

## Installation

### Option 1: Install from npm (Recommended for Production)

Once this package is published to npm, you can install it directly via the n8n interface.

1.  Open your n8n instance.
2.  Go to **Settings** > **Community Nodes**.
3.  Click **Install**.
4.  Enter the package name: `n8n-nodes-one-key-hub` (or your published package name).
5.  Click **Install**.

### Option 2: Manual Installation (For Development)

If you have access to the server running n8n:

1.  Go to your n8n root directory (usually `~/.n8n`).
2.  Create a `custom` folder if it doesn't exist (or use `nodes` folder inside `.n8n`).
3.  Install the package:
    ```bash
    npm install n8n-nodes-one-key-hub
    ```
4.  Restart n8n.

---

## How to Publish to npm (For Developers)

To make this node available to the public via the Community Nodes feature, you need to publish it to the npm registry.

### Prerequisites
*   An [npm account](https://www.npmjs.com/).
*   Node.js and npm installed.

### Steps

1.  **Login to npm**
    ```bash
    npm login
    ```

2.  **Build the Project**
    Make sure the code is compiled and assets are copied.
    ```bash
    npm run build
    ```

3.  **Update Version**
    Before publishing updates, always increment the version number in `package.json`.
    ```bash
    npm version patch  # 0.0.1 -> 0.0.2
    ```

4.  **Publish**
    ```bash
    npm publish --access public
    ```

Once published, it will be indexed by n8n (may take up to a few hours) and installable via the Community Nodes panel using the package name.

---

## Usage

### Credentials
1.  Add a new Credential in n8n: **One Key Hub API**.
2.  **Base URL**: Enter your One Key Hub API URL (e.g., `http://localhost:3000/api` or your deployed domain).
3.  **Access Token**: Enter your JWT Token (for Admin actions) or Unified Key.

### Operations
*   **Test API Key**: Use the `API Key` resource -> `Test` operation to verify key validity and check for errors (Rate Limit, Invalid Token, etc.).
*   **Loop & Check**: Combine `Get All` API Keys with `Split In Batches` and `Test` to build a monitoring workflow.
