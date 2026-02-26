import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('should render Protos Farm heading', () => {
    render(<App />);

    expect(screen.getByText('Protos Farm')).toBeDefined();
  });
});
