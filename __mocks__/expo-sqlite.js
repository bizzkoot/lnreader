const mockDb = {
  transaction: jest.fn(),
  readTransaction: jest.fn(),
  exec: jest.fn(),
  closeAsync: jest.fn(),
  execSync: jest.fn(),
  runSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
  withTransactionSync: jest.fn(cb => cb()),
};

module.exports = {
  openDatabase: jest.fn(() => mockDb),
  openDatabaseSync: jest.fn(() => mockDb),
};
