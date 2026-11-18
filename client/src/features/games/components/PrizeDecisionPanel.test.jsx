import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import PrizeDecisionPanel from './PrizeDecisionPanel';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  status: vi.fn(),
  draw: vi.fn(),
}));

vi.mock('../api/spinApi', () => ({
  createPrizeDecision: mocks.create,
  getPrizeDecisionStatus: mocks.status,
  drawPrizeDecision: mocks.draw,
}));

const A = '111111111111111111111111';
const B = '222222222222222222222222';

function response(id = A, status = 'ready_for_draw') {
  return { data: { gameSessionId: id, status } };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

it('mount reads status without starting a draw', async () => {
  mocks.status.mockResolvedValue(response());
  render(<PrizeDecisionPanel gameSessionId={A} />);
  await screen.findByRole('button', { name: 'DRAW MY PRIZE' });
  expect(mocks.status).toHaveBeenCalledExactlyOnceWith(A);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.draw).not.toHaveBeenCalled();
});

it('missing decision creates only a preliminary decision then rereads status', async () => {
  mocks.status
    .mockRejectedValueOnce({ response: { status: 404 } })
    .mockResolvedValueOnce(response(A, 'pending_review'));
  render(<PrizeDecisionPanel gameSessionId={A} />);
  await screen.findByText('Your result is awaiting review.');
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(A);
  expect(mocks.status).toHaveBeenCalledTimes(2);
  expect(mocks.draw).not.toHaveBeenCalled();
});

it('server errors do not trigger preliminary creation or allocation', async () => {
  mocks.status.mockRejectedValue({ response: { status: 500 } });
  render(<PrizeDecisionPanel gameSessionId={A} />);
  await screen.findByRole('alert');
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.draw).not.toHaveBeenCalled();
});

it.each([
  ['pending_review', 'Your result is awaiting review.'],
  ['rejected', 'Your result was not approved for the prize draw.'],
  ['no_prize', 'The draw is complete. No prize this time.'],
  ['prize_awarded', 'You won a prize!'],
])('does not offer a draw for %s', async (status, message) => {
  mocks.status.mockResolvedValue(response(A, status));
  render(<PrizeDecisionPanel gameSessionId={A} />);
  await screen.findByText(message);
  expect(screen.queryByRole('button', { name: 'DRAW MY PRIZE' })).toBeNull();
  expect(mocks.draw).not.toHaveBeenCalled();
});

it('draw requires a click and duplicate clicks share one pending request', async () => {
  const pending = deferred();
  mocks.status.mockResolvedValue(response(A, 'approved'));
  mocks.draw.mockReturnValue(pending.promise);
  render(<PrizeDecisionPanel gameSessionId={A} />);

  const button = await screen.findByRole('button', { name: 'DRAW MY PRIZE' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mocks.draw).toHaveBeenCalledExactlyOnceWith(A);
  expect(button.disabled).toBe(true);

  await act(async () => {
    pending.resolve(response(A, 'no_prize'));
    await pending.promise;
  });

  await screen.findByText('The draw is complete. No prize this time.');
  expect(screen.queryByRole('button', { name: 'DRAW MY PRIZE' })).toBeNull();
});

it('disabled allocation displays an unavailable message without automatic retries', async () => {
  mocks.status.mockResolvedValue(response());
  mocks.draw.mockRejectedValue({
    response: {
      status: 503,
      data: { code: 'PRIZE_ALLOCATION_DISABLED' },
    },
  });
  render(<PrizeDecisionPanel gameSessionId={A} />);
  fireEvent.click(await screen.findByRole('button', { name: 'DRAW MY PRIZE' }));
  expect((await screen.findByRole('alert')).textContent)
    .toContain('Prize draws are not available yet');
  expect(mocks.draw).toHaveBeenCalledTimes(1);
});

it('invalid session ID makes no API requests', async () => {
  render(<PrizeDecisionPanel gameSessionId="invalid" />);
  await screen.findByRole('alert');
  expect(mocks.status).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.draw).not.toHaveBeenCalled();
});

it('response for a different session is rejected', async () => {
  mocks.status.mockResolvedValue(response(B));
  render(<PrizeDecisionPanel gameSessionId={A} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'DRAW MY PRIZE' })).toBeNull();
});

it('late success from the previous session cannot replace current status', async () => {
  const previous = deferred();
  mocks.status
    .mockReturnValueOnce(previous.promise)
    .mockResolvedValueOnce(response(B, 'pending_review'));

  const view = render(<PrizeDecisionPanel gameSessionId={A} />);
  view.rerender(<PrizeDecisionPanel gameSessionId={B} />);
  await screen.findByText('Your result is awaiting review.');

  await act(async () => {
    previous.resolve(response(A, 'prize_awarded'));
    await previous.promise;
  });

  expect(screen.queryByText('You won a prize!')).toBeNull();
  expect(screen.getByText('Your result is awaiting review.')).toBeTruthy();
});

it('late 404 from the previous session cannot create a decision', async () => {
  const previous = deferred();
  mocks.status
    .mockReturnValueOnce(previous.promise)
    .mockResolvedValue(response(B, 'pending_review'));

  const view = render(<PrizeDecisionPanel gameSessionId={A} />);
  view.rerender(<PrizeDecisionPanel gameSessionId={B} />);
  await screen.findByText('Your result is awaiting review.');

  await act(async () => {
    previous.reject({ response: { status: 404 } });
    await previous.promise.catch(() => {});
  });

  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.draw).not.toHaveBeenCalled();
});

it('unmounted panel cannot create a decision after a late 404', async () => {
  const pending = deferred();
  mocks.status.mockReturnValueOnce(pending.promise)
    .mockResolvedValue(response());

  const view = render(<PrizeDecisionPanel gameSessionId={A} />);
  await waitFor(() => expect(mocks.status).toHaveBeenCalledTimes(1));
  view.unmount();

  await act(async () => {
    pending.reject({ response: { status: 404 } });
    await pending.promise.catch(() => {});
  });

  expect(mocks.create).not.toHaveBeenCalled();
});
