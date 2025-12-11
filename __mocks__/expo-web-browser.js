module.exports = {
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  dismissBrowser: jest.fn(),
  mayInitWithUrlAsync: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
};
