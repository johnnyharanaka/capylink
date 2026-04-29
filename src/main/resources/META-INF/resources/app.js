const form = document.getElementById('form');
const urlInput = document.getElementById('url');
const submitBtn = document.getElementById('submit');
const result = document.getElementById('result');
const shortLink = document.getElementById('short');
const expires = document.getElementById('expires');
const countdown = document.getElementById('countdown');
const copyBtn = document.getElementById('copy');
const copyLabel = copyBtn.querySelector('.copy-label');
const errorBox = document.getElementById('error');

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function formatCountdown(target) {
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const days = Math.floor(ms / 86_400_000);
    if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    const minutes = Math.max(1, Math.floor(ms / 60_000));
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    result.hidden = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

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
        shortLink.textContent = data.shortUrl.replace(/^https?:\/\//, '');
        const exp = new Date(data.expiresAt);
        expires.dateTime = data.expiresAt;
        expires.textContent = dateFmt.format(exp);
        countdown.textContent = formatCountdown(exp);
        result.hidden = false;
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shortLink.href);
        copyLabel.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyLabel.textContent = 'Copy';
            copyBtn.classList.remove('copied');
        }, 1400);
    } catch {
        copyLabel.textContent = 'Failed';
        setTimeout(() => { copyLabel.textContent = 'Copy'; }, 1400);
    }
});
