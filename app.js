require("dotenv").config();
const express = require("express");
const https = require("https");
const fs = require("fs");

const app = express();
app.use(express.json());

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
};

const port = process.env.API_PORT || 3000;
const ipAddress = process.env.API_HOST || "localhost";

// Import routes
const loginRoutes = require("./routes/login");
const tasksRoutes = require("./routes/tasks");

// Import the route logger
const logRoutes = require("./utils/logRoutes");

// Use the routes
app.use(loginRoutes); // No prefix for login
app.use("/tasks", tasksRoutes); // Prefix for all task-related routes

// Log the available routes
logRoutes(app);

https.createServer(options, app).listen(port, ipAddress, () => {
  console.log(`\nSecure server running at https://${ipAddress}:${port}`);
});
