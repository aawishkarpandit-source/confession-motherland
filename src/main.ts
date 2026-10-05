import './style.css';

const textarea = document.getElementById('confession') as HTMLTextAreaElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const charCount = document.getElementById('charCount') as HTMLSpanElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const btnLabel = sendBtn.querySelector('.btn-label') as HTMLSpanElement;

const MAX_LEN = 5000;

function setStatus(msg: string, kind: '' | 'ok' | 'err' | 'busy'): void {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`.trim();
}

function updateCount(): void {
  charCount.textContent = `${textarea.value.length} / ${MAX_LEN}`;
}

textarea.addEventListener('input', updateCount);
updateCount();

clearBtn.addEventListener('click', () => {
  textarea.value = '';
  updateCount();
  setStatus('', '');
  textarea.focus();
});

interface SubmitResponse {
  ok: boolean;
  error?: string;
}

async function submit(): Promise<void> {
  const text = textarea.value.trim();

  if (text.length < 2) {
    setStatus('Write a little more first.', 'err');
    textarea.focus();
    return;
  }
  if (text.length > MAX_LEN) {
    setStatus(`Keep it under ${MAX_LEN} characters.`, 'err');
    return;
  }

  sendBtn.disabled = true;
  btnLabel.textContent = 'Sending…';
  setStatus('Sealing it in an envelope…', 'busy');

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = (await res.json().catch(() => ({}))) as SubmitResponse;

    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Server returned ${res.status}`);
    }

    textarea.value = '';
    updateCount();
    setStatus('Delivered. Nobody knows it was you.', 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    setStatus(`Could not send: ${msg}`, 'err');
  } finally {
    sendBtn.disabled = false;
    btnLabel.textContent = 'Drop it anonymously';
  }
}

sendBtn.addEventListener('click', () => {
  void submit();
});

// Ctrl/Cmd + Enter to send
textarea.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    void submit();
  }
});
