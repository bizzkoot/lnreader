module.exports = {
  getDocumentAsync: jest.fn(() =>
    Promise.resolve({
      type: 'cancel',
    }),
  ),
};
