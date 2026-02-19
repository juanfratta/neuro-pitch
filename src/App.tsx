/**
 * Absolute Pitch Trainer - Wong 2025 Protocol
 * Main application entry point
 * 
 * Provides protocol context and manages the entire training system
 */

import { ProtocolProvider } from './state/protocol-context';
import { ProtocolGate } from './components/ProtocolGate';

function App() {
  return (
    <ProtocolProvider>
      <div className="min-h-screen">
        <ProtocolGate />
      </div>
    </ProtocolProvider>
  );
}

export default App;
