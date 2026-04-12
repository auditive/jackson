import { test, expect } from '@playwright/test';
import { options } from '../../helpers/api';

test.use(options);

const tenantA = { tenant: 'tenant-isolation-a', product: 'product-isolation' };
const tenantB = { tenant: 'tenant-isolation-b', product: 'product-isolation' };

let tokenA: string;
let tokenB: string;
let directoryIdA: string;
let directoryIdB: string;

/** Extract the setup link token from the URL returned by the API. */
const extractToken = (url: string) => url.split('/').pop()!;

test.beforeAll(async ({ request }) => {
  const [linkA, linkB] = await Promise.all([
    request.post('/api/v1/dsync/setuplinks', {
      data: { ...tenantA, webhook_url: 'http://localhost:3000/webhook-a', webhook_secret: 'secret-a' },
    }),
    request.post('/api/v1/dsync/setuplinks', {
      data: { ...tenantB, webhook_url: 'http://localhost:3000/webhook-b', webhook_secret: 'secret-b' },
    }),
  ]);

  expect(linkA.status()).toBe(201);
  expect(linkB.status()).toBe(201);

  tokenA = extractToken((await linkA.json()).data.url);
  tokenB = extractToken((await linkB.json()).data.url);

  const [dirA, dirB] = await Promise.all([
    request.post(`/api/setup/${tokenA}/directory-sync`, { data: { type: 'generic-scim-v2' } }),
    request.post(`/api/setup/${tokenB}/directory-sync`, { data: { type: 'generic-scim-v2' } }),
  ]);

  expect(dirA.ok()).toBe(true);
  expect(dirB.ok()).toBe(true);

  directoryIdA = (await dirA.json()).data.id;
  directoryIdB = (await dirB.json()).data.id;
});

test.afterAll(async ({ request }) => {
  await Promise.all([
    request.delete(`/api/v1/dsync/${directoryIdA}`).catch(() => {}),
    request.delete(`/api/v1/dsync/${directoryIdB}`).catch(() => {}),
  ]);

  await Promise.all([
    request.delete('/api/v1/dsync/setuplinks', { params: tenantA }),
    request.delete('/api/v1/dsync/setuplinks', { params: tenantB }),
  ]);
});

test.describe('Setup link directory-sync tenant isolation', () => {
  test('GET with mismatched tenant token returns 400 and does not leak data', async ({ request }) => {
    const response = await request.get(`/api/setup/${tokenA}/directory-sync/${directoryIdB}`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe('Tenant/Product mismatch');
    expect(body.data).toBeUndefined();
  });

  test('GET with own tenant token succeeds', async ({ request }) => {
    const response = await request.get(`/api/setup/${tokenA}/directory-sync/${directoryIdA}`);

    expect(response.ok()).toBe(true);
    expect((await response.json()).data.id).toBe(directoryIdA);
  });

  test('PATCH with mismatched tenant token returns 400 and does not modify the directory', async ({
    request,
  }) => {
    const response = await request.patch(`/api/setup/${tokenA}/directory-sync/${directoryIdB}`, {
      data: { deactivated: true },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe('Tenant/Product mismatch');

    // Verify directory B is still active
    const verify = await request.get(`/api/setup/${tokenB}/directory-sync/${directoryIdB}`);
    expect(verify.ok()).toBe(true);
    expect((await verify.json()).data.deactivated).toBe(false);
  });

  test('DELETE with mismatched tenant token returns 400 and does not delete the directory', async ({
    request,
  }) => {
    const response = await request.delete(`/api/setup/${tokenA}/directory-sync/${directoryIdB}`);

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe('Tenant/Product mismatch');

    // Verify directory B still exists
    const verify = await request.get(`/api/setup/${tokenB}/directory-sync/${directoryIdB}`);
    expect(verify.ok()).toBe(true);
    expect((await verify.json()).data.id).toBe(directoryIdB);
  });
});
