import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import routes from '@/routes/index.tsx';
import '@/styles/github-markdown.css';
import '@/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    // <React.StrictMode></React.StrictMode>

    <RouterProvider router={routes} />
);
