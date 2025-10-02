// src/pages/MissionVisionPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import MissionVision from '../components/auth/utils/MissionVision';

export default function MissionVisionPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Volver a la página anterior o al inicio
    navigate(-1);
  };

  return <MissionVision onBack={handleBack} isFullPage={true} />;
}