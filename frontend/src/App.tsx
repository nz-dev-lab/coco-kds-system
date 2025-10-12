// App.tsx
import MainLayout from './components/Layout/MainLayout';
import PlaceholderContent from './components/PlaceholderContent';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { useAppSelector } from './store/hooks';

function App() {
      const { isAuthenticated } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Login />
    }
  return (
    <MainLayout>
      <Dashboard />
    </MainLayout>
  );
}

export default App;