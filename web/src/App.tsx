import { Route, Routes } from 'react-router';
import { ActivatePage } from './pages/ActivatePage';
import { AddCoursePage } from './pages/AddCoursePage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { LessonPage } from './pages/LessonPage';
import { LmsPage } from './pages/LmsPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProductPage } from './pages/ProductPage';
import { RequireSession } from './RequireSession';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/confirmation" element={<ConfirmationPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Every LMS route goes inside this guard. */}
      <Route element={<RequireSession />}>
        <Route path="/lms" element={<LmsPage />} />
        <Route path="/lms/add-course" element={<AddCoursePage />} />
        <Route path="/lms/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
      </Route>
      <Route path="*" element={<PlaceholderPage title="Page not found" message="There is nothing at this address." />} />
    </Routes>
  );
}
