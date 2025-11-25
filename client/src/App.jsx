// client/src/App.jsx
import React from 'react';
import Layout from './components/Layout';
import AppRoutes from './routes/AppRoutes';

const App = () => {
  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
};

export default App;
