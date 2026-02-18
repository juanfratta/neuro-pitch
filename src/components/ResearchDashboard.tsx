/**
 * Research Dashboard - Scientist Mode
 * Detailed analytics, data export, error analysis
 *
 * Shows:
 * - RT by note heatmap
 * - Error distribution
 * - Learning curve
 * - Proficiency per note
 * - Raw data export (JSON, CSV)
 * - Randomization seeds
 */

import React, { useState } from "react";
import { useProtocol } from "../state/protocol-context";
import "../styles/ResearchDashboard.css";

export const ResearchDashboard: React.FC = () => {
  const { user, exportData } = useProtocol();
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  if (!user) {
    return <div className="research-dashboard loading">Cargando datos...</div>;
  }

  // Compute error distribution
  const errorDistribution: { [note: string]: number } = {};
  const rtByNote: { [note: string]: number[] } = {};

  user.sessions.forEach((session) => {
    session.trials.forEach((trial) => {
      if (!errorDistribution[trial.note]) {
        errorDistribution[trial.note] = 0;
      }
      if (trial.correct === false) {
        errorDistribution[trial.note]++;
      }

      if (!rtByNote[trial.note]) {
        rtByNote[trial.note] = [];
      }
      if (trial.reaction_time_ms !== null) {
        rtByNote[trial.note].push(trial.reaction_time_ms);
      }
    });
  });

  // Calculate retention test outcomes
  const retentionResults = user.retention_tests.map((test) => ({
    week: test.week,
    accuracy: test.accuracy,
    rtAvg: test.rt_avg,
    passed: test.passed,
  }));

  // Learning curve data
  const learningCurve = user.sessions.map((session, idx) => ({
    sessionNumber: idx + 1,
    level: session.level,
    accuracy: session.accuracy,
    rtAvg: session.rt_avg,
  }));

  const handleExport = () => {
    const data = exportData(exportFormat);
    const filename = `pitch_trainer_export_${Date.now()}.${exportFormat === "json" ? "json" : "csv"}`;
    const blob = new Blob([data], {
      type: exportFormat === "json" ? "application/json" : "text/csv",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="research-dashboard">
      {/* Header */}
      <header className="research-header">
        <h1>Research Dashboard</h1>
        <p>Modo investigación - Análisis detallado del protocolo</p>
      </header>

      {/* Export Section */}
      <section className="export-section">
        <h2>Exportar Datos</h2>
        <div className="export-controls">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
          >
            <option value="json">JSON (completo)</option>
            <option value="csv">CSV (trials)</option>
          </select>
          <button onClick={handleExport} className="export-btn">
            Descargar {exportFormat.toUpperCase()}
          </button>
        </div>
      </section>

      {/* Basic Stats */}
      <section className="stats-grid">
        <div className="stat-box">
          <h3>Sesiones completadas</h3>
          <div className="value">{user.sessions.length}</div>
        </div>
        <div className="stat-box">
          <h3>Trials totales</h3>
          <div className="value">{user.training_history.total_trials}</div>
        </div>
        <div className="stat-box">
          <h3>Nivel actual</h3>
          <div className="value">{user.current_level}/10</div>
        </div>
        <div className="stat-box">
          <h3>Tests de retención pasados</h3>
          <div className="value">
            {user.retention_tests.filter((t) => t.passed).length}/
            {user.retention_tests.length}
          </div>
        </div>
      </section>

      {/* Proficiency by Note */}
      <section className="proficiency-section">
        <h2>Proficiencia por Nota</h2>
        <table className="proficiency-table">
          <thead>
            <tr>
              <th>Nota</th>
              <th>Precisión (%)</th>
              <th>RT Promedio (ms)</th>
              <th>RT Mín (ms)</th>
              <th>RT Máx (ms)</th>
              <th>Trials</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(user.proficiency_map).map(([note, prof]) => (
              <tr key={note}>
                <td className="note-cell">{note}</td>
                <td
                  className={
                    prof.accuracy >= 90
                      ? "high"
                      : prof.accuracy >= 70
                        ? "medium"
                        : "low"
                  }
                >
                  {prof.accuracy.toFixed(1)}
                </td>
                <td>{prof.rt_avg.toFixed(0)}</td>
                <td>
                  {prof.rt_min === Infinity ? "—" : prof.rt_min.toFixed(0)}
                </td>
                <td>{prof.rt_max}</td>
                <td>{prof.trial_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Error Distribution */}
      <section className="error-section">
        <h2>Distribución de Errores</h2>
        <div className="error-chart">
          {Object.entries(errorDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([note, errors]) => (
              <div key={note} className="error-bar">
                <div className="note-label">{note}</div>
                <div className="bar-container">
                  <div
                    className="bar"
                    style={{
                      width: `${Math.max(
                        (errors /
                          Math.max(...Object.values(errorDistribution))) *
                          100,
                        5,
                      )}%`,
                    }}
                  >
                    {errors > 0 && (
                      <span className="error-count">{errors}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Learning Curve */}
      <section className="learning-curve-section">
        <h2>Curva de Aprendizaje (Precisión por Sesión)</h2>
        <table className="learning-table">
          <thead>
            <tr>
              <th>Sesión</th>
              <th>Nivel</th>
              <th>Precisión (%)</th>
              <th>RT Promedio (ms)</th>
            </tr>
          </thead>
          <tbody>
            {learningCurve.map((curve) => (
              <tr key={curve.sessionNumber}>
                <td>{curve.sessionNumber}</td>
                <td>{curve.level}</td>
                <td className={curve.accuracy >= 90 ? "high" : "medium"}>
                  {curve.accuracy.toFixed(1)}
                </td>
                <td>{curve.rtAvg.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Retention Test Results */}
      {retentionResults.length > 0 && (
        <section className="retention-results-section">
          <h2>Resultados de Tests de Retención</h2>
          <div className="retention-grid">
            {retentionResults.map((result) => (
              <div
                key={result.week}
                className={`retention-card ${result.passed ? "passed" : "failed"}`}
              >
                <h4>Semana {result.week}</h4>
                <p>Precisión: {result.accuracy.toFixed(1)}%</p>
                <p>RT Promedio: {result.rtAvg.toFixed(0)}ms</p>
                <p className="status">
                  {result.passed ? "Aprobado" : "No aprobado"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Raw Session Data */}
      <section className="raw-data-section">
        <h2>Datos de Sesiones (últimas 5)</h2>
        <div className="raw-data-list">
          {user.sessions.slice(-5).map((session, idx) => (
            <div key={session.id} className="session-card">
              <h4>Sesión {user.sessions.length - 5 + idx + 1}</h4>
              <p>Nivel: {session.level}</p>
              <p>Precisión: {session.accuracy.toFixed(1)}%</p>
              <p>RT Promedio: {session.rt_avg.toFixed(0)}ms</p>
              <p>Trials: {session.trials.length}</p>
              <details>
                <summary>Ver detalles de trials</summary>
                <pre className="trials-detail">
                  {JSON.stringify(session.trials.slice(0, 5), null, 2)}...
                </pre>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* Debug Info */}
      <section className="debug-section">
        <h2>Información del Usuario</h2>
        <pre className="debug-info">
          {`ID: ${user.id}
Versión de protocolo: ${user.protocol_version}
Fecha de inicio: ${user.created_at}
Modo: ${user.mode}
Último acceso: ${user.last_session_timestamp || "N/A"}`}
        </pre>
      </section>
    </div>
  );
};
