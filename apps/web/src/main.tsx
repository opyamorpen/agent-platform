import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n';
import { installAppFetchPolyfill } from './lib/app-fetch';
import './styles/global.css';

installAppFetchPolyfill();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
