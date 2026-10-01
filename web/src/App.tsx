import { Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProductPage } from './pages/ProductPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductPage />} />
      <Route
        path="/checkout"
        element={<PlaceholderPage title="Checkout" message="Payment is not available yet." />}
      />
      <Route path="/login" element={<PlaceholderPage title="Sign in" message="Sign in is not available yet." />} />
      <Route path="*" element={<PlaceholderPage title="Page not found" message="There is nothing at this address." />} />
    </Routes>
  );
}
