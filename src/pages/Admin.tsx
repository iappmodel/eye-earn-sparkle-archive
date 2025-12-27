import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '@/components/admin';

const Admin: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AdminDashboard onBack={() => navigate('/')} />
  );
};

export default Admin;
