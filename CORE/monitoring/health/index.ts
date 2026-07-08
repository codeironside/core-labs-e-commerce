import type { Context } from 'hono';
import { redisClient } from '../../services/cache/index.js';
import mongoose from 'mongoose';

export const healthCheckHandler = async (c: Context) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const redisStatus =
        redisClient.status === 'ready' || redisClient.status === 'connecting'
            ? 'connected'
            : 'disconnected';

    const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';
    const status = isHealthy ? 200 : 503;
    const uptime = process.uptime();
    const timestamp = new Date().toLocaleString();

    const badgeClass = (live: boolean) => (live ? 'badge-connected' : 'badge-disconnected');
    const pulseClass = (live: boolean) => (live ? 'pulse-green' : 'pulse-red');
    const label = (live: boolean) => (live ? 'live' : 'offline');



    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Flamigo | System Status</title>
        <style>
            body { font-family: 'Inter', system-ui, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: #1e293b; padding: 2.5rem; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); width: 100%; max-width: 480px; border: 1px solid #334155; }
            h1 { margin-top: 0; font-size: 1.5rem; text-align: center; color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 1.5rem; letter-spacing: 0.05em; text-transform: uppercase; }
            .status-banner { text-align: center; margin-bottom: 2rem; padding: 1rem; border-radius: 8px; font-weight: bold; font-size: 1.1rem; border: 1px solid transparent; }
            .healthy-banner { background: rgba(16,185,129,0.1); color: #34d399; border-color: rgba(16,185,129,0.2); }
            .issues-banner { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.2); }
            .status-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #334155; }
            .status-row:last-of-type { border-bottom: none; }
            .service-name { font-weight: 500; font-size: 0.95rem; display: flex; align-items: center; gap: 0.75rem; }
            .section-label { color: #64748b; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; padding: 1rem 0 0.25rem; }
            .badge { padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
            .badge-connected { background-color: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.4); box-shadow: 0 0 10px rgba(16,185,129,0.2); }
            .badge-disconnected { background-color: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.4); box-shadow: 0 0 10px rgba(239,68,68,0.2); }
            .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
            .pulse-green { background: #34d399; box-shadow: 0 0 8px #34d399; animation: pg 2s infinite; }
            .pulse-red { background: #f87171; box-shadow: 0 0 8px #f87171; animation: pr 2s infinite; }
            @keyframes pg { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } 70% { box-shadow: 0 0 0 8px rgba(52,211,153,0); } }
            @keyframes pr { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); } 70% { box-shadow: 0 0 0 8px rgba(248,113,113,0); } }
            .meta { margin-top: 2rem; font-size: 0.85rem; color: #64748b; text-align: center; line-height: 1.8; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>CORE LABS E-COMMERCE</h1>
            <div class="status-banner ${isHealthy ? 'healthy-banner' : 'issues-banner'}">
                ${isHealthy ? 'ALL SYSTEMS OPERATIONAL 🦩' : 'SYSTEM DEGRADED ⚠️'}
            </div>

            <div class="section-label">Infrastructure</div>
            <div class="status-row">
                <span class="service-name"><span class="pulse ${mongoStatus === 'connected' ? 'pulse-green' : 'pulse-red'}"></span>MongoDB Primary</span>
                <span class="badge ${badgeClass(mongoStatus === 'connected')}">${mongoStatus}</span>
            </div>
            <div class="status-row">
                <span class="service-name"><span class="pulse ${redisStatus === 'connected' ? 'pulse-green' : 'pulse-red'}"></span>Redis Cache</span>
                <span class="badge ${badgeClass(redisStatus === 'connected')}">${redisStatus}</span>
            </div>

            <div class="meta">
                <div>UPTIME // ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s</div>
                <div>LAST PING // ${timestamp}</div>
            </div>
        </div>
    </body>
    </html>`;

    return c.html(html, status);
};
