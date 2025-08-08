import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/serverComm';
import { useEffect, useState } from 'react';

export function Home() {
  const { user } = useAuth();
  const [serverUserInfo, setServerUserInfo] = useState(null);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    async function fetchUserInfo() {
      if (user) {
        try {
          const data = await api.getCurrentUser();
          setServerUserInfo(data);
          setServerError('');
        } catch (error) {
          setServerError('Failed to fetch user info from server');
          console.error('Server error:', error);
        }
      }
    }
    fetchUserInfo();
  }, [user]);

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Welcome to Your App!</h1>
        <p className="text-muted-foreground">
          This is your application template with authentication and routing ready to go.
        </p>
        
        {serverError ? (
          <p className="text-red-500">{serverError}</p>
        ) : serverUserInfo ? (
          <div className="p-4 border rounded-lg max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">Server User Info</h2>
            <pre className="text-left bg-muted p-2 rounded text-sm">
              {JSON.stringify(serverUserInfo, null, 2)}
            </pre>
          </div>
        ) : (
          <p>Loading server info...</p>
        )}
      </div>
    </div>
  );
} 