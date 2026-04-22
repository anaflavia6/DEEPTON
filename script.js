  const API               = "http://localhost:3000/api";

  /* ── Elements ── */
  const fileInput    = document.getElementById("fileInput");
  const dropZone     = document.getElementById("drop-zone");
  const fileMeta     = document.getElementById("file-meta");
  const metaName     = document.getElementById("meta-name");
  const metaSize     = document.getElementById("meta-size");
  const metaType     = document.getElementById("meta-type");
  const btnScan      = document.getElementById("btn-scan");
  const progressWrap = document.getElementById("progress-wrap");
  const progressFill = document.getElementById("progress-fill");
  const progressLbl  = document.getElementById("progress-lbl");
  const progressPct  = document.getElementById("progress-pct");
  const scanStatus   = document.getElementById("scan-status");
  const statusDot    = document.getElementById("status-dot");
  const statusMsg    = document.getElementById("status-msg");
  const resultBox    = document.getElementById("result-box");
  const aiBox        = document.getElementById("ai-box");
  const aiText       = document.getElementById("ai-text");
  const aiIcon       = document.getElementById("ai-icon");
  const scanBeam     = document.getElementById("scan-beam");
  const historyList  = document.getElementById("history-list");
  const historyCount = document.getElementById("history-count");

  let selectedFile = null;

  /* ── File select ── */
  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
  dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  function loadFile(file) {
    selectedFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = file.size < 1048576
      ? (file.size / 1024).toFixed(1) + " KB"
      : (file.size / 1048576).toFixed(2) + " MB";
    metaType.textContent = file.type || "desconhecido";
    fileMeta.style.display = "block";
    btnScan.style.display  = "block";
    btnScan.disabled = false;
    hideResult();
    aiBox.style.display = "none";
  }

  /* ── Scan ── */
  btnScan.addEventListener("click", async () => {
    if (!selectedFile) return;
    btnScan.disabled = true;
    hideResult();
    aiBox.style.display = "none";

    progressWrap.style.display = "block";
    scanStatus.style.display   = "flex";
    scanBeam.classList.add("active");
    animateProgress(0, 65, 1400, "Enviando arquivo…");
    statusDot.style.background = "var(--cyan)";
    statusMsg.textContent = "Enviando arquivo…";

 try {
  const formData = new FormData();
  formData.append("inputFile", selectedFile, selectedFile.name);

  const res = await fetch(`${API}/scan`, {
    method: "POST",
    body: formData  
  });

  animateProgress(65, 100, 700, "Analisando ameaças…");
  statusMsg.textContent = "Analisando ameaças…";
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();  

  await delay(400);
  scanBeam.classList.remove("active");
  progressWrap.style.display = "none";

  showResult(data);
  await loadHistory();

if (data.resultado === "infectado") {
  statusDot.style.background = "var(--red)";
  statusMsg.textContent = "Ameaça detectada!";
  await streamExplanation(data.id);
} else {
    statusDot.style.background = "var(--green)";
    statusMsg.textContent = "Arquivo seguro ✓";
  }

    } catch(err) {
      scanBeam.classList.remove("active");
      progressWrap.style.display = "none";
      statusDot.style.background = "var(--red)";
      statusMsg.textContent = "Erro na varredura";
      showError(err.message);
    } finally {
      btnScan.disabled = false;
    }
  });

  /* ── Show result ── */
  function showResult(data) {
    resultBox.className = "";
    resultBox.style.display = "block";

    if (data.resultado === "limpo") {
      resultBox.innerHTML = `
        <div class="result-title clean"><i class="fa-solid fa-circle-check"></i> ARQUIVO LIMPO</div>
        <div class="result-row">Detecções: <span>0 / 60</span></div>
        <div class="result-row">Risco: <span style="color:var(--green)">Baixo</span></div>
        <div class="result-row">Detalhes: <span>${data.detalhes || "nenhum vírus encontrado"}</span></div>
      `;
      resultBox.classList.add("clean");

    } else if (data.resultado === "infectado") {
      const tags = data.virus.map(v =>
        `<span class="virus-tag"><i class="fa-solid fa-virus"></i> ${v}</span>`).join("");
      resultBox.innerHTML = `
        <div class="result-title infected"><i class="fa-solid fa-triangle-exclamation"></i> AMEAÇA DETECTADA</div>
        <div class="result-row">Detecções: <span>${data.totalDeteccoes} / 60</span></div>
        <div class="result-row">Risco: <span style="color:var(--red)">Alto</span></div>
        <div class="virus-tags">${tags}</div>
      `;
      resultBox.classList.add("infected");

    } else {
      resultBox.innerHTML = `
        <div class="result-title warning"><i class="fa-solid fa-circle-question"></i> INCONCLUSIVO</div>
        <div class="result-row">Não foi possível analisar o arquivo completamente.</div>
      `;
      resultBox.classList.add("warning");
    }

    requestAnimationFrame(() => requestAnimationFrame(() => resultBox.classList.add("show")));
  }

  function showError(msg) {
    resultBox.className = "";
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <div class="result-title warning"><i class="fa-solid fa-plug-circle-xmark"></i> ERRO</div>
      <div class="result-row">${msg}</div>
    `;
    resultBox.classList.add("warning");
    requestAnimationFrame(() => requestAnimationFrame(() => resultBox.classList.add("show")));
  }

  function hideResult() {
    resultBox.className = "";
    resultBox.style.display = "none";
  }

  /* ── Stream AI explanation via SSE ── */
  async function streamExplanation(scanId) {
    aiBox.style.display = "block";
    aiText.textContent  = "";
    aiIcon.className    = "fa-solid fa-gear spin";

    return new Promise(resolve => {
      const es = new EventSource(`${API}/scan/${scanId}/explain`);
      let full = "";

      es.onmessage = e => {
        const json = JSON.parse(e.data);
        if (json.token) {
          full += json.token;
          aiText.textContent = full;
        }
        if (json.done || json.erro) {
          es.close();
          aiIcon.className = json.erro
            ? "fa-solid fa-circle-xmark"
            : "fa-solid fa-circle-check";
          if (json.erro) aiText.textContent += "\n\n⚠️ " + json.erro;
          resolve();
        }
      };

      es.onerror = () => {
        es.close();
        aiIcon.className = "fa-solid fa-circle-xmark";
        aiText.textContent = "Não foi possível conectar ao Ollama.\nVerifique se ele está rodando (ollama serve).";
        resolve();
      };
    });
  }

  /* ── History ── */
  async function loadHistory() {
    try {
      const res  = await fetch(`${API}/historico`);
      const rows = await res.json();

      historyCount.textContent = `${rows.length} varredura${rows.length !== 1 ? "s" : ""}`;

      if (!rows.length) {
        historyList.innerHTML = '<div class="history-empty">Nenhuma varredura ainda</div>';
        return;
      }

      historyList.innerHTML = rows.map(r => {
        const date = new Date(r.data_varredura).toLocaleString("pt-BR");
        const sizeKb = (r.tamanho_bytes / 1024).toFixed(1);
        return `
          <div class="history-item ${r.resultado}">
            <div class="hi-name" title="${r.nome_arquivo}">${r.nome_arquivo}</div>
            <div class="hi-meta">
              <span class="hi-badge ${r.resultado}">${r.resultado.toUpperCase()}</span>
              <span>${sizeKb} KB</span>
            </div>
            <div class="hi-date">${date}</div>
            <button class="hi-delete" onclick="deleteHistory(${r.id}, this)" title="Remover">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `;
      }).join("");

    } catch { /* servidor offline */ }
  }

  async function deleteHistory(id, btn) {
    btn.closest(".history-item").style.opacity = "0.4";
    await fetch(`${API}/historico/${id}`, { method: "DELETE" });
    await loadHistory();
  }

  /* ── Helpers ── */
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function animateProgress(from, to, duration, label) {
    progressLbl.textContent = label;
    const start = performance.now();
    (function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const v = Math.round(from + (to - from) * t);
      progressFill.style.width = v + "%";
      progressPct.textContent  = v + "%";
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ── Init ── */
  loadHistory();
