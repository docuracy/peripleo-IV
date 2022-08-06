import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { RecoilRoot } from 'recoil';

import App from './App';
import { StoreContextProvider } from './store';
import { FacetsContextProvider } from './state/search/FacetsContext';
import URLState from './state/URLState';

import './index.scss';

import 'react-image-lightbox/style.css';

const container = document.getElementById('app');
const root = createRoot(container);

root.render(
  <RecoilRoot>
    <StoreContextProvider>
      <FacetsContextProvider>
        <URLState />  
        <HashRouter>
          <Routes>
            <Route> 
              <Route path="/:zoom/:lon/:lat" element={<App />} />
              <Route path="/:zoom/:lon/:lat/:args" element={<App />} />
              <Route path="/" element={<App />} />
            </Route> 
          </Routes>
        </HashRouter>
      </FacetsContextProvider>
    </StoreContextProvider>
  </RecoilRoot>
);