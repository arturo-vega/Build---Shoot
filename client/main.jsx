import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import './style.css';


window.gameInstance = null;

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<App />);