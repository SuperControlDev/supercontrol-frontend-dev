import React from 'react';
import './BrandSection.css';

const BrandSection: React.FC = () => {
  return (
    <div className="brand-section">
      <div className="brand-content">
        <div className="brand-top">
          <p className="brand-tagline">WE PLAY THE REAL!</p>
        </div>
        
        <div className="brand-logo-section">
          <div className="brand-icon">
            <div className="pink-square">
              <div className="play-icon">▶</div>
            </div>
          </div>
          <div className="brand-title">
            <span className="brand-title-line">SUPER</span>
            <span className="brand-title-line">CONTROL</span>
          </div>
        </div>
        
        <div className="brand-slogan">
          <p className="slogan-english">ANYTIME, ANYWHERE</p>
          <p className="slogan-korean">언제 어디서든 온라인 24시 플레이 월드</p>
        </div>
        
        <div className="brand-footer">
          <div className="social-icons">
            <a href="#" className="social-icon" aria-label="Twitter">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" className="social-icon" aria-label="Instagram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3.5"/>
                <path d="M12 2C8.13 2 7.25 2.09 6.12 2.26c-1.13.17-1.95.75-2.63 1.43-.68.68-1.26 1.5-1.43 2.63C1.59 7.25 1.5 8.13 1.5 12s.09 4.75.26 5.88c.17 1.13.75 1.95 1.43 2.63.68.68 1.5 1.26 2.63 1.43 1.13.17 2.01.26 5.88.26s4.75-.09 5.88-.26c1.13-.17 1.95-.75 2.63-1.43.68-.68 1.26-1.5 1.43-2.63.17-1.13.26-2.01.26-5.88s-.09-4.75-.26-5.88c-.17-1.13-.75-1.95-1.43-2.63-.68-.68-1.5-1.26-2.63-1.43C16.75 2.09 15.87 2 12 2zm0 1.5c3.79 0 4.58.09 5.69.26.87.13 1.34.6 1.47 1.47.17 1.11.26 1.9.26 5.69s-.09 4.58-.26 5.69c-.13.87-.6 1.34-1.47 1.47-1.11.17-1.9.26-5.69.26s-4.58-.09-5.69-.26c-.87-.13-1.34-.6-1.47-1.47-.17-1.11-.26-1.9-.26-5.69s.09-4.58.26-5.69c.13-.87.6-1.34 1.47-1.47C7.42 3.59 8.21 3.5 12 3.5z"/>
                <circle cx="18.5" cy="5.5" r="1.5"/>
              </svg>
            </a>
            <a href="#" className="social-icon" aria-label="YouTube">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 15l5.19-3L10 9v6zm11.56-7.17c.31.89.31 2.17 0 3.06-.19.68-.48 1.29-.86 1.86-.38.57-.85 1.04-1.43 1.41-.58.37-1.19.66-1.86.86-.89.31-2.17.31-3.06 0-.68-.19-1.29-.48-1.86-.86-.57-.38-1.04-.85-1.41-1.43-.37-.58-.66-1.19-.86-1.86-.31-.89-.31-2.17 0-3.06.19-.68.48-1.29.86-1.86.38-.57.85-1.04 1.43-1.41.58-.37 1.19-.66 1.86-.86.89-.31 2.17-.31 3.06 0 .68.19 1.29.48 1.86.86.57.38 1.04.85 1.41 1.43.37.58.66 1.19.86 1.86z"/>
              </svg>
            </a>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">회사소개</a>
            <span className="link-separator"> </span>
            <a href="#" className="footer-link">블로그</a>
            <span className="link-separator"> </span>
            <a href="#" className="footer-link">협업문의</a>
            <span className="link-separator"> </span>
            <a href="#" className="footer-link">이용약관</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandSection;


