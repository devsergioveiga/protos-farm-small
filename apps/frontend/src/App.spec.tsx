import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('should render login page by default', async () => {
    render(<App />);

    const heading = await screen.findByText('Protos Farm');
    expect(heading).toBeDefined();
  });
});
