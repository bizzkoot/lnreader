export const MMKV = jest.fn().mockImplementation(() => ({
  set: jest.fn(),
  getString: jest.fn(),
  getNumber: jest.fn(),
  getBoolean: jest.fn(),
  delete: jest.fn(),
  getAllKeys: jest.fn(),
  clearAll: jest.fn(),
  addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
