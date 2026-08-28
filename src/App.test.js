import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }) => children,
    Routes: ({ children }) => (
      <>{React.Children.toArray(children)[0]}</>
    ),
    Route: ({ element }) => element,
    useNavigate: () => jest.fn(),
    Navigate: () => <div>Redirected</div>,
  };
});

jest.mock('./auth/AuthProvider', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({ loading: false, isAuthorized: false, user: null }),
}));

test('renders the login screen', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /ap construction erp/i })
  ).toBeInTheDocument();
});
