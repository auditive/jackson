import { test, expect } from '@playwright/test';
import { options } from '../../helpers/api';
import { getRawMetadata } from '../../helpers/sso';

test.use(options);

const tenantA = {
  tenant: 'sso-isolation-a',
  product: 'sso-isolation-product',
  defaultRedirectUrl: 'http://localhost:3000/a',
  redirectUrl: ['http://localhost:3000/a'],
};

const tenantB = {
  tenant: 'sso-isolation-b',
  product: 'sso-isolation-product',
  defaultRedirectUrl: 'http://localhost:3000/b',
  redirectUrl: ['http://localhost:3000/b'],
};

/** Extract the setup link token from the URL returned by the API. */
const extractToken = (url: string) => url.split('/').pop()!;

let tokenA: string;
let tokenB: string;
let connectionClientIdB: string;

test.beforeAll(async ({ request }) => {
  const [linkA, linkB] = await Promise.all([
    request.post('/api/v1/sso/setuplinks', { data: tenantA }),
    request.post('/api/v1/sso/setuplinks', { data: tenantB }),
  ]);

  expect(linkA.status()).toBe(201);
  expect(linkB.status()).toBe(201);

  tokenA = extractToken((await linkA.json()).data.url);
  tokenB = extractToken((await linkB.json()).data.url);

  // Use a unique entityID to avoid conflicts with other tests
  const rawMetadata = getRawMetadata('https://saml.example.com/entityid-isolation-test');

  const connResponse = await request.post(`/api/setup/${tokenB}/sso-connection`, {
    data: { rawMetadata },
  });
  expect(connResponse.status()).toBe(201);

  const connections = await (await request.get(`/api/setup/${tokenB}/sso-connection`)).json();
  connectionClientIdB = connections[0].clientID;
});

test.afterAll(async ({ request }) => {
  // The SSO GET endpoint returns an array directly
  const connectionsResponse = await request.get('/api/v1/sso', {
    params: { tenant: tenantB.tenant, product: tenantB.product },
  });

  if (connectionsResponse.ok()) {
    for (const conn of (await connectionsResponse.json()) || []) {
      await request
        .delete('/api/v1/sso', { params: { clientID: conn.clientID, clientSecret: conn.clientSecret } })
        .catch(() => {});
    }
  }

  await Promise.all([
    request.delete('/api/v1/sso/setuplinks', {
      params: { tenant: tenantA.tenant, product: tenantA.product },
    }),
    request.delete('/api/v1/sso/setuplinks', {
      params: { tenant: tenantB.tenant, product: tenantB.product },
    }),
  ]);
});

test.describe('Setup link SSO connection tenant isolation', () => {
  test('GET with mismatched tenant token returns 400', async ({ request }) => {
    const response = await request.get(`/api/setup/${tokenA}/sso-connection/${connectionClientIdB}`);

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe('Tenant/Product mismatch');
  });

  test('GET with own tenant token succeeds', async ({ request }) => {
    const response = await request.get(`/api/setup/${tokenB}/sso-connection/${connectionClientIdB}`);

    expect(response.ok()).toBe(true);
    expect((await response.json())[0].clientID).toBe(connectionClientIdB);
  });
});
