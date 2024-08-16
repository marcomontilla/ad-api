const express = require("express");
const { Client } = require("ldapts");
const jwt = require("jsonwebtoken");
const router = express.Router();

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
      filter: `(&(sAMAccountName=${username})(memberOf:1.2.840.113556.1.4.1941:=CN=BusinessProcessing,OU=RoleGroups,OU=RBAC,DC=thc,DC=telrite,DC=com))`,
    };

    const result = await client.search(searchBase, opts);

    await client.unbind();

    if (result.searchEntries.length === 0) {
      throw new Error("User is not authorized to access this system");
    }

    return true;
  } catch (error) {
    await client.unbind();
    throw error;
  }
};

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    await authenticateUser(username, password);

    // Generate a JWT token
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRATION,
    });

    // Optionally set token in a cookie
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(401).json({ message: error.message || "Invalid credentials or unauthorized access" });
  }
});

module.exports = router;
