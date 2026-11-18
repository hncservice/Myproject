import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import PrizeAwardDetails from './PrizeAwardDetails';

const { getPrize } = vi.hoisted(() => ({
  getPrize: vi.fn(),
}));

vi.mock('../api/spinApi', () => ({
  getPrizeDecisionPrize: getPrize,
}));

const SESSION = '111111111111111111111111';
const OTHER_SESSION = '222222222222222222222222';
const QR = 'data:image/png;base64,VEVTVA==';
const QR_ALT = 'Prize redemption QR code';

function prizeResponse(overrides = {}) {
  return {
    data: {
      gameSessionId: SESSION,
      prize: { title: 'Test prize', description: 'Prize description' },
      redemptionStatus: 'pending',
      qrExpiry: null,
      expired: false,
      qrDataUrl: QR,
      ...overrides,
    },
  };
}

beforeEach(() => getPrize.mockReset());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('shows the prize and QR for the current session', async () => {
  getPrize.mockResolvedValueOnce(prizeResponse());

  render(<PrizeAwardDetails gameSessionId={SESSION} />);

  expect((await screen.findByAltText(QR_ALT)).getAttribute('src')).toBe(QR);
  expect(screen.getByRole('heading', { name: 'Test prize' })).toBeTruthy();
  expect(screen.getByText('Prize description')).toBeTruthy();
  expect(getPrize).toHaveBeenCalledExactlyOnceWith(SESSION);
});

it.each([
  [
    { redemptionStatus: 'redeemed' },
    'This prize has already been redeemed.',
  ],
  [
    { expired: true },
    'The QR code for this prize has expired.',
  ],
])('hides the QR for an unavailable redemption state (%j)', async (state, message) => {
  getPrize.mockResolvedValueOnce(prizeResponse(state));

  render(<PrizeAwardDetails gameSessionId={SESSION} />);

  expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.queryByAltText(QR_ALT)).toBeNull();
});

it('hides the QR when it expires while the panel is open', async () => {
  vi.useFakeTimers();
  getPrize.mockResolvedValueOnce(prizeResponse({
    qrExpiry: new Date(Date.now() + 1000).toISOString(),
  }));

  await act(async () => {
    render(<PrizeAwardDetails gameSessionId={SESSION} />);
  });

  expect(screen.getByAltText(QR_ALT)).toBeTruthy();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1001);
  });

  expect(screen.queryByAltText(QR_ALT)).toBeNull();
  expect(screen.getByText('The QR code for this prize has expired.')).toBeTruthy();
});

it('refreshes prize details after a failed request', async () => {
  getPrize
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(prizeResponse());

  render(<PrizeAwardDetails gameSessionId={SESSION} />);

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByAltText(QR_ALT)).toBeNull();

  fireEvent.click(screen.getByRole('button', {
    name: 'REFRESH PRIZE DETAILS',
  }));

  expect(await screen.findByAltText(QR_ALT)).toBeTruthy();
  expect(getPrize).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('rejects prize details returned for a different session', async () => {
  getPrize.mockResolvedValueOnce(prizeResponse({
    gameSessionId: OTHER_SESSION,
  }));

  render(<PrizeAwardDetails gameSessionId={SESSION} />);

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByAltText(QR_ALT)).toBeNull();
});

it('ignores a late QR response from the previous session', async () => {
  let resolvePrevious;
  getPrize
    .mockReturnValueOnce(new Promise(resolve => {
      resolvePrevious = resolve;
    }))
    .mockResolvedValueOnce(prizeResponse({
      gameSessionId: OTHER_SESSION,
      prize: { title: 'Current prize' },
      redemptionStatus: 'redeemed',
      qrDataUrl: null,
    }));

  const { rerender } = render(
    <PrizeAwardDetails gameSessionId={SESSION} />
  );

  rerender(<PrizeAwardDetails gameSessionId={OTHER_SESSION} />);
  expect(await screen.findByRole('heading', { name: 'Current prize' })).toBeTruthy();

  await act(async () => {
    resolvePrevious(prizeResponse());
  });

  expect(screen.getByRole('heading', { name: 'Current prize' })).toBeTruthy();
  expect(screen.queryByText('Test prize')).toBeNull();
  expect(screen.queryByAltText(QR_ALT)).toBeNull();
});