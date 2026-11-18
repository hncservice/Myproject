import { beforeEach, expect, it, vi } from 'vitest';
import { logoutSession, resendUserOtp } from './authApi';
const post = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/api/axiosInstance', () => ({ default: { post } }));
beforeEach(() => vi.resetAllMocks());
it('logout captures explicit credentials and handles 401 outside the global redirect interceptor', async () => { post.mockResolvedValue({ status: 401 }); await expect(logoutSession('synthetic-token')).rejects.toThrow('could not be confirmed'); const [path, body, config] = post.mock.calls[0]; expect(path).toBe('/auth/logout'); expect(body).toEqual({}); expect(config.headers.Authorization).toBe('Bearer synthetic-token'); expect(config.validateStatus(401)).toBe(true); expect(config.validateStatus(500)).toBe(false); expect(config.validateStatus(200)).toBe(true); });
it('resend preserves the email-only API contract', async () => { post.mockResolvedValue({ status: 200 }); const payload = { email: 'synthetic@example.com' }; await resendUserOtp(payload); expect(post).toHaveBeenCalledExactlyOnceWith('/auth/resend-otp', payload); });
