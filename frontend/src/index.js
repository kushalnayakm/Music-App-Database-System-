import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

function AppWrapper() {
  return <App />;
}

root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);
