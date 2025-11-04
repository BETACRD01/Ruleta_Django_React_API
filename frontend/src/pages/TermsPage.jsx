// src/pages/TermsPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import TermsAndConditions from '../components/auth/utils/TermsAndConditions';

export default function TermsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Volver a la página anterior o al inicio
    navigate(-1);
  };

  return <TermsAndConditions onBack={handleBack} isFullPage={true} />;
}