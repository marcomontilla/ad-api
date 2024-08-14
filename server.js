require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const ldap = require("ldapjs");
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

// Authenticate against AD
const authenticateUser = (username, password) => {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: process.env.AD_SERVER });
    const dn = `${process.env.AD_DOMAIN}\\${username}`;

    client.bind(dn, password, (err) => {
      client.unbind(); // Unbind after authentication
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
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
  console.log(req.query);
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
});
