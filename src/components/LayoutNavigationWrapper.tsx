import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';

interface LayoutNavigationWrapperProps {
  children: React.ReactNode;
  initialPage: 'tickets' | 'dashboard';
}

const LayoutNavigationWrapper: React.FC<LayoutNavigationWrapperProps> = ({ 
  children, 
  initialPage 
}) => {
  const [currentPage, setCurrentPage] = useState<'tickets' | 'dashboard'>(initialPage);
  const navigate = useNavigate();
  
  // Atualiza a página atual quando o initialPage muda
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);
  
  const handlePageChange = (page: 'tickets' | 'dashboard') => {
    setCurrentPage(page);
    navigate(page === 'dashboard' ? '/' : '/tickets');
  };
  
  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {children}
    </Layout>
  );
};

export default LayoutNavigationWrapper;