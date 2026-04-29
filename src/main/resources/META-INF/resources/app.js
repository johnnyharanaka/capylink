const form = document.getElementById('form');
const urlInput = document.getElementById('url');
const result = document.getElementById('result');
const shortLink = document.getElementById('short');
const expires = document.getElementById('expires');
const copyBtn = document.getElementById('copy');
const errorBox = document.getElementById('error');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    result.hidden = true;

    try {
        const res = await fetch('/api/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput.value })
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(body || `${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        shortLink.href = data.shortUrl;
        shortLink.textContent = data.shortUrl;
        const exp = new Date(data.expiresAt);
        expires.dateTime = data.expiresAt;
        expires.textContent = exp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        result.hidden = false;
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
    }
});

copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(shortLink.href);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
});
