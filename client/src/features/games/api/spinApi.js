// client/src/api/spinApi.js
import axiosInstance from '../../../shared/api/axiosInstance';

// export const getWheelConfig = () => axiosInstance.get('/wheel');

// export const spinOnce = () =>
//   axiosInstance.post('/spin', {}); // token added by interceptor

export const getWheelConfig = () => axiosInstance.get('/spin/wheel');
export const spinOnce = () => axiosInstance.post('/spin/spin', {});
export const getMonkeyStatus = () => axiosInstance.get('/spin/monkey-status');
// export const requestMonkeyAttempt = () => axiosInstance.post('/spin/monkey-attempt');
export const requestMonkeyAttempt = (sessionId) =>
  axiosInstance.post('/spin/monkey-attempt', { sessionId });

export const getMyLatestWin = () =>
  axiosInstance.get('/spin/my-latest-win');

// export const getMonkeyStatus = () => axiosInstance.get('/monkey-status');

// export const requestMonkeyAttempt = () => axiosInstance.post('/monkey-attempt');

export const getPrizeDecisionPrize = (gameSessionId) =>
  axiosInstance.get(
    `/games/prize-decision/${validPrizeSessionId(gameSessionId)}/prize`
  );
// Prize-decision requests use only the game session ID.
// Authentication is supplied by the existing Axios interceptor.
function validPrizeSessionId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw new Error('Invalid game session ID');
  }
  return value;
}

export const createPrizeDecision = (gameSessionId) =>
  axiosInstance.post('/games/prize-decision', {
    gameSessionId: validPrizeSessionId(gameSessionId),
  });

export const getPrizeDecisionStatus = (gameSessionId) =>
  axiosInstance.get(
    `/games/prize-decision/${validPrizeSessionId(gameSessionId)}`
  );

export const drawPrizeDecision = (gameSessionId) =>
  axiosInstance.post(
    `/games/prize-decision/${validPrizeSessionId(gameSessionId)}/draw`,
    {}
  );
