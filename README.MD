# AD-API

## Overview

This project is designed to sign with AD and access to a MS SQL database. For security reasons, certain files such as `.env` and SSL certificates are not included in the repository and need to be set up manually.

## Prerequisites

- [Install Node.js](https://nodejs.org/) (version x.x.x or later)
- [Install Git](https://git-scm.com/)

## Setting Up Environment Variables

The project requires a `.env` file that contains sensitive credentials and configuration variables. This file should be placed at the root of your project directory.

### Example `.env` file

Create a `.env` file with the following content:

```plaintext
# Database configuration (You can replace the PARIS key word)
PARIS_USER=your-database-host
PARIS_PASSWORD=your-database-username
PARIS_HOST=your-database-password
PARIS_DB=your-database-name

# Active Directory configuration
AD_SERVER=your-active-directory-url
AD_BASE_DN=your-base-dn
AD_DOMAIN=your-bind-password

# JWT Secret
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=your-jwt-timeout (e.g. 1h)

# Other configuration variables
API_HOST=your-api
API_PORT=your-port
```

Replace the placeholder values (`your-database-host`, `your-jwt-secret`, etc.) with your actual configuration.

## Generating Self-Signed SSL Certificates

To secure the application with HTTPS, you need SSL certificates. Follow these steps to generate self-signed certificates:

1. Open a terminal and navigate to the directory where you want to store the certificates (usually outside the project directory).

2. Run the following command to generate a self-signed certificate:

   ```bash
   openssl req -nodes -new -x509 -keyout server.key -out server.cert
   ```

3. You'll be prompted to enter information such as your country, state, and organization. Fill these out as needed.

4. Once the command completes, you'll have two files: `server.key` (the private key) and `server.cert` (the certificate).

5. Move these files to a secure location outside of your project repository, and update your server configuration to point to these files.

### Configuring the Certificates

Ensure your server configuration references the correct paths to your `server.key` and `server.cert` files. For example, in your Node.js server setup:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/your/server.key'),
  cert: fs.readFileSync('/path/to/your/server.cert')
};

https.createServer(options, app).listen(process.env.PORT || 443, () => {
  console.log('Server is running on https://localhost:' + (process.env.PORT || 443));
});
```

## Creating the JWT Secret

The JWT secret is used to sign and verify JSON Web Tokens (JWTs) for authentication. You can generate a secure random secret using Node.js:

1. Open a Node.js REPL or create a small script:

   ```javascript
   require('crypto').randomBytes(64).toString('hex');
   ```

2. Run the script to generate a 64-byte hexadecimal string.

3. Copy the output and use it as the value for `JWT_SECRET` in your `.env` file.

## Running the Application

Once you've set up the environment variables and SSL certificates, you can start the application with the following commands:

```bash
npm install
npm start
```

## Additional Notes

- **.gitignore:** Ensure that your `.env` file and SSL certificates are included in your `.gitignore` file to prevent them from being accidentally committed to the repository.

- **Environment Management:** Consider using a tool like `dotenv` to manage your environment variables or explore secure environment management solutions for production.
