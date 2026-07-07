import { DomainModule } from '../../CORE/middleware/router';
import { authRouter } from '../../API/AUTH/routes';
import { usersRouter } from '../../API/USERS/routes';
import { adminRouter } from '../../API/ADMIN/routes';

export const modules: DomainModule[] = [
  { name: 'AUTH', path: '/auth', router: authRouter },
  { name: 'ADMIN', path: '/admin', router: adminRouter },
  { name: 'USERS', path: '/users', router: usersRouter },
];

// { name: 'CONTENT', path: '/content', router: contentRouter },
// { name: 'PUBLIC', path: '/public', router: publicRouter },
// { name: 'WALLETS', path: '/wallets', router: walletsRouter },
// { name: 'CARDS', path: '/cards', router: cardsRouter },
// { name: 'MONO', path: '/mono', router: monoRouter },
// { name: 'PAYMENTS', path: '/payments', router: paymentsRouter },
// { name: 'CRYPTO_WEBHOOKS', path: '/webhooks/crypto', router: cryptoWebhooksRouter },
// { name: 'WHATSAPP_WEBHOOKS', path: '/webhooks/whatsapp', router: whatsappWebhooksRouter },
// { name: 'TAX_CALC', path: '/tax', router: taxCalcRouter },
// { name: 'CHATBOT', path: '/chatbot', router: chatbotRouter },
