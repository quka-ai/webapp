import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import routes from '@/routes/index.tsx';
import '@/styles/github-markdown.css';
import '@/styles/globals.css';
// Wails 外部链接全局处理器
import '@/utils/wails-external-links';

ReactDOM.createRoot(document.getElementById('root')!).render(
    // <React.StrictMode></React.StrictMode>

    <RouterProvider router={routes} />
);
