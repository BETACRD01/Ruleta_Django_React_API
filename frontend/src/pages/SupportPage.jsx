// src/pages/SupportPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Support from '../components/auth/utils/Support';

export default function SupportPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Volver a la página anterior o al inicio
    navigate(-1);
  };

  return <Support onBack={handleBack} isFullPage={true} />;
}