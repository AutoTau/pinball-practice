import { render, screen } from '@testing-library/react-native';

import App from '../App';

describe('App', () => {
  it('renders the app title', async () => {
    await render(<App />);

    expect(screen.getByText('Pinball Practice')).toBeTruthy();
  });
});
