import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DistributionBar from '../components/DistributionBar';

const mockTheme = {
  primary: '#6750a4',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
  surface: '#fffbfe',
  surfaceVariant: '#e7e0ec',
};

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
  useAppSettings: () => ({ uiScale: 1 }),
}));

describe('DistributionBar — SVG donut', () => {
  it('renders empty state when no entries', () => {
    render(<DistributionBar entries={[]} colors={{}} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders empty when sum is 0', () => {
    render(
      <DistributionBar
        entries={[{ key: 'a', value: 0 }]}
        colors={{ a: '#ff0000' }}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders donut with legend labels and percentages', () => {
    const entries = [
      { key: 'Ongoing', value: 3, label: 'Ongoing' },
      { key: 'Completed', value: 1, label: 'Completed' },
    ];
    const colors = { Ongoing: '#6750a4', Completed: '#e8def8' };
    render(<DistributionBar entries={entries} colors={colors} />);
    expect(screen.getByText('Ongoing')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('3 · 75%')).toBeTruthy();
    expect(screen.getByText('1 · 25%')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('handles single full slice without crashing', () => {
    render(
      <DistributionBar
        entries={[{ key: 'a', value: 5, label: 'All' }]}
        colors={{ a: '#123456' }}
      />,
    );
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('5 · 100%')).toBeTruthy();
  });

  it('respects total prop for percentage denominator', () => {
    render(
      <DistributionBar
        entries={[{ key: 'a', value: 2, label: 'A' }]}
        colors={{ a: '#000' }}
        total={4}
      />,
    );
    expect(screen.getByText('2 · 50%')).toBeTruthy();
  });
});
