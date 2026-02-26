import { APP_NAME, API_VERSION } from './index';

describe('shared constants', () => {
  it('should export APP_NAME', () => {
    expect(APP_NAME).toBe('Protos Farm');
  });

  it('should export API_VERSION', () => {
    expect(API_VERSION).toBe('v1');
  });
});
