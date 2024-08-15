require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const { Client } = require("ldapts");
const jwt = require("jsonwebtoken");
const https = require("https");
const fs = require("fs");

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
};

const app = express();
app.use(express.json());

const port = process.env.API_PORT || 3000;
const ipAddress = process.env.API_HOST || "localhost";

// SQL Server configuration
const config = {
  user: process.env.PARIS_USER,
  password: process.env.PARIS_PASSWORD,
  server: process.env.PARIS_HOST,
  database: process.env.PARIS_DB,
  options: {
    encrypt: false, // Use true if you're connecting to Azure SQL
    trustServerCertificate: false, // Change to false in production for better security
  },
};

// Create a pool and connect
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// LDAP configuration
const ldapConfig = {
  url: process.env.AD_SERVER,
  bindDN: `${process.env.AD_DOMAIN}\\${process.env.AD_USER}`, // AD admin user
  bindPassword: process.env.AD_PASSWORD, // AD admin password
  searchBase: process.env.AD_SEARCH_BASE || "DC=thc,DC=telrite,DC=com",
};

// Authenticate against AD and check group membership
const authenticateUser = async (username, password) => {
  const client = new Client({ url: ldapConfig.url });

  try {
    // First, bind as the user to verify credentials
    const dn = `${process.env.AD_DOMAIN}\\${username}`;
    await client.bind(dn, password);

    // Search for the user and check group membership
    const { searchBase } = ldapConfig;
    const opts = {
      scope: "sub",
      filter: `(&(sAMAccountName=${username})(${process.env.AD_FILTER}))`,
    };

    const result = await client.search(searchBase, opts);
    // console.log(result)

    await client.unbind();

    if (result.searchEntries.length === 0) {
      throw new Error("User not authorized");
    }

    return true;
  } catch (error) {
    await client.unbind();
    throw error;
  }
};

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};


// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    await authenticateUser(username, password);

    // Generate a JWT token
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRATION,
    });
    res.json({ token });
  } catch (error) {
    res.status(401).json({ message: "Invalid credentials" });
  }
});


// API endpoint to get data, optionally filtered by taskid (protected by JWT)
app.get("/", authenticateToken, async (req, res) => {
  const { taskid } = req.query;

  try {
    await poolConnect; // Ensure the pool has connected

    let result;
    if (taskid) {
      // If a taskid is provided, filter the data by taskid
      result = await pool.request()
        .query`SELECT * FROM MonitorLog WHERE taskid = ${taskid}`;
    } else {
      // If no taskid is provided, return all data
      result = await pool.request().query`SELECT * FROM MonitorLog`;
    }

    if (result.recordset.length > 0) {
      res.json(result.recordset); // Send the results as JSON
    } else {
      res.status(404).send("No data found.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});


// API endpoint to get data by status failed (protected by JWT)
app.get("/failed", authenticateToken, async (req, res) => {
  try {
    await poolConnect;

    let result = await pool.request()
      .query`SELECT * FROM MonitorLog WHERE status IS NULL`;

    if (result.recordset.length > 0) {
      res.json(result.recordset); // Send the results as JSON
    } else {
      res.status(404).send("No data found.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});


// API endpoint to get data by status completed (protected by JWT)
app.get("/completed", authenticateToken, async (req, res) => {
  try {
    await poolConnect;

    let result = await pool.request()
      .query`SELECT * FROM MonitorLog WHERE status = 'COMPLETED'`;

    if (result.recordset.length > 0) {
      res.json(result.recordset); // Send the results as JSON
    } else {
      res.status(404).send("No data found.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});


https.createServer(options, app).listen(port, ipAddress, () => {
  console.log(`Secure server running at https://${ipAddress}:${port}`);
  console.log(`Endpoinds Availables:`);
  console.log(`    * https://${ipAddress}/login         --> Login with AD`);
  console.log(`    * https://${ipAddress}/              --> All Logs`);
  console.log(`    * https://${ipAddress}?taskid=TaskID --> Logs for Specific Task`);
  console.log(`    * https://${ipAddress}/failed        --> Logs for Failed Task`);
  console.log(`    * https://${ipAddress}/completed     --> Logs for Completed Task`);
});
