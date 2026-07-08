import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readServiceDoc(relativePath: string): string {
    try {
        const filePath = join(__dirname, '../../../', relativePath);
        return readFileSync(filePath, 'utf-8');
    } catch {
        return '# Documentation not found\n\nThis service does not have a doc file yet.';
    }
}

function renderSwaggerShell(asset: { css: string[]; js: string[] }) {
    const swaggerConfig = {
        url: '/openapi.json',
        docExpansion: 'list',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        defaultModelRendering: 'example',
        tryItOutEnabled: true,
    };

    return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Flamigo API documentation" />
    <title>Flamigo API Docs</title>
    ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`).join('')}
    <style>
      :root {
        --bg: #0b1020;
        --bg-soft: #121933;
        --panel: rgba(15, 23, 42, 0.82);
        --panel-border: rgba(148, 163, 184, 0.18);
        --text: #e5eefb;
        --muted: #9db0d1;
        --pink: #ff4fa3;
        --purple: #8b5cf6;
        --cyan: #22d3ee;
        --blue: #3b82f6;
        --green: #34d399;
        --shadow: 0 20px 50px rgba(2, 8, 23, 0.45);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 28%),
          radial-gradient(circle at top right, rgba(139, 92, 246, 0.24), transparent 32%),
          radial-gradient(circle at bottom center, rgba(255, 79, 163, 0.16), transparent 26%),
          linear-gradient(180deg, #0a1022 0%, #0c1226 100%);
      }

      a { color: inherit; text-decoration: none; }

      .docs-shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 28px 20px 48px;
      }

      .hero {
        position: relative;
        overflow: hidden;
        margin-bottom: 24px;
        padding: 28px;
        border: 1px solid var(--panel-border);
        border-radius: 28px;
        background:
          linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(139, 92, 246, 0.18) 48%, rgba(255, 79, 163, 0.18)),
          rgba(15, 23, 42, 0.82);
        box-shadow: var(--shadow);
      }

      .hero::after {
        content: "";
        position: absolute;
        inset: auto -8% -55% auto;
        width: 300px;
        height: 300px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(34, 211, 238, 0.35), transparent 62%);
        pointer-events: none;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #c7d7f6;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero h1 {
        margin: 16px 0 10px;
        font-size: clamp(32px, 5vw, 54px);
        line-height: 1.02;
      }

      .hero p {
        max-width: 880px;
        margin: 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.65;
      }

      .hero-links, .quick-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .pill-link, .quick-card {
        border: 1px solid rgba(255, 255, 255, 0.12);
        transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
      }

      .pill-link {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.07);
        color: #f5f8ff;
        font-size: 14px;
      }

      .pill-link:hover, .quick-card:hover {
        transform: translateY(-1px);
        border-color: rgba(34, 211, 238, 0.5);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 20px;
        margin-bottom: 24px;
      }

      .quick-links-panel,
      .swagger-panel {
        border: 1px solid var(--panel-border);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .quick-links-panel {
        grid-column: span 4;
        padding: 22px;
      }

      .swagger-panel {
        grid-column: span 8;
      }

      .section-title {
        margin: 0 0 8px;
        font-size: 20px;
      }

      .section-copy {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }

      .quick-links {
        margin-top: 0;
        display: grid;
        grid-template-columns: 1fr;
      }

      .quick-card {
        display: block;
        padding: 16px 18px;
        border-radius: 18px;
        background:
          linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.08)),
          rgba(255, 255, 255, 0.03);
      }

      .quick-card strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
      }

      .quick-card span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .swagger-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--panel-border);
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
      }

      .swagger-toolbar strong {
        font-size: 15px;
      }

      .swagger-toolbar span {
        color: var(--muted);
        font-size: 13px;
      }

      #swagger-ui {
        background: transparent;
      }

      .swagger-ui {
        color: #0f172a;
      }

      .swagger-ui .topbar {
        display: none;
      }

      .swagger-ui .info {
        margin: 24px;
      }

      .swagger-ui .info .title {
        color: #0f172a;
      }

      .swagger-ui .scheme-container {
        background: rgba(255, 255, 255, 0.9);
        box-shadow: none;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.25);
      }

      .swagger-ui .opblock-tag {
        border-bottom-color: rgba(148, 163, 184, 0.25);
      }

      .swagger-ui .opblock.opblock-post {
        border-color: rgba(236, 72, 153, 0.35);
        background: rgba(252, 231, 243, 0.55);
      }

      .swagger-ui .opblock.opblock-get {
        border-color: rgba(34, 197, 94, 0.35);
        background: rgba(220, 252, 231, 0.55);
      }

      .swagger-ui .opblock.opblock-patch {
        border-color: rgba(168, 85, 247, 0.35);
        background: rgba(245, 243, 255, 0.7);
      }

      .swagger-ui .btn.authorize {
        border-color: var(--purple);
        color: var(--purple);
      }

      .swagger-ui .btn.execute {
        background: linear-gradient(135deg, var(--blue), var(--purple));
        border-color: transparent;
      }

      .swagger-ui .tab li button.tablinks.active {
        color: var(--purple);
      }

      @media (max-width: 1080px) {
        .quick-links-panel,
        .swagger-panel {
          grid-column: span 12;
        }
      }
    </style>
  </head>
  <body>
    <div class="docs-shell">
      <section class="hero">
        <div class="eyebrow">Flamigo API Docs</div>
        <h1>Interactive, colorful API docs for product, media, orders, and livestream flows.</h1>
        <p>
          Explore the full OpenAPI spec, test endpoints directly, and jump into the vendor product workflow.
          The media upload flow is documented separately so vendors can upload images first, then create products with saved media asset ids.
        </p>
        <div class="hero-links">
          <a class="pill-link" href="/docs/service/products-upload-media">Media Upload Guide</a>
          <a class="pill-link" href="/docs/service/products-create">Create Product Guide</a>
          <a class="pill-link" href="/docs/service/products-update">Update Product Guide</a>
          <a class="pill-link" href="/openapi.json">Raw OpenAPI JSON</a>
        </div>
      </section>

      <section class="grid">
        <aside class="quick-links-panel">
          <h2 class="section-title">Vendor Product Flow</h2>
          <p class="section-copy">
            Use these docs in order for the cleanest vendor experience.
          </p>
          <div class="quick-links">
            <a class="quick-card" href="/docs/service/products-upload-media">
              <strong>1. Upload Media Assets</strong>
              <span>Upload one or more product images, then optional 3D assets and poster images.</span>
            </a>
            <a class="quick-card" href="/docs/service/products-create">
              <strong>2. Create Product</strong>
              <span>Create the product with the uploaded mediaAssetIds and choose the primary media asset.</span>
            </a>
            <a class="quick-card" href="/docs/service/products-update">
              <strong>3. Update Product</strong>
              <span>Attach new uploaded assets later, remove old media, and keep at least one image on the product.</span>
            </a>
            <a class="quick-card" href="/docs/service/products-fetch-vendor">
              <strong>4. Vendor Product Listing</strong>
              <span>Review the vendor-facing product listing and saved media shape.</span>
            </a>
          </div>
        </aside>

        <section class="swagger-panel">
          <div class="swagger-toolbar">
            <div>
              <strong>Swagger Explorer</strong>
              <span>Interactive requests, examples, auth, and schema inspection</span>
            </div>
          </div>
          <div id="swagger-ui"></div>
        </section>
      </section>
    </div>
    ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"><\/script>`).join('')}
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          dom_id: '#swagger-ui',
          url: ${JSON.stringify(swaggerConfig.url)},
          docExpansion: ${JSON.stringify(swaggerConfig.docExpansion)},
          deepLinking: ${String(swaggerConfig.deepLinking)},
          persistAuthorization: ${String(swaggerConfig.persistAuthorization)},
          displayRequestDuration: ${String(swaggerConfig.displayRequestDuration)},
          defaultModelRendering: ${JSON.stringify(swaggerConfig.defaultModelRendering)},
          tryItOutEnabled: ${String(swaggerConfig.tryItOutEnabled)}
        })
      }
    <\/script>
  </body>
