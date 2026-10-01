import { useQuery } from '@tanstack/react-query';
import { Route, Routes } from 'react-router';
import { fetchHealth } from './api/health';

function HealthPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">MyEdSpace</h1>
      <p className="mt-4 text-slate-700" role="status">
        {isPending && 'Checking the API…'}
        {isError && 'API is unreachable'}
        {data && `API ${data.status} · database ${data.database}`}
      </p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<HealthPage />} />
    </Routes>
  );
}
