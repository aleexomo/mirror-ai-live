
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
