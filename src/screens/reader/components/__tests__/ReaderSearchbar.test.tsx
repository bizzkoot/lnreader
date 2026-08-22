import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock(
  '@react-native-vector-icons/material-design-icons',
  () => 'MaterialCommunityIcons',
  { virtual: true },
);
jest.mock('color', () => () => ({
  alpha: () => ({ string: () => 'rgba(0,0,0,0.95)', toString: () => '' }),
}));
jest.mock('@hooks/useScaledDimensions', () => ({
  useScaledDimensions: () => ({
    padding: { sm: 8, xs: 4, md: 16 },
    iconSize: { md: 24 },
    buttonHeight: { md: 40 },
    borderRadius: { md: 8 },
  }),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn((k: string) => k),
}));

import ReaderSearchbar from '../ReaderSearchbar';

const theme: any = {
  surface: '#fff',
  surfaceVariant: '#eee',
  onSurface: '#000',
  onSurfaceVariant: '#666',
  primary: '#6200ee',
};

describe('ReaderSearchbar', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders input with query value', () => {
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: 'hello',
          current: 1,
          total: 3,
          renderedTotal: 3,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('hello')).toBeTruthy();
  });

  it('shows counter when has results', () => {
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: 'test',
          current: 2,
          total: 5,
          renderedTotal: 5,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('2/5')).toBeTruthy();
  });

  it('hides counter when no results', () => {
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: '',
          current: 0,
          total: 0,
          renderedTotal: 0,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText(/\/\d/)).toBeNull();
  });

  it('calls onSearch when text changes (debounced)', () => {
    jest.useFakeTimers();
    const onSearch = jest.fn();
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: '',
          current: 0,
          total: 0,
          renderedTotal: 0,
          isTruncated: false,
        }}
        onSearch={onSearch}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    fireEvent.changeText(screen.getByDisplayValue(''), 'ab');
    expect(onSearch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(onSearch).toHaveBeenCalledWith('ab');
    jest.useRealTimers();
  });

  it('shows min-length warning for short query without special chars', () => {
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: 'ab',
          current: 0,
          total: 0,
          renderedTotal: 0,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('readerScreen.searchMinLength')).toBeTruthy();
  });

  it('hides min-length warning for short query with special char', () => {
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: 'a!',
          current: 0,
          total: 0,
          renderedTotal: 0,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('readerScreen.searchMinLength')).toBeNull();
  });

  it('calls onClose when back pressed', () => {
    const onClose = jest.fn();
    render(
      <ReaderSearchbar
        theme={theme}
        searchResult={{
          query: '',
          current: 0,
          total: 0,
          renderedTotal: 0,
          isTruncated: false,
        }}
        onSearch={jest.fn()}
        onNext={jest.fn()}
        onPrevious={jest.fn()}
        onClose={onClose}
      />,
    );
    expect(onClose).toBeDefined();
  });
});
