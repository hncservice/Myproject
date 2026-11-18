import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
const logoutSession = vi.hoisted(() => vi.fn());
vi.mock('../api/authApi', () => ({ logoutSession }));
let context; let values;
function Probe() { context = useAuth(); return <p>{context.role || 'signed-out'} {context.logoutWarning}</p>; }
beforeEach(() => { values = new Map(); vi.resetAllMocks(); vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => values.get(key) || null); vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => values.set(key, value)); vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => values.delete(key)); logoutSession.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('preserves role-specific login and persisted profile', () => { render(<AuthProvider><Probe /></AuthProvider>); act(() => context.login('vendor', 'synthetic-token', { name: 'Synthetic' })); expect(context.role).toBe('vendor'); expect(values.get('token')).toBe('synthetic-token'); expect(JSON.parse(values.get('profile')).name).toBe('Synthetic'); });
it('logout clears state immediately and explicitly revokes the previous token', async () => { render(<AuthProvider><Probe /></AuthProvider>); act(() => context.login('user', 'synthetic-token', { id: 'synthetic' })); await act(async () => { await context.logout(); }); expect(context.token).toBeNull(); expect(values.has('token')).toBe(false); expect(logoutSession).toHaveBeenCalledExactlyOnceWith('synthetic-token'); });
it('failed server revocation remains an explicit warning after local sign-out', async () => { logoutSession.mockRejectedValue(new Error('offline')); render(<AuthProvider><Probe /></AuthProvider>); act(() => context.login('admin', 'synthetic-token', { id: 'synthetic' })); await act(async () => { await context.logout(); }); expect(context.role).toBeNull(); expect(context.logoutWarning).toContain('could not be confirmed'); });
it('malformed cached profile does not crash startup', () => { values.set('profile', '{invalid'); render(<AuthProvider><Probe /></AuthProvider>); expect(context.profile).toBeNull(); });
it('unavailable storage cannot prevent rendering and in-memory sign-out', async () => { for (const name of ['getItem', 'setItem', 'removeItem']) vi.spyOn(Storage.prototype, name).mockImplementation(() => { throw new Error('storage unavailable'); }); render(<AuthProvider><Probe /></AuthProvider>); act(() => context.login('user', 'synthetic-token', { id: 'synthetic' })); await act(async () => { await context.logout(); }); expect(context.token).toBeNull(); });
it('invalid role or authentication response cannot populate context', () => { render(<AuthProvider><Probe /></AuthProvider>); expect(() => context.login('root', 'synthetic', {})).toThrow(); expect(() => context.login('user', '', {})).toThrow(); expect(context.role).toBeNull(); });
