export default {
  get: jest.fn(() => Promise.resolve({})),
  set: jest.fn(() => Promise.resolve(true)),
  clearAll: jest.fn(() => Promise.resolve(true)),
  flush: jest.fn(() => Promise.resolve(true)),
  setFromResponse: jest.fn(() => Promise.resolve(true)),
};
