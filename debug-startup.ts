import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./server/routes";

(async () => {
    const app = express();
    const httpServer = createServer(app);

    try {
        await registerRoutes(httpServer, app);
        console.log("✅ Routes registered successfully – server can start now.");
    } catch (err) {
        console.error("❌ registerRoutes threw an error:");
        console.error(err);
    }
})();