</html>
    `;
}

export const setupDocs = (app: OpenAPIHono) => {
    // OpenAPI JSON spec — auto-populated by createRoute() on all routers
    app.doc('/openapi.json', {
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'Flamigo API',
            description:
                'Enterprise-grade REST API for the Flamigo platform. Covers Authentication (OAuth + 2FA), User Account Management, Role-Based Access Control, and Modular Notifications (Email, SMS, WhatsApp, Push).',
        },
        tags: [
            { name: 'Auth — Registration', description: 'User registration and email verification' },
            { name: 'Auth — Login', description: 'Local and admin authentication' },
            { name: 'Auth — Password', description: 'Password reset and management' },
            { name: 'Auth — OAuth', description: 'OAuth provider initiation and callback flows' },
            { name: 'Users — Profile', description: 'Authenticated user profile read/write' },
            { name: 'Users — Role Requests', description: 'Standard user role upgrade requests' },
            { name: 'Users — Admin', description: 'Admin-only user and role management' },
            { name: 'Products', description: 'Public product discovery, search, and product detail endpoints' },
            {
                name: 'Products — Vendor',
                description:
                    'Vendor product management, including media asset uploads, product creation, updates, and vendor-owned product listings',
            },
            { name: 'Orders', description: 'Order creation, payment, verification, and order history' },
            { name: 'Livestreams', description: 'Livestream creation, participation, auctions, and realtime interactions' },
            { name: 'Platform', description: 'Platform configuration and payment capability endpoints' },
            { name: 'Roles', description: 'Role CRUD (admin)' },
        ],
    });

    // Swagger UI
    app.get(
        '/docs',
        swaggerUI({
            title: 'Flamigo API Docs',
            url: '/openapi.json',
            manuallySwaggerUIHtml: renderSwaggerShell,
        }),
    );

    // Serve individual service doc/index.md files as raw markdown
    const serviceDocMap: Record<string, string> = {
        'auth-register': 'API/AUTH/services/register.local/doc/index.md',
        'auth-verify-email': 'API/AUTH/services/verify.email/doc/index.md',
        'auth-login': 'API/AUTH/services/login.local/doc/index.md',
        'auth-admin-login': 'API/AUTH/services/admin.login/doc/index.md',
        'auth-password': 'API/AUTH/services/password.management/doc/index.md',
        'auth-init': 'API/AUTH/services/init.oauth/doc/index.md',
        'auth-callback': 'API/AUTH/services/oauth.callback/doc/index.md',
        'users-update-profile': 'API/USERS/services/update.profile/doc/index.md',
        'users-fetch-profile': 'API/USERS/services/fetch.profile/doc/index.md',
        'users-fetch-users': 'API/USERS/services/fetch.users/doc/index.md',
        'users-role-request': 'API/USERS/services/request.role.change/doc/index.md',
        'users-admin-roles': 'API/USERS/services/admin.manage.roles/doc/index.md',
        'users-payout-preference': 'API/USERS/services/update.payout.preference/doc/index.md',
        'products-upload-media': 'API/PRODUCTS/services/upload.product.media/doc/index.md',
        'products-create': 'API/PRODUCTS/services/create.product/doc/index.md',
        'products-update': 'API/PRODUCTS/services/update.product/doc/index.md',
        'products-fetch-one': 'API/PRODUCTS/services/fetch.product/doc/index.md',
        'products-fetch-many': 'API/PRODUCTS/services/fetch.products/doc/index.md',
        'products-fetch-vendor': 'API/PRODUCTS/services/fetch.vendor.products/doc/index.md',
        'orders-pay': 'API/ORDERS/services/pay.order/doc/index.md',
        'orders-verify-crypto': 'API/ORDERS/services/verify.crypto/doc/index.md',
    };

    app.get('/docs/service/:name', (c) => {
        const name = c.req.param('name');
        const filePath = serviceDocMap[name];
        if (!filePath) {
            return c.text('Service documentation not found', 404);
        }
        const content = readServiceDoc(filePath);
        return c.text(content, 200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    });
};
