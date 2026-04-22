[index.html](https://github.com/user-attachments/files/26981273/index.html)
# DEEPTON
O Deep TON é um sistema de varredura de ameaças desenvolvido para operar em ambiente local, combinando análise antivírus via API Cloudmersive com explicações geradas por inteligência artificial local (modelo phi3 via Ollama).


<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deep TON — Scanner de Ameaças</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="page">

  <!-- HEADER -->
  <header>
    <div class="logo-icon"><i class="fa-solid fa-shield-halved"></i></div>
    <div class="logo-text">
      <h1>DEEP TON</h1>
      <p>SISTEMA DE VARREDURA DE AMEAÇAS</p>
    </div>
  </header>

  <!-- SCANNER AREA -->
  <main class="scanner-area">
    <div class="card">
      <div class="scan-beam" id="scan-beam"></div>

      <!-- Drop zone -->
      <div class="drop-zone" id="drop-zone">
        <i class="fa-solid fa-file-shield"></i>
        <p>Arraste e solte um arquivo aqui<br>ou clique para selecionar</p>
        <input type="file" id="fileInput" hidden />
        <button class="btn-upload" onclick="document.getElementById('fileInput').click()">
          Selecionar arquivo
        </button>
      </div>

      <!-- File meta -->
      <div class="file-meta" id="file-meta">
        Nome: <span id="meta-name">—</span><br>
        Tamanho: <span id="meta-size">—</span><br>
        Tipo: <span id="meta-type">—</span>
      </div>

      <!-- Scan button -->
      <button class="btn-scan" id="btn-scan" disabled>
        <i class="fa-solid fa-magnifying-glass-chart"></i>&nbsp; INICIAR VARREDURA
      </button>

      <!-- Progress -->
      <div class="progress-wrap" id="progress-wrap">
        <div class="progress-label">
          <span id="progress-lbl">Enviando arquivo…</span>
          <span id="progress-pct">0%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
      </div>

      <!-- Status -->
      <div class="scan-status" id="scan-status">
        <div class="status-dot" id="status-dot" style="background:var(--cyan)"></div>
        <span id="status-msg">Aguardando…</span>
      </div>

      <!-- Result -->
      <div id="result-box"></div>

      <!-- AI explanation -->
      <div id="ai-box">
        <div class="ai-header">
          <i class="fa-solid fa-gear spin" id="ai-icon"></i>
          <span>ANÁLISE IA — OLLAMA PHI3</span>
        </div>
        <div id="ai-text"></div>
      </div>
    </div>
  </main>

  <!-- HISTORY PANEL -->
  <aside class="history-panel">
    <div class="history-header">
      <span><i class="fa-solid fa-clock-rotate-left"></i>&nbsp; HISTÓRICO</span>
      <span id="history-count">0 varreduras</span>
    </div>
    <div class="history-list" id="history-list">
      <div class="history-empty">Nenhuma varredura ainda</div>
    </div>
  </aside>

  <footer>DEEP TON v3.0 &mdash; &copy; CRIADO POR ALLAN, HERTA, ANA</footer>
</div>
<script src="script.js"></script>
</body>
</html>
