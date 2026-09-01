import { render, screen } from '@testing-library/react';
import App from './App';

let registeredRoutePaths = [];

jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }) => children,
    Routes: ({ children }) => {
      const routes = React.Children.toArray(children);
      registeredRoutePaths = routes.map((route) => route.props.path);
      return <>{routes[0]}</>;
    },
    Route: ({ element }) => element,
    useNavigate: () => jest.fn(),
    Navigate: () => <div>Redirected</div>,
  };
});

jest.mock('./auth/AuthProvider', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({ loading: false, isAuthorized: false, user: null }),
}));

test('shows a safe loading state and then renders the lazy login route', async () => {
  render(<App />);

  expect(screen.getByRole('status')).toHaveTextContent('Loading application...');
  expect(
    await screen.findByRole('heading', { name: /ap construction erp/i }, { timeout: 5000 })
  ).toBeInTheDocument();
});

test('registers a safe fallback for unknown direct URLs', async () => {
  render(<App />);

  await screen.findByRole('heading', { name: /ap construction erp/i }, { timeout: 5000 });
  expect(registeredRoutePaths).toContain('*');
  expect(registeredRoutePaths).toContain('/system-health');
});