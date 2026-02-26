import request from 'supertest';
import { app } from '../app';

describe('Metrics endpoint', () => {
  it('GET /metrics should return 200 with prometheus content-type', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
  });

  it('GET /metrics should contain default process metrics', async () => {
    const response = await request(app).get('/metrics');

    expect(response.text).toMatch(/process_cpu_/);
    expect(response.text).toMatch(/process_resident_memory_bytes/);
  });

  it('GET /metrics should contain http_request_duration_seconds after a request', async () => {
    await request(app).get('/api/health/live');

    const response = await request(app).get('/metrics');

    expect(response.text).toMatch(/http_request_duration_seconds/);
  });

  it('GET /metrics should not track itself in http duration histogram', async () => {
    const response = await request(app).get('/metrics');

    const durationLines = response.text
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('http_request_duration_seconds_bucket') &&
          line.includes('route="/metrics"'),
      );

    expect(durationLines).toHaveLength(0);
  });
});
