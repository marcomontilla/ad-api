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
  // First, check the cookies for the token
  const tokenFromCookie = req.cookies && req.cookies.token;

  // If no token in cookies, check the headers
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];

  // Determine which token to use
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Reusable function for querying the database
const queryDatabase = async (query, res) => {
  try {
    await poolConnect; // Ensure the pool has connected
    const result = await query;
    if (result.recordset.length > 0) {
      res.json(result.recordset); // Send the results as JSON
    } else {
      res.status(404).send("No data found.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
};

// API endpoint to get data, optionally filtered by taskid (protected by JWT)
router.get("/", authenticateToken, async (req, res) => {
  const { taskid } = req.query;
  const query = taskid
    ? pool
        .request()
        .input("taskid", sql.Int, taskid)
        .query("SELECT * FROM MonitorLog WHERE taskid = @taskid")
    : pool.request().query("SELECT * FROM MonitorLog");

  await queryDatabase(query, res);
});

// API endpoint to get data by status failed (protected by JWT)
router.get("/failed", authenticateToken, async (req, res) => {
  const query = pool
    .request()
    .query("SELECT * FROM MonitorLog WHERE status IS NULL");
  await queryDatabase(query, res);
});

// API endpoint to get data by status completed (protected by JWT)
router.get("/completed", authenticateToken, async (req, res) => {
  const query = pool
    .request()
    .query("SELECT * FROM MonitorLog WHERE status = 'COMPLETED'");
  await queryDatabase(query, res);
});

// API endpoint to get data filtered by brand (protected by JWT)
router.get("/:brand", authenticateToken, async (req, res) => {
  const { brand } = req.params;
  const query = pool
    .request()
    .input("brand", sql.VarChar, brand)
    .query("SELECT * FROM MonitorLog WHERE brand = @brand");

  await queryDatabase(query, res);
});

module.exports = router;
