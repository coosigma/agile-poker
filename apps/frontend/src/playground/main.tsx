import { createRoot } from 'react-dom/client';
import '../styles.css';
import './playground.css';
import { Playground } from './Playground';

// Intentionally rendered without <StrictMode>: the mock socket lifecycle is
// simpler to follow without the dev double-invoke of connect/disconnect.
createRoot(document.getElementById('root') as HTMLElement).render(
	<Playground />,
);
