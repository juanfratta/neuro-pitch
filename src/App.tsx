/**
 * Absolute Pitch Trainer - Wong 2025 Protocol
 * Main application entry point
 * 
 * Provides protocol context and manages the entire training system
 */

import { ProtocolProvider } from './state/protocol-context';
import { ProtocolGate } from './components/ProtocolGate';
import './App.css';
import './styles/global.css';

function App() {
  return (
    <ProtocolProvider>
      <div className="app-container">
        <ProtocolGate />
      </div>
    </ProtocolProvider>
  );
}

export default App;
