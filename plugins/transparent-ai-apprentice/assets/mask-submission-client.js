(function installMaskSubmissionClient(global) {
  const queueKey = "ai-apprentice-mask-correction-retry-queue-v1";
  const lastKey = "ai-apprentice-mask-correction-last-v1";

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setState(element, kind, message) {
    element.className = `submit-state${kind ? ` ${kind}` : ""}`;
    const dot = document.createElement("i");
    const text = document.createElement("span");
    text.textContent = message;
    element.replaceChildren(dot, text);
  }

  function emit(button, name, detail = {}) {
    button.dispatchEvent(new CustomEvent(`ai-apprentice:${name}`, { detail }));
  }

  async function request(endpoint, options) {
    const response = await fetch(endpoint, {
      ...options,
      headers: { "content-type": "application/json", ...(options?.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function enqueue(endpoint, packet, error) {
    const queue = readJson(queueKey, []);
    const serialized = JSON.stringify(packet);
    const existing = queue.find(item => item.serialized === serialized);
    if (existing) {
      existing.attempts += 1;
      existing.lastError = error;
      existing.updatedAt = new Date().toISOString();
    } else {
      queue.push({ endpoint, packet, serialized, attempts: 1, lastError: error, updatedAt: new Date().toISOString() });
    }
    writeJson(queueKey, queue.slice(-20));
  }

  function removeQueued(packet) {
    const serialized = JSON.stringify(packet);
    writeJson(queueKey, readJson(queueKey, []).filter(item => item.serialized !== serialized));
  }

  async function replayStatus(endpoint, id, stateElement) {
    try {
      const record = await request(`${endpoint}/${encodeURIComponent(id)}`, { method: "GET" });
      const labels = {
        pending_teacher_review: "已保存，等待老师审核",
        needs_changes: "老师要求继续修改",
        reviewed_ready_for_separate_execution: "审核完成，等待独立执行",
        blocked: "任务已阻止",
        result_succeeded_pending_teacher_verification: "已返回执行结果，等待老师验收",
        result_failed: "执行失败，可修改后重试",
        result_blocked: "执行结果已阻止"
      };
      const errorState = record.status.includes("failed") || record.status === "blocked" || record.status === "result_blocked";
      setState(stateElement, errorState ? "error" : "success", labels[record.status] || record.status);
      return record;
    } catch {
      return null;
    }
  }

  function normalizeValidation(result) {
    if (result === true || result == null) return { valid: true, message: "" };
    if (result === false) return { valid: false, message: "请先完成必填内容" };
    if (typeof result === "string") return { valid: false, message: result };
    return { valid: result.valid !== false, message: result.message || "请先完成必填内容" };
  }

  function install({ packet, button, stateElement, config = {}, validate }) {
    const endpoint = config.submitEndpoint || config.apiEndpoint || "http://127.0.0.1:4317/api/mask-corrections";
    const last = readJson(lastKey, null);
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "retry-button secondary-button";
    retryButton.textContent = "重试待提交任务";
    retryButton.hidden = true;
    button.insertAdjacentElement("afterend", retryButton);

    const queuedForEndpoint = () => readJson(queueKey, []).filter(item => item.endpoint === endpoint);
    const syncRetryButton = () => {
      const count = queuedForEndpoint().length;
      retryButton.hidden = count === 0;
      retryButton.textContent = count ? `重试待提交任务 (${count})` : "重试待提交任务";
    };

    async function submitPacket(correction, { fromQueue = false } = {}) {
      const record = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          packet: correction,
          metadata: {
            source: "mask_workbench",
            submittedFrom: location.href,
            userAgent: navigator.userAgent,
            retriedFromLocalQueue: fromQueue
          }
        })
      });
      removeQueued(correction);
      writeJson(lastKey, { id: record.id, endpoint, savedAt: new Date().toISOString() });
      return record;
    }

    async function retryPending() {
      const pending = queuedForEndpoint();
      if (!pending.length) return [];
      retryButton.disabled = true;
      setState(stateElement, "loading", `正在重试 ${pending.length} 个待提交任务...`);
      const saved = [];
      for (const item of pending) {
        try {
          saved.push(await submitPacket(item.packet, { fromQueue: true }));
        } catch (error) {
          enqueue(endpoint, item.packet, error.message);
        }
      }
      retryButton.disabled = false;
      syncRetryButton();
      if (queuedForEndpoint().length) {
        setState(stateElement, "offline", `仍有 ${queuedForEndpoint().length} 个任务等待重试`);
      } else {
        const record = saved.at(-1);
        setState(stateElement, "success", `待提交任务已保存${record?.id ? ` · ${record.id}` : ""}`);
        emit(button, "submission-success", { record, retried: true });
      }
      return saved;
    }

    if (last?.id && last?.endpoint === endpoint) replayStatus(endpoint, last.id, stateElement);
    syncRetryButton();
    retryButton.addEventListener("click", retryPending);

    button.onclick = async () => {
      const validation = normalizeValidation(validate?.());
      if (!validation.valid) {
        setState(stateElement, "error", validation.message);
        emit(button, "validation-error", validation);
        return;
      }

      const correction = packet();
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      setState(stateElement, "loading", "正在提交纠错任务...");
      try {
        const record = await submitPacket(correction);
        setState(stateElement, "success", `纠错任务已保存 · ${record.id}`);
        emit(button, "submission-success", { record });
      } catch (error) {
        enqueue(endpoint, correction, error.message);
        syncRetryButton();
        setState(stateElement, "offline", `提交失败，已进入本地待重试队列 · ${error.message}`);
        emit(button, "submission-queued", { error: error.message });
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    };

    return {
      endpoint,
      retryQueue: () => readJson(queueKey, []),
      retryPending,
      replayLast: () => {
        const current = readJson(lastKey, null);
        return current?.id ? replayStatus(endpoint, current.id, stateElement) : Promise.resolve(null);
      }
    };
  }

  global.AIApprenticeMaskSubmission = { install };
})(globalThis);
