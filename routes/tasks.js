const express = require("express");
const sql = require("mssql");
const jwt = require("jsonwebtoken");

const router = express.Router();

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

// API endpoint to get data, optionally filtered by taskid (protected by JWT)
router.get("/", authenticateToken, async (req, res) => {
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
router.get("/failed", authenticateToken, async (req, res) => {
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
router.get("/completed", authenticateToken, async (req, res) => {
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

// API endpoint to get data, optionally filtered by taskid (protected by JWT)
router.get("/:brand", authenticateToken, async (req, res) => {
  const { brand } = req.params;

  try {
    await poolConnect; // Ensure the pool has connected

    let result;
    result = await pool.request()
      .query`SELECT * FROM MonitorLog WHERE brand = ${brand}`;

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

module.exports = router;
