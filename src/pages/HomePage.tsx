import React from 'react';
import BrandSection from '@/components/BrandSection';
import MobileAppSection from '@/components/MobileAppSection';
import './HomePage.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <BrandSection />
      <MobileAppSection />
    </div>
  );
};

export default HomePage;

