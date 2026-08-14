import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { ThemeColors } from '@theme/types';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    onSurface: '#000000',
    overlay3: '#ffffff',
    primary: '#6750a4',
    onPrimary: '#ffffff',
  }),
  useAppSettings: () => ({ uiScale: 1.0 }),
}));

jest.mock('@strings/translations', () => ({
  getString: (key: string) => key,
}));

const mockTheme = {
  onSurface: '#000000',
  overlay3: '#ffffff',
} as unknown as ThemeColors;

const renderDialog = (props: {
  onSubmit: () => void | Promise<void>;
  onDismiss: () => void;
}) =>
  render(
    <PaperProvider>
      <ConfirmationDialog
        visible
        theme={mockTheme}
        title="Test"
        message="Are you sure?"
        onSubmit={props.onSubmit}
        onDismiss={props.onDismiss}
      />
    </PaperProvider>,
  );

describe('ConfirmationDialog', () => {
  it('dismisses only after onSubmit resolves', async () => {
    const onSubmit = jest.fn(async () => {});
    const onDismiss = jest.fn();

    renderDialog({ onSubmit, onDismiss });

    fireEvent.press(screen.getByText('common.ok'));
    expect(onSubmit).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it('does not dismiss and stays interactive when onSubmit rejects', async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('boom');
    });
    const onDismiss = jest.fn();

    renderDialog({ onSubmit, onDismiss });

    fireEvent.press(screen.getByText('common.ok'));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // The rejection must not dismiss the dialog, and the confirming state
    // must reset so the user can retry.
    await waitFor(() => expect(onDismiss).not.toHaveBeenCalled());

    await act(async () => {});

    fireEvent.press(screen.getByText('common.ok'));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
