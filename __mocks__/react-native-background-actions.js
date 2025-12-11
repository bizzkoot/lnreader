module.exports = {
  start: jest.fn(),
  stop: jest.fn(),
  isRunning: jest.fn(() => Promise.resolve(false)),
  updateNotification: jest.fn(),
};
