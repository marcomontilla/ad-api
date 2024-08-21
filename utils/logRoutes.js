const routesDescriptions = {
  "/users/login": "Authenticate user and return JWT token",
  "/tasks/": "Get data, optionally filtered by taskid",
  "/tasks/failed": "Get tasks with a failed status",
  "/tasks/completed": "Get tasks with a completed status",
};

const cleanPath = (path) => {
  return path
    .replace(/\\\//g, "/") // Replace escaped slashes
    .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ":id") // Replace complex regex with a placeholder
    .replace(/\(\?\=\/\|\$\)/g, "") // Remove regex end conditions
    .replace(/\/\(\?:\(\?:\\\/\)\?\)/g, "/") // Remove the optional trailing slash regex
    .replace(/\^/, "") // Remove start of line caret
    .replace(/\$\/i/, "") // Remove end of line matcher
    .replace(/\?$/, "") // Remove trailing question mark
    .replace(/\/\?/, ""); // Remove optional slash and question mark
};

const logRoutes = (app) => {
  console.log("Available API Routes:");

  const getFullPath = (path, layer) => {
    return layer.route ? `${path}${layer.route.path}` : path;
  };

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // No prefix, directly attached routes
      const path = cleanPath(middleware.route.path);
      const method = middleware.route.stack[0].method.toUpperCase();
      console.log(
        `${path} - ${method} - ${routesDescriptions[path] || "No description"}`
      );
      
    } else if (middleware.name === "router") {
      // Router with a prefix
      middleware.handle.stack.forEach((handler) => {
        const routePath = getFullPath(
          middleware.regexp.source.replace("^\\/", "").replace("\\/?$", ""),
          handler
        );
        const cleanedRoutePath = cleanPath(`/${routePath}`);
        const routeMethod = handler.route ? handler.route.stack[0].method.toUpperCase() : "";
        if (cleanedRoutePath && routeMethod) {
          console.log( `${cleanedRoutePath} - ${routeMethod} - ${ routesDescriptions[cleanedRoutePath] || "No description" }` );
        }
      });
    }
  });
};

module.exports = logRoutes;
