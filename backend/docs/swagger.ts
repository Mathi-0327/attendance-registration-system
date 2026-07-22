/**
 * @file backend/docs/swagger.ts
 * @description Swagger / OpenAPI 3.0 specification and middleware setup.
 * Mounts interactive API docs at /api/docs.
 */

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AttendReg Enterprise API",
      version: "2.0.0",
      description:
        "Enterprise-grade Smart Attendance & Academic Management Platform API. " +
        "Supports multi-role authentication, face recognition, AI insights, " +
        "reports, audit logging, and real-time notifications.",
      contact: {
        name: "AttendReg Support",
        email: "support@attendreg.app",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token in the format: **Bearer &lt;token&gt;**",
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────
        LoginRequest: {
          type: "object",
          required: ["identifier", "password"],
          properties: {
            identifier: { type: "string", example: "admin@attendreg.app" },
            password: { type: "string", format: "password", example: "P@ssw0rd123!" },
            rememberMe: { type: "boolean", default: false },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: { $ref: "#/components/schemas/AuthUser" },
          },
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "integer" },
            email: { type: "string" },
            name: { type: "string" },
            roles: { type: "array", items: { type: "string" } },
          },
        },
        // ── Attendance ────────────────────────────────────
        AttendanceRecord: {
          type: "object",
          properties: {
            id: { type: "integer" },
            sessionId: { type: "integer" },
            studentId: { type: "string" },
            name: { type: "string" },
            department: { type: "string", nullable: true },
            status: { type: "string", enum: ["present", "late", "absent", "excused"] },
            ipAddress: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        AttendanceSession: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            isActive: { type: "boolean" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time", nullable: true },
            authorizedIp: { type: "string", nullable: true },
          },
        },
        // ── Audit ─────────────────────────────────────────
        AuditLog: {
          type: "object",
          properties: {
            id: { type: "integer" },
            userId: { type: "integer", nullable: true },
            userEmail: { type: "string", nullable: true },
            action: { type: "string", example: "UPDATE_SETTINGS" },
            resource: { type: "string", example: "system_settings" },
            resourceId: { type: "string", nullable: true },
            ipAddress: { type: "string" },
            severity: { type: "string", enum: ["info", "warning", "critical"] },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        // ── AI ────────────────────────────────────────────
        PredictionResult: {
          type: "object",
          properties: {
            studentId: { type: "string" },
            currentRate: { type: "number" },
            projectedRate: { type: "number" },
            dropoutRisk: { type: "string", enum: ["none", "low", "medium", "high", "critical"] },
            trend: { type: "string", enum: ["improving", "stable", "declining"] },
          },
        },
        // ── Error ─────────────────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication and token management" },
      { name: "Attendance", description: "Attendance submission and session management" },
      { name: "Dashboard", description: "Role-specific dashboard aggregations" },
      { name: "AI", description: "Predictive analytics and AI insights" },
      { name: "Reports", description: "Custom report generation and export" },
      { name: "Settings", description: "User and system configuration" },
      { name: "Audit", description: "Persistent audit log access" },
      { name: "Academic", description: "Courses, subjects, and timetables" },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Authenticate user",
          description: "Returns JWT access + refresh tokens for valid credentials.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
            },
          },
          responses: {
            200: {
              description: "Login successful",
              content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
            },
            401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["refreshToken"],
                  properties: { refreshToken: { type: "string" } },
                },
              },
            },
          },
          responses: {
            200: { description: "New access token issued" },
            401: { description: "Invalid or expired refresh token" },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Revoke refresh token and log out",
          responses: {
            200: { description: "Logged out successfully" },
          },
        },
      },
      // ── Attendance ────────────────────────────────────────────────────
      "/attendance": {
        get: {
          tags: ["Attendance"],
          summary: "Get all attendance records",
          responses: {
            200: {
              description: "List of records",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      records: { type: "array", items: { $ref: "#/components/schemas/AttendanceRecord" } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Attendance"],
          summary: "Submit attendance (Wi-Fi IP check)",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "studentId"],
                  properties: {
                    name: { type: "string" },
                    studentId: { type: "string" },
                    department: { type: "string" },
                    deviceId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Attendance recorded" },
            403: { description: "No active session or IP mismatch" },
            409: { description: "Duplicate attendance" },
          },
        },
      },
      "/session/toggle": {
        post: {
          tags: ["Attendance"],
          summary: "Start or stop an attendance session",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { name: { type: "string", example: "CSE-A Morning Session" } },
                },
              },
            },
          },
          responses: {
            200: { description: "Session toggled", content: { "application/json": { schema: { $ref: "#/components/schemas/AttendanceSession" } } } },
          },
        },
      },
      // ── Dashboard ─────────────────────────────────────────────────────
      "/dashboard/student": {
        get: {
          tags: ["Dashboard"],
          summary: "Student-specific attendance stats",
          responses: { 200: { description: "Student dashboard data" } },
        },
      },
      "/dashboard/faculty": {
        get: {
          tags: ["Dashboard"],
          summary: "Faculty session and class stats",
          responses: { 200: { description: "Faculty dashboard data" } },
        },
      },
      "/dashboard/hod": {
        get: {
          tags: ["Dashboard"],
          summary: "HOD department overview",
          responses: { 200: { description: "HOD dashboard data" } },
        },
      },
      // ── AI ────────────────────────────────────────────────────────────
      "/ai/predict": {
        get: {
          tags: ["AI"],
          summary: "Get attendance predictions for students",
          responses: {
            200: {
              description: "Prediction results",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      predictions: { type: "array", items: { $ref: "#/components/schemas/PredictionResult" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/ai/insights": {
        get: {
          tags: ["AI"],
          summary: "Get AI-generated narrative insights",
          responses: { 200: { description: "Markdown insights from Gemini or local fallback" } },
        },
      },
      "/ai/chat": {
        post: {
          tags: ["AI"],
          summary: "Chat with the AI attendance advisor",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: { message: { type: "string", example: "Who is at risk of dropping out?" } },
                },
              },
            },
          },
          responses: { 200: { description: "AI response" } },
        },
      },
      // ── Audit ─────────────────────────────────────────────────────────
      "/audit/logs": {
        get: {
          tags: ["Audit"],
          summary: "Get recent audit log entries",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          ],
          responses: {
            200: {
              description: "Audit logs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      logs: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // ── Settings ──────────────────────────────────────────────────────
      "/settings/global": {
        get: {
          tags: ["Settings"],
          summary: "Get all system settings",
          responses: { 200: { description: "Settings key-value map" } },
        },
        put: {
          tags: ["Settings"],
          summary: "Update system settings",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { 200: { description: "Settings updated" } },
        },
      },
    },
  },
  apis: [], // Using inline paths above; no file scanning needed
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Mount the Swagger UI at /api/docs on the given Express app.
 */
export function setupSwagger(app: Express) {
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "AttendReg API Docs",
      customCss: `
        .swagger-ui .topbar { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
        .swagger-ui .topbar-wrapper img { content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'); height: 32px; }
        .swagger-ui .info .title { color: #60a5fa; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        tagsSorter: "alpha",
      },
    })
  );

  // Raw JSON spec endpoint
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("[swagger] API docs available at /api/docs");
}
