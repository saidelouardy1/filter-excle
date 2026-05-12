import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Example API route for department list (could be fetched from Firestore on frontend instead)
  // But since user asked for backend API...
  app.get("/api/departments", (req, res) => {
    // This is just a placeholder, the frontend will likely use the Firebase SDK directly
    // for real-time updates and rules enforcement.
    res.json([
      { id: "urban", name: "Urban Planning", icon: "Map" },
      { id: "public", name: "Public Domain Occupation", icon: "TreePine" },
      { id: "complaints", name: "Complaints", icon: "MessageSquareText" },
      { id: "commercial", name: "Commercial Licenses", icon: "Store" },
      { id: "civil", name: "Civil Status", icon: "Users" },
      { id: "taxes", name: "Taxes and Fees", icon: "Receipt" },
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
