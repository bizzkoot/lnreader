module.exports = {
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn(url => ({ path: '', queryParams: {} })),
  createURL: jest.fn(path => `exp://localhost/${path}`),
};
