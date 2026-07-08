import type { OpenAPIHono } from '@hono/zod-openapi';
import { productsRouter } from '../../API/PRODUCTS/routes/index.js';
import { livestreamsRouter } from '../../API/LIVESTREAMS/routes/index.js';
import { liveAlertsRouter } from '../../API/LIVE_ALERTS/routes/index.js';
import { storesRouter } from '../../API/STORES/routes/index.js';
import { promosRouter } from '../../API/PROMOS/routes/index.js';
import { ordersRouter } from '../../API/ORDERS/routes/index.js';
import { adminRouter } from '../../API/ADMIN/routes/index.js';
import { API_VERSION } from '../../CORE/constants/kafka/index.js';

export const mountAppRouter = (app: OpenAPIHono): void => {
    app.route(`${API_VERSION}/products`, productsRouter);
    app.route(`${API_VERSION}/stores`, storesRouter);
    app.route(`${API_VERSION}/livestreams`, livestreamsRouter);
    app.route(`${API_VERSION}/live-alerts`, liveAlertsRouter);
    app.route(`${API_VERSION}/promos`, promosRouter);
    app.route(`${API_VERSION}/orders`, ordersRouter);
    app.route(`${API_VERSION}/admin`, adminRouter);
};
